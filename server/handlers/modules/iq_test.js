const db = require('../../db/pool');
const whatsapp = require('../../services/whatsapp');
const scoring = require('../../services/scoring');
const openai = require('../../services/openai');
const { getModuleState, setModuleState } = require('./brain_age');

const TOTAL_QUESTIONS = 15;

async function handle(user, message, conversationId) {
  // Premium check
  if (!user.is_premium) {
    await whatsapp.sendMessage(conversationId, 'This is a Premium feature. Type PREMIUM to upgrade.');
    return;
  }

  const state = await getModuleState(user.id);

  // Already in IQ flow — process answer
  if (state && state.module === 'iq') {
    return handleAnswer(user, message, conversationId, state);
  }

  // Start new IQ test — progressive difficulty
  const easyQs = await db.getMany(
    `SELECT id, question_text FROM questions WHERE type = 'iq' AND difficulty = 'easy' AND is_active = true ORDER BY RANDOM() LIMIT 5`
  );
  const mediumQs = await db.getMany(
    `SELECT id, question_text FROM questions WHERE type = 'iq' AND difficulty = 'medium' AND is_active = true ORDER BY RANDOM() LIMIT 5`
  );
  const hardQs = await db.getMany(
    `SELECT id, question_text FROM questions WHERE type = 'iq' AND difficulty = 'hard' AND is_active = true ORDER BY RANDOM() LIMIT 5`
  );

  const questions = [...easyQs, ...mediumQs, ...hardQs];

  if (questions.length < TOTAL_QUESTIONS) {
    await whatsapp.sendMessage(conversationId, 'Sorry, not enough IQ questions available right now. Try again later!');
    return;
  }

  const newState = {
    module: 'iq',
    step: 0,
    questions: questions.map(q => q.id),
    responses: [],
    startedAt: Date.now()
  };

  await setModuleState(user.id, newState);

  await whatsapp.sendMessage(conversationId,
    `\u{1F9E0} *IQ Estimation Test* (1/${TOTAL_QUESTIONS}):\n\n${questions[0].question_text}`
  );
}

async function handleAnswer(user, message, conversationId, state) {
  const step = state.step;
  const questionId = state.questions[step];
  const question = await db.getOne('SELECT * FROM questions WHERE id = $1', [questionId]);

  state.responses.push({
    questionId,
    answer: message.trim(),
    correctAnswer: question ? question.answer : null,
    difficulty: question ? question.difficulty : null,
    responseTime: Date.now() - (state.lastSentAt || state.startedAt)
  });

  state.step = step + 1;

  if (state.step < TOTAL_QUESTIONS) {
    const nextId = state.questions[state.step];
    const next = await db.getOne('SELECT question_text FROM questions WHERE id = $1', [nextId]);
    state.lastSentAt = Date.now();
    await setModuleState(user.id, state);

    await whatsapp.sendMessage(conversationId,
      `\u{1F9E0} *IQ Estimation Test* (${state.step + 1}/${TOTAL_QUESTIONS}):\n\n${next.question_text}`
    );
    return;
  }

  // All answered — score
  try {
    const result = await openai.estimateIQ(state.responses);

    await db.query(
      `INSERT INTO brain_assessments (user_id, assessment_type, score, label, responses, created_at)
       VALUES ($1, 'iq', $2, $3, $4, NOW())`,
      [user.id, result.iqEstimate, result.label, JSON.stringify(state.responses)]
    );

    await db.query('UPDATE users SET iq_estimate_score = $1 WHERE id = $2', [result.iqEstimate, user.id]);
    await setModuleState(user.id, null);

    await whatsapp.sendMessage(conversationId,
      `Your estimated IQ range: *${result.iqEstimate}* (${result.label})\n\nConfidence: ${result.confidence}`
    );

    await scoring.checkAndAwardBadges(user.id);
  } catch (err) {
    console.error('IQ scoring error:', err.message);
    await setModuleState(user.id, null);
    await whatsapp.sendMessage(conversationId, 'Something went wrong scoring your test. Please try again later.');
  }
}

module.exports = { handle };
