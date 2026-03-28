const db = require('../../db/pool');
const whatsapp = require('../../services/whatsapp');
const scoring = require('../../services/scoring');
const openai = require('../../services/openai');

async function getModuleState(userId) {
  const user = await db.getOne('SELECT module_state FROM users WHERE id = $1', [userId]);
  return user ? user.module_state : null;
}

async function setModuleState(userId, state) {
  await db.query('UPDATE users SET module_state = $1 WHERE id = $2', [JSON.stringify(state), userId]);
}

async function handle(user, message, conversationId) {
  const state = await getModuleState(user.id);

  // Already in brain_age flow — process answer
  if (state && state.module === 'brain_age') {
    return handleAnswer(user, message, conversationId, state);
  }

  // Start new brain age test
  const questions = await db.getMany(
    `SELECT id, question_text FROM questions WHERE type = 'brain_age' AND is_active = true ORDER BY RANDOM() LIMIT 10`
  );

  if (questions.length < 10) {
    await whatsapp.sendMessage(conversationId, 'Sorry, not enough brain age questions available right now. Try again later!');
    return;
  }

  const newState = {
    module: 'brain_age',
    step: 0,
    questions: questions.map(q => q.id),
    responses: [],
    startedAt: Date.now()
  };

  await setModuleState(user.id, newState);

  const first = questions[0];
  await whatsapp.sendMessage(conversationId,
    `\u{1F9E0} *Brain Age Test* (1/10):\n\n${first.question_text}`
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
    responseTime: Date.now() - (state.lastSentAt || state.startedAt),
    type: question ? question.type : 'brain_age'
  });

  state.step = step + 1;

  // More questions remaining
  if (state.step < 10) {
    const nextId = state.questions[state.step];
    const next = await db.getOne('SELECT question_text FROM questions WHERE id = $1', [nextId]);
    state.lastSentAt = Date.now();
    await setModuleState(user.id, state);

    await whatsapp.sendMessage(conversationId,
      `\u{1F9E0} *Brain Age Test* (${state.step + 1}/10):\n\n${next.question_text}`
    );
    return;
  }

  // All 10 answered — score
  try {
    const result = await openai.scoreBrainAge(state.responses);

    await db.query(
      `INSERT INTO brain_assessments (user_id, assessment_type, score, label, responses, created_at)
       VALUES ($1, 'brain_age', $2, $3, $4, NOW())`,
      [user.id, result.brainAge, result.label, JSON.stringify(state.responses)]
    );

    await db.query('UPDATE users SET brain_age_score = $1 WHERE id = $2', [result.brainAge, user.id]);
    await setModuleState(user.id, null);

    await whatsapp.sendMessage(conversationId,
      `Your brain tests like a *${result.brainAge}-year-old*! \u{1F9E0}\n\n${result.label}`
    );

    await scoring.checkAndAwardBadges(user.id);
  } catch (err) {
    console.error('Brain age scoring error:', err.message);
    await setModuleState(user.id, null);
    await whatsapp.sendMessage(conversationId, 'Something went wrong scoring your test. Please try again later.');
  }
}

module.exports = { handle, getModuleState, setModuleState };
