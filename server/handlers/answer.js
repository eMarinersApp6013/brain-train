const db = require('../db/pool');
const whatsapp = require('../services/whatsapp');
const content = require('../services/content');
const scoring = require('../services/scoring');
const openai = require('../services/openai');

async function handleAnswer(user, message, conversationId) {
  // Find most recent unanswered session
  const session = await db.getOne(
    `SELECT us.*, q.answer, q.answer_type, q.question_text, q.explanation, q.points, q.type, q.memory_recall_text
     FROM user_sessions us JOIN questions q ON us.question_id = q.id
     WHERE us.user_id = $1 AND us.answered_at IS NULL
     ORDER BY us.sent_at DESC LIMIT 1`,
    [user.id]
  );

  if (!session) {
    await whatsapp.sendMessage(conversationId,
      "🤔 You don't have a pending challenge right now. Your next one will arrive at your scheduled time!"
    );
    return;
  }

  const userAnswer = message.trim();
  const sentAt = new Date(session.sent_at);
  const now = new Date();
  const responseTimeSec = Math.round((now - sentAt) / 1000);

  let isCorrect = false;
  let explanation = session.explanation || '';

  // Check answer based on type
  switch (session.answer_type) {
    case 'exact':
      isCorrect = content.checkExactAnswer(session.answer, userAnswer);
      break;

    case 'mcq':
      isCorrect = content.checkMcqAnswer(session.answer, userAnswer);
      break;

    case 'keyword':
      if (session.type === 'memory') {
        const recall = content.checkMemoryRecall(session.answer, userAnswer);
        isCorrect = recall.passed;
        explanation = `You recalled ${recall.matched}/${recall.total} words (${recall.percentage}%). ${recall.passed ? 'Great memory!' : 'Keep practising!'}`;
        // Score proportionally for memory
        const memoryPoints = Math.round((recall.percentage / 100) * session.points);
        await saveResult(user.id, session.id, userAnswer, isCorrect, memoryPoints, responseTimeSec, session.hint_used);
        const stats = await scoring.getUserStats(user.id);
        const resultMsg = content.formatResultMessage(isCorrect, memoryPoints, stats.streak, explanation);
        await whatsapp.sendMessage(conversationId, resultMsg);
        await scoring.checkAndAwardBadges(user.id);
        return;
      }
      isCorrect = content.checkKeywordAnswer(session.answer, userAnswer);
      break;

    case 'fuzzy':
      try {
        const result = await openai.checkAnswer(session.question_text, session.answer, userAnswer, 'fuzzy');
        isCorrect = result.correct;
      } catch (err) {
        console.error('Fuzzy check failed, falling back to keyword:', err.message);
        isCorrect = content.checkKeywordAnswer(session.answer, userAnswer);
      }
      break;

    case 'ai_check':
      try {
        const result = await openai.checkAnswer(session.question_text, session.answer, userAnswer, 'ai_check');
        isCorrect = result.correct;
        if (result.explanation) explanation = result.explanation;
      } catch (err) {
        console.error('AI check failed, falling back to keyword:', err.message);
        isCorrect = content.checkKeywordAnswer(session.answer, userAnswer);
      }
      break;

    default:
      isCorrect = content.checkExactAnswer(session.answer, userAnswer);
  }

  const points = scoring.calculatePoints(isCorrect, responseTimeSec, user.difficulty, session.hint_used);
  await saveResult(user.id, session.id, userAnswer, isCorrect, points, responseTimeSec, session.hint_used);

  const streak = await scoring.updateStreak(user.id);
  const resultMsg = content.formatResultMessage(isCorrect, points, streak, explanation);
  await whatsapp.sendMessage(conversationId, resultMsg);

  // Check for new badges
  const newBadges = await scoring.checkAndAwardBadges(user.id);
  for (const badge of newBadges) {
    await whatsapp.sendMessage(conversationId, `🏅 *Achievement Unlocked!*\n\n${badge.badge_label}\n\nKeep up the great work!`);
  }

  // Check if Wednesday math (send next question)
  if (session.type === 'math') {
    await sendNextMathQuestion(user, conversationId);
  }
}

async function saveResult(userId, sessionId, userAnswer, isCorrect, points, responseTimeSec, hintUsed) {
  await db.query(
    `UPDATE user_sessions SET answered_at = NOW(), user_answer = $1, is_correct = $2, points_earned = $3,
     response_time_seconds = $4, hint_used = $5 WHERE id = $6`,
    [userAnswer, isCorrect, points, responseTimeSec, hintUsed || false, sessionId]
  );
  await scoring.updateScore(userId, null, points, isCorrect, responseTimeSec);
}

async function sendNextMathQuestion(user, conversationId) {
  // Count how many math questions answered today
  const answered = await db.getMany(
    `SELECT us.id FROM user_sessions us JOIN questions q ON us.question_id = q.id
     WHERE us.user_id = $1 AND us.session_date = CURRENT_DATE AND q.type = 'math' AND us.answered_at IS NOT NULL`,
    [user.id]
  );

  if (answered.length >= 3) return; // All 3 done

  // Find next math question not yet sent today
  const audience = user.mode === 'adult' ? 'adult' : `kids-${user.age_group}`;
  const sentIds = await db.getMany(
    `SELECT us.question_id FROM user_sessions us JOIN questions q ON us.question_id = q.id
     WHERE us.user_id = $1 AND us.session_date = CURRENT_DATE AND q.type = 'math'`,
    [user.id]
  );
  const excludeIds = sentIds.map(s => s.question_id);

  let whereClause = "q.type = 'math' AND q.difficulty = $1 AND q.is_active = true";
  const params = [user.difficulty];
  if (audience !== 'adult') {
    whereClause += ' AND q.audience = $2';
    params.push(audience);
  } else {
    whereClause += " AND q.audience = 'adult'";
  }
  if (excludeIds.length > 0) {
    whereClause += ` AND q.id NOT IN (${excludeIds.join(',')})`;
  }

  const question = await db.getOne(
    `SELECT * FROM questions q WHERE ${whereClause} ORDER BY RANDOM() LIMIT 1`,
    params
  );

  if (question) {
    const num = answered.length + 1;
    await whatsapp.sendMessage(conversationId, `⚡ *Math Round Q${num + 1}/3:*\n\n${question.question_text}`);
    await db.query(
      'INSERT INTO user_sessions (user_id, question_id, sent_at, session_date, session_type) VALUES ($1, $2, NOW(), CURRENT_DATE, $3)',
      [user.id, question.id, 'daily']
    );
  }
}

module.exports = { handleAnswer };
