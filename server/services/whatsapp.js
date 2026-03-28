const db = require('../db/pool');
const chatwoot = require('./chatwoot');
const content = require('./content');
const scoring = require('./scoring');

const WINDOW_DURATION_MS = 23 * 60 * 60 * 1000 + 55 * 60 * 1000; // 23h 55m

async function isTestModeBlocked(phone) {
  const testMode = await db.getSetting('TEST_MODE');
  if (testMode !== 'true') return false;
  const wl = await db.getOne('SELECT id FROM whitelist WHERE phone = $1 AND is_active = true', [phone]);
  return !wl;
}

async function isWindowOpen(userId) {
  const user = await db.getOne('SELECT last_user_message_at, window_open_until FROM users WHERE id = $1', [userId]);
  if (!user || !user.last_user_message_at) return false;
  const windowEnd = new Date(user.last_user_message_at.getTime() + WINDOW_DURATION_MS);
  return new Date() < windowEnd;
}

async function updateMessageWindow(userId) {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + WINDOW_DURATION_MS);
  await db.query(
    'UPDATE users SET last_user_message_at = $1, window_open_until = $2, window_expired = false, last_active = $1 WHERE id = $3',
    [now, windowEnd, userId]
  );
}

async function sendMessage(conversationId, text) {
  return chatwoot.sendMessage(conversationId, text);
}

async function sendChallenge(user) {
  if (!await isWindowOpen(user.id)) {
    await db.query('UPDATE users SET window_expired = true WHERE id = $1', [user.id]);
    return { sent: false, reason: 'window_closed' };
  }

  const today = new Date();
  const dayOfWeek = content.getDayType(today);
  const weekNum = content.getWeekNumber();

  // Check for Friday memory recall (evening)
  const hour = today.getHours();
  if (dayOfWeek === 'fri' && hour >= 18) {
    return await sendMemoryRecall(user);
  }

  const question = await content.getDailyQuestion(user.id, dayOfWeek, user.difficulty, user.mode === 'adult' ? 'adult' : `kids-${user.age_group}`);
  if (!question) {
    return { sent: false, reason: 'no_question' };
  }

  const message = content.formatChallengeMessage(question, dayOfWeek, weekNum);

  // Send leaderboard shoutout before challenge
  await sendLeaderboardShoutout(user.chatwoot_conversation_id);

  await sendMessage(user.chatwoot_conversation_id, message);

  await db.query(
    'INSERT INTO user_sessions (user_id, question_id, sent_at, session_date, session_type) VALUES ($1, $2, NOW(), CURRENT_DATE, $3)',
    [user.id, question.id, 'daily']
  );

  return { sent: true, questionId: question.id };
}

async function sendMemoryRecall(user) {
  // Find today's memory question session
  const session = await db.getOne(
    `SELECT us.id, q.memory_recall_text, q.answer, q.points
     FROM user_sessions us JOIN questions q ON us.question_id = q.id
     WHERE us.user_id = $1 AND us.session_date = CURRENT_DATE AND q.type = 'memory' AND us.answered_at IS NULL`,
    [user.id]
  );
  if (!session || !session.memory_recall_text) return { sent: false, reason: 'no_memory_session' };

  const msg = content.formatMemoryRecallMessage({ memory_recall_text: session.memory_recall_text });
  await sendMessage(user.chatwoot_conversation_id, msg);
  return { sent: true, type: 'memory_recall' };
}

async function sendLeaderboardShoutout(conversationId) {
  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];

    const top3 = await db.getMany(
      `SELECT u.name, u.phone, us.response_time_seconds
       FROM user_sessions us JOIN users u ON us.user_id = u.id
       WHERE us.session_date = $1 AND us.is_correct = true AND us.response_time_seconds IS NOT NULL
       ORDER BY us.response_time_seconds ASC LIMIT 3`,
      [dateStr]
    );

    if (top3.length === 0) return;

    let msg = "🏆 *Yesterday's Fastest Brains:*\n";
    top3.forEach((u, i) => {
      const name = u.name || u.phone.slice(-4);
      msg += `${i + 1}. ${name} (${u.response_time_seconds}s)\n`;
    });
    msg += '\nCan you beat them today?';

    await sendMessage(conversationId, msg);
  } catch (err) {
    console.error('Leaderboard shoutout error:', err.message);
  }
}

