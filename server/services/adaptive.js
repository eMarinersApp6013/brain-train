const db = require('../db/pool');

/**
 * Adaptive difficulty engine.
 * Adjusts user difficulty based on recent performance.
 * Called after each session completes.
 *
 * Rules (based on BrainHQ research):
 * - If accuracy >= 85% for 3 consecutive sessions → increase difficulty
 * - If accuracy <= 40% for 2 consecutive sessions → decrease difficulty
 * - Otherwise → stay at current level
 *
 * Difficulty levels: easy → medium → hard
 */

const DIFFICULTY_ORDER = ['easy', 'medium', 'hard'];

async function adjustDifficulty(userId) {
  const user = await db.getOne('SELECT id, difficulty FROM users WHERE id = $1', [userId]);
  if (!user) return;

  // Get last 3 sessions' accuracy
  const sessions = await db.getMany(
    `SELECT
       session_date,
       COUNT(*) FILTER (WHERE is_correct = true)::float / NULLIF(COUNT(*) FILTER (WHERE answered_at IS NOT NULL), 0) * 100 as accuracy
     FROM user_sessions
     WHERE user_id = $1 AND answered_at IS NOT NULL
     GROUP BY session_date
     ORDER BY session_date DESC
     LIMIT 3`,
    [userId]
  );

  if (sessions.length < 2) return; // Need at least 2 sessions

  const currentIdx = DIFFICULTY_ORDER.indexOf(user.difficulty);
  if (currentIdx === -1) return;

  // Check for upgrade: 3 sessions >= 85%
  if (sessions.length >= 3 && sessions.every(s => s.accuracy >= 85)) {
    if (currentIdx < DIFFICULTY_ORDER.length - 1) {
      const newDifficulty = DIFFICULTY_ORDER[currentIdx + 1];
      await db.query('UPDATE users SET difficulty = $1 WHERE id = $2', [newDifficulty, userId]);
      return { changed: true, from: user.difficulty, to: newDifficulty, reason: 'upgrade' };
    }
  }

  // Check for downgrade: 2 sessions <= 40%
  if (sessions.length >= 2 && sessions.slice(0, 2).every(s => s.accuracy <= 40)) {
    if (currentIdx > 0) {
      const newDifficulty = DIFFICULTY_ORDER[currentIdx - 1];
      await db.query('UPDATE users SET difficulty = $1 WHERE id = $2', [newDifficulty, userId]);
      return { changed: true, from: user.difficulty, to: newDifficulty, reason: 'downgrade' };
    }
  }

  return { changed: false };
}

/**
 * Get personalized question mix based on user's cognitive profile.
 * 80% questions from weak areas, 20% from strong areas.
 * Based on Diamond & Lee (2011) research on targeted training.
 */
async function getPersonalizedMix(userId) {
  // Get accuracy per question type over last 14 days
  const typeAccuracy = await db.getMany(
    `SELECT q.type,
       COUNT(*) as total,
       COUNT(*) FILTER (WHERE us.is_correct = true) as correct,
       ROUND(COUNT(*) FILTER (WHERE us.is_correct = true)::numeric / NULLIF(COUNT(*), 0) * 100) as accuracy
     FROM user_sessions us
     JOIN questions q ON us.question_id = q.id
     WHERE us.user_id = $1 AND us.answered_at IS NOT NULL
       AND us.session_date >= CURRENT_DATE - INTERVAL '14 days'
     GROUP BY q.type
     ORDER BY accuracy ASC`,
    [userId]
  );

  if (typeAccuracy.length < 3) return null; // Not enough data

  // Weakest areas (bottom 40%) get 80% of questions
  const weakCount = Math.max(1, Math.floor(typeAccuracy.length * 0.4));
  const weakTypes = typeAccuracy.slice(0, weakCount).map(t => t.type);
  const strongTypes = typeAccuracy.slice(weakCount).map(t => t.type);

  return { weakTypes, strongTypes, typeAccuracy };
}

/**
 * Notify user of difficulty change via WhatsApp.
 */
async function notifyDifficultyChange(user, change, conversationId) {
  if (!change || !change.changed) return;

  const whatsapp = require('./whatsapp');
  let msg;

  if (change.reason === 'upgrade') {
    msg = `📈 *Level Up!*\n\nYour performance has been outstanding! Difficulty increased from *${change.from}* to *${change.to}*.\n\n💪 You're ready for bigger challenges!`;
  } else {
    msg = `📊 *Difficulty Adjusted*\n\nI've adjusted your level from *${change.from}* to *${change.to}* to help you build confidence.\n\n🧠 We'll increase again once you're ready!`;
  }

  await whatsapp.sendMessage(conversationId, msg);
}

module.exports = { adjustDifficulty, getPersonalizedMix, notifyDifficultyChange };
