const db = require('../../db/pool');
const whatsapp = require('../../services/whatsapp');
const { setModuleState } = require('./brain_age');

const PHONE_REGEX = /\+91\d{10}/;

async function handle(user, message, conversationId) {
  const state = user.module_state;

  // If in active duel, process answer
  if (state && state.module === 'duel') {
    return handleDuelAnswer(user, message, conversationId, state);
  }

  // Parse opponent phone
  const match = message.match(PHONE_REGEX);
  if (!match) {
    await whatsapp.sendMessage(conversationId, 'Please use: DUEL +91XXXXXXXXXX');
    return;
  }

  const opponentPhone = match[0];

  // Can't duel yourself
  if (opponentPhone === user.phone) {
    await whatsapp.sendMessage(conversationId, "You can't duel yourself!");
    return;
  }

  // Check if opponent is registered
  const opponent = await db.getOne(
    'SELECT * FROM users WHERE phone = $1 AND is_active = true',
    [opponentPhone]
  );

  if (!opponent) {
    await whatsapp.sendMessage(conversationId, "That number isn't registered with BrainPing yet.");
    return;
  }

  // Pick a random question
  const question = await db.getOne(
    `SELECT * FROM questions WHERE is_active = true ORDER BY RANDOM() LIMIT 1`
  );

  if (!question) {
    await whatsapp.sendMessage(conversationId, 'No questions available right now. Try again later!');
    return;
  }

  const duelId = `duel_${user.id}_${opponent.id}_${Date.now()}`;

  // Create sessions for both
  await db.query(
    `INSERT INTO user_sessions (user_id, question_id, sent_at, session_date, session_type)
     VALUES ($1, $2, NOW(), CURRENT_DATE, 'duel')`,
    [user.id, question.id]
  );
  await db.query(
    `INSERT INTO user_sessions (user_id, question_id, sent_at, session_date, session_type)
     VALUES ($1, $2, NOW(), CURRENT_DATE, 'duel')`,
    [opponent.id, question.id]
  );

  // Store duel state for both users
  const duelState = {
    module: 'duel',
    duelId,
    questionId: question.id,
    challengerId: user.id,
    opponentId: opponent.id,
    challengerConversationId: conversationId,
    opponentConversationId: opponent.chatwoot_conversation_id,
    startedAt: Date.now(),
    challengerAnswer: null,
    opponentAnswer: null
  };

  await setModuleState(user.id, duelState);
  await setModuleState(opponent.id, duelState);

  // Send question to both
  const duelMsg = `\u2694\uFE0F *FRIEND DUEL!*\n\n${question.question_text}`;
  await whatsapp.sendMessage(conversationId, duelMsg);
  await whatsapp.sendMessage(opponent.chatwoot_conversation_id,
    `\u2694\uFE0F *FRIEND DUEL!* ${user.name || 'Someone'} challenged you!\n\n${question.question_text}`
  );
}

async function handleDuelAnswer(user, message, conversationId, state) {
  const question = await db.getOne('SELECT * FROM questions WHERE id = $1', [state.questionId]);
  const userAnswer = message.trim();
  const isChallenger = user.id === state.challengerId;
  const now = Date.now();

  // Record this user's answer
  if (isChallenger) {
    state.challengerAnswer = { answer: userAnswer, time: now };
  } else {
    state.opponentAnswer = { answer: userAnswer, time: now };
  }

  // Update session
  const isCorrect = question && userAnswer.toLowerCase() === question.answer.toLowerCase();
  await db.query(
    `UPDATE user_sessions SET answered_at = NOW(), user_answer = $1, is_correct = $2,
     response_time_seconds = $3
     WHERE user_id = $4 AND question_id = $5 AND session_type = 'duel' AND answered_at IS NULL`,
    [userAnswer, isCorrect, Math.round((now - state.startedAt) / 1000), user.id, state.questionId]
  );

  // Check if both answered
  if (state.challengerAnswer && state.opponentAnswer) {
    // Determine winner
    const challengerCorrect = question && state.challengerAnswer.answer.toLowerCase() === question.answer.toLowerCase();
    const opponentCorrect = question && state.opponentAnswer.answer.toLowerCase() === question.answer.toLowerCase();

    let resultMsg;
    if (challengerCorrect && !opponentCorrect) {
      resultMsg = 'Challenger wins!';
    } else if (!challengerCorrect && opponentCorrect) {
      resultMsg = 'Opponent wins!';
    } else if (challengerCorrect && opponentCorrect) {
      resultMsg = state.challengerAnswer.time <= state.opponentAnswer.time
        ? 'Challenger wins by speed!'
        : 'Opponent wins by speed!';
    } else {
      resultMsg = "Neither got it right! It's a draw.";
    }

    const fullResult = `\u2694\uFE0F *Duel Result!*\n\nCorrect answer: ${question.answer}\n\n${resultMsg}`;

    await whatsapp.sendMessage(state.challengerConversationId, fullResult);
    await whatsapp.sendMessage(state.opponentConversationId, fullResult);

    // Clear duel state for both
    await setModuleState(state.challengerId, null);
    await setModuleState(state.opponentId, null);
  } else {
    // Save state and notify waiting
    await setModuleState(state.challengerId, state);
    await setModuleState(state.opponentId, state);
    await whatsapp.sendMessage(conversationId, 'Answer recorded! Waiting for your opponent...');
  }
}

module.exports = { handle };
