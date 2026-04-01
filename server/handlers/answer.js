const db = require('../db/pool');
const whatsapp = require('../services/whatsapp');
const content = require('../services/content');
const scoring = require('../services/scoring');
const openai = require('../services/openai');
const adaptive = require('../services/adaptive');

async function handleAnswer(user, message, conversationId) {
  // Find most recent unanswered session
  const session = await db.getOne(
    `SELECT us.*, q.answer, q.answer_type, q.question_text, q.explanation, q.points, q.type, q.memory_recall_text
     FROM user_sessions us JOIN questions q ON us.question_id = q.id
     WHERE us.user_id = $1 AND us.answered_at IS NULL AND us.sent_at IS NOT NULL
     ORDER BY us.sent_at DESC LIMIT 1`,
    [user.id]
  );

  if (!session) {
    // If user sent a single digit, show modules menu
    const msg = message.trim();
    if (/^[1-8]$/.test(msg)) {
      const { handleCommand } = require('./commands');
      await handleCommand(user, 'MODULES', conversationId);
      return;
    }
    await whatsapp.sendMessage(conversationId,
      "Type *MODULES* to start a brain training session!\nOr type *MENU* to see all commands."
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
        // After memory answer, check for next question in session
        await sendNextOrSummary(user, conversationId);
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

  // Send next question in the session or session summary
  await sendNextOrSummary(user, conversationId);
}

async function sendNextOrSummary(user, conversationId) {
  // Send next question in the session
  const nextSession = await db.getOne(
    `SELECT us.id, q.* FROM user_sessions us
     JOIN questions q ON us.question_id = q.id
     WHERE us.user_id = $1 AND us.session_date = CURRENT_DATE AND us.session_type = 'daily' AND us.sent_at IS NULL
     ORDER BY us.id ASC LIMIT 1`,
    [user.id]
  );

  if (nextSession) {
    // Count progress
    const total = await db.getOne(
      'SELECT COUNT(*) as cnt FROM user_sessions WHERE user_id = $1 AND session_date = CURRENT_DATE AND session_type = $2',
      [user.id, 'daily']
    );
    const answered = await db.getOne(
      'SELECT COUNT(*) as cnt FROM user_sessions WHERE user_id = $1 AND session_date = CURRENT_DATE AND session_type = $2 AND answered_at IS NOT NULL',
      [user.id, 'daily']
    );
    const qNum = parseInt(answered.cnt) + 1;
    const qTotal = parseInt(total.cnt);

    // Mark as sent
    await db.query('UPDATE user_sessions SET sent_at = NOW() WHERE id = $1', [nextSession.id]);

    const dayOfWeek = content.getDayType(new Date());
    const weekNum = content.getWeekNumber();
    const msg = `*Question ${qNum}/${qTotal}*\n\n${content.formatChallengeMessage(nextSession, dayOfWeek, weekNum)}`;
    await whatsapp.sendMessage(conversationId, msg);
  } else {
    // All questions answered - send session summary
    const sessionResults = await db.getMany(
      'SELECT points_earned, is_correct, response_time_seconds FROM user_sessions WHERE user_id = $1 AND session_date = CURRENT_DATE AND session_type = $2',
      [user.id, 'daily']
    );

    // Only show summary if there were multiple questions in the session
    if (sessionResults.length > 1) {
      const totalPts = sessionResults.reduce((s, r) => s + (r.points_earned || 0), 0);
      const correctCount = sessionResults.filter(r => r.is_correct).length;
      const totalQ = sessionResults.length;
      const accuracy = totalQ > 0 ? Math.round((correctCount / totalQ) * 100) : 0;

      let summary = `🏁 *Session Complete!*\n\n`;
      summary += `✅ Correct: ${correctCount}/${totalQ}\n`;
      summary += `🎯 Accuracy: ${accuracy}%\n`;
      summary += `💰 Points earned: ${totalPts}\n`;
      summary += `🔥 Streak: ${user.streak} days\n`;
      summary += `\nGreat work! See you tomorrow! 💪`;
      await whatsapp.sendMessage(conversationId, summary);

      // Send detailed answers breakdown
      const allSessions = await db.getMany(
        `SELECT us.user_answer, us.is_correct, q.question_text, q.answer, q.explanation
         FROM user_sessions us JOIN questions q ON us.question_id = q.id
         WHERE us.user_id = $1 AND us.session_date = CURRENT_DATE AND us.session_type = 'daily' AND us.answered_at IS NOT NULL
         ORDER BY us.id`, [user.id]
      );
      if (allSessions.length > 1) {
        let answers = '📝 *Answers & Explanations:*\n\n';
        allSessions.forEach((s, i) => {
          const icon = s.is_correct ? '✅' : '❌';
          answers += `*Q${i + 1}:* ${s.question_text.substring(0, 60)}${s.question_text.length > 60 ? '...' : ''}\n`;
          answers += `${icon} You: ${s.user_answer || '-'}`;
          if (!s.is_correct) answers += ` | Answer: ${s.answer.split('|')[0]}`;
          answers += '\n';
          if (s.explanation) answers += `💡 ${s.explanation.substring(0, 80)}${s.explanation.length > 80 ? '...' : ''}\n`;
          answers += '\n';
        });
        await whatsapp.sendMessage(conversationId, answers);
      }

      // Check adaptive difficulty
      try {
        const change = await adaptive.adjustDifficulty(user.id);
        if (change && change.changed) {
          await adaptive.notifyDifficultyChange(user, change, conversationId);
        }
      } catch (e) { console.error('Adaptive difficulty error:', e.message); }
    }
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

module.exports = { handleAnswer };