async function sendWelcomeMessage(conversationId) {
  const botName = await db.getSetting('BOT_NAME') || 'BrainPing';
  const msg = `🧠 Welcome to *${botName}*!\n\nI'm your daily brain training companion. I'll send you fun challenges every day to keep your mind sharp!\n\nAre you joining for yourself or for a child?\n\nReply:\n*1* - For myself\n*2* - For my child`;
  await sendMessage(conversationId, msg);
}

async function sendMenuMessage(conversationId) {
  const msg = `📋 *BrainPing Menu*\n\nType any command:\n\n📊 *STATS* - Your scores & progress\n💡 *HINT* - Get a clue (-1 point)\n⏸️ *PAUSE* - Stop daily messages\n▶️ *RESUME* - Restart messages\n📈 *LEVEL* - Change difficulty\n⭐ *PREMIUM* - See plans\n🧠 *BRAIN AGE* - Take brain age test\n🧩 *IQ* - IQ estimation (Premium)\n⚔️ *DUEL +91XXX* - Challenge a friend\n🏆 *LEADERBOARD* - Weekly top 10\n🏅 *BADGES* - Your achievements\n📄 *REPORT* - Weekly brain report\n🛑 *STOP* - Unsubscribe`;
  await sendMessage(conversationId, msg);
}

async function sendWeeklyScorecard(user) {
  if (!await isWindowOpen(user.id)) return;

  const stats = await scoring.getUserStats(user.id);
  const weekSessions = await db.getMany(
    `SELECT us.session_date, us.is_correct, us.points_earned, q.type
     FROM user_sessions us JOIN questions q ON us.question_id = q.id
     WHERE us.user_id = $1 AND us.session_date >= CURRENT_DATE - INTERVAL '7 days'
     ORDER BY us.session_date`,
    [user.id]
  );

  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  let dayResults = '';
  days.forEach(day => {
    const s = weekSessions.find(ws => {
      const d = new Date(ws.session_date);
      return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()] === day;
    });
    if (s) {
      dayResults += `${day}: ${s.is_correct ? '✅' : '❌'} ${s.points_earned || 0} pts\n`;
    } else {
      dayResults += `${day}: ⬜ Missed\n`;
    }
  });

  let msg = `📊 *Weekly Scorecard*\n\n${dayResults}\n`;
  msg += `🔥 Streak: ${stats.streak} days\n`;
  msg += `🎯 Accuracy: ${stats.accuracy}%\n`;
  msg += `💰 Total Points: ${stats.totalPoints}\n`;
  msg += `📈 Weekly Points: ${stats.weeklyPoints}\n`;

  if (user.is_premium && user.brain_health_score != null) {
    const trend = user.brain_health_score > 70 ? '📈' : user.brain_health_score > 50 ? '➡️' : '📉';
    msg += `\n🧠 Brain Health: ${user.brain_health_score}/100 ${trend}\n`;
  } else if (!user.is_premium) {
    msg += `\n🔒 Brain Health Score — Upgrade to Premium!\nType *PREMIUM* to learn more.\n`;
  }

  msg += `\n💬 Monday brings your personal coach tip!`;

  await sendMessage(user.chatwoot_conversation_id, msg);
}

module.exports = {
  isTestModeBlocked,
  isWindowOpen,
  updateMessageWindow,
  sendMessage,
  sendChallenge,
  sendMemoryRecall,
  sendLeaderboardShoutout,
  sendWelcomeMessage,
  sendMenuMessage,
  sendWeeklyScorecard
};
