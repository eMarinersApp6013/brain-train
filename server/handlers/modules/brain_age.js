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

/**
 * Convert A/B/C/D option labels to 1/2/3/4 in question text.
 */
function convertMcqLabels(text) {
  return text
    .replace(/\bA\)/g, '1)')
    .replace(/\bB\)/g, '2)')
    .replace(/\bC\)/g, '3)')
    .replace(/\bD\)/g, '4)');
}

/**
 * Map a user's numeric MCQ answer (1/2/3/4) back to the letter (A/B/C/D)
 * so it can be compared against the stored correct answer.
 */
function mapNumericToLetter(input) {
  const map = { '1': 'A', '2': 'B', '3': 'C', '4': 'D' };
  const trimmed = input.trim();
  return map[trimmed] || trimmed;
}

/**
 * Map a letter (A/B/C/D) to the numeric label (1/2/3/4) for display.
 */
function mapLetterToNumeric(letter) {
  const map = { 'A': '1', 'B': '2', 'C': '3', 'D': '4' };
  return map[letter] || letter;
}

/**
 * Check if an answer is correct, handling both MCQ and other types.
 */
function isCorrect(response) {
  if (!response.correctAnswer) return false;
  const userAnswer = response.answer.trim().toUpperCase();
  const correct = response.correctAnswer.trim().toUpperCase();

  if (response.answerType === 'mcq') {
    // User may have replied with 1/2/3/4 or A/B/C/D
    const mapped = mapNumericToLetter(userAnswer);
    return mapped === correct;
  }

  // For exact / other types, do case-insensitive comparison
  // Also handle pipe-separated multiple accepted answers
  const acceptedAnswers = correct.split('|').map(a => a.trim());
  return acceptedAnswers.includes(userAnswer);
}

/**
 * Fallback local scoring when the OpenAI API call fails.
 * - Count correct answers out of 10
 * - Calculate average response time
 * - Estimate brain age: base = user's actual age,
 *   subtract 1 year for each correct answer above 5,
 *   add 2 years for each below 5,
 *   add 1 year for every 10 seconds avg response time above 15s
 * - Clamp to 15-90
 */
function calculateBrainAgeLocally(responses, userAge) {
  const correctCount = responses.filter(r => isCorrect(r)).length;
  const totalResponseTime = responses.reduce((sum, r) => sum + (r.responseTime || 0), 0);
  const avgResponseTimeSec = (totalResponseTime / responses.length) / 1000;

  const baseAge = userAge || 30;
  let brainAge = baseAge;

  if (correctCount > 5) {
    brainAge -= (correctCount - 5);
  } else if (correctCount < 5) {
    brainAge += (5 - correctCount) * 2;
  }

  if (avgResponseTimeSec > 15) {
    brainAge += Math.floor((avgResponseTimeSec - 15) / 10);
  }

  brainAge = Math.max(15, Math.min(90, brainAge));

  let label;
  if (correctCount >= 9) {
    label = 'Outstanding! Your brain is razor-sharp.';
  } else if (correctCount >= 7) {
    label = 'Great job! Your cognitive skills are strong.';
  } else if (correctCount >= 5) {
    label = 'Not bad! Regular brain training can help you improve.';
  } else {
    label = 'Keep practicing! Consistent training makes a big difference.';
  }

  return { brainAge, label, correctCount };
}

/**
 * Build a full results breakdown message showing each question result.
 */
function buildResultsBreakdown(responses) {
  const lines = responses.map((r, i) => {
    const num = i + 1;
    const correct = isCorrect(r);
    const userDisplay = r.answerType === 'mcq'
      ? mapLetterToNumeric(mapNumericToLetter(r.answer.trim().toUpperCase()))
      : r.answer.trim();

    if (correct) {
      return `Q${num}: \u2705 Your answer: ${userDisplay} (Correct!)`;
    } else {
      const correctDisplay = r.answerType === 'mcq'
        ? mapLetterToNumeric(r.correctAnswer)
        : r.correctAnswer;
      return `Q${num}: \u274C Your answer: ${userDisplay} (Answer: ${correctDisplay})`;
    }
  });

  return lines.join('\n');
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
  const questionText = convertMcqLabels(first.question_text);
  await whatsapp.sendMessage(conversationId,
    `\u{1F9E0} *Brain Age Test* (1/10):\n\n${questionText}`
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
    answerType: question ? question.answer_type : null,
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

    const questionText = convertMcqLabels(next.question_text);
    await whatsapp.sendMessage(conversationId,
      `\u{1F9E0} *Brain Age Test* (${state.step + 1}/10):\n\n${questionText}`
    );
    return;
  }

  // All 10 answered — score
  let result;
  try {
    result = await openai.scoreBrainAge(state.responses);
  } catch (err) {
    console.error('Brain age scoring error (falling back to local):', err.message);
    result = calculateBrainAgeLocally(state.responses, user.age);
  }

  try {
    await db.query(
      `INSERT INTO brain_assessments (user_id, assessment_type, score, label, responses, created_at)
       VALUES ($1, 'brain_age', $2, $3, $4, NOW())`,
      [user.id, result.brainAge, result.label, JSON.stringify(state.responses)]
    );

    await db.query('UPDATE users SET brain_age_score = $1 WHERE id = $2', [result.brainAge, user.id]);
  } catch (dbErr) {
    console.error('Brain age DB save error:', dbErr.message);
  }

  await setModuleState(user.id, null);

  // Build full results breakdown
  const breakdown = buildResultsBreakdown(state.responses);
  const correctCount = state.responses.filter(r => isCorrect(r)).length;

  let resultsMessage = `\u{1F9E0} *Brain Age Test — Results*\n\n`;
  resultsMessage += `${breakdown}\n\n`;
  resultsMessage += `*Score: ${correctCount}/10*\n`;
  resultsMessage += `Your brain tests like a *${result.brainAge}-year-old*!\n`;
  resultsMessage += `${result.label}`;

  await whatsapp.sendMessage(conversationId, resultsMessage);

  // Ask for name if not already set (first time only)
  if (!user.name) {
    await whatsapp.sendMessage(conversationId,
      `Great effort! By the way, what should I call you? Please reply with your name.`
    );
    // Set a state so the next message is captured as name
    await setModuleState(user.id, { module: 'brain_age_name_prompt' });
  }

  try {
    await scoring.checkAndAwardBadges(user.id);
  } catch (badgeErr) {
    console.error('Badge check error:', badgeErr.message);
  }
}

module.exports = { handle, getModuleState, setModuleState };
