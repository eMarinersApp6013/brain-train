const db = require('../../db/pool');
const whatsapp = require('../../services/whatsapp');
const claude = require('../../services/claude');
const { calculateProfile } = require('./cognitive_profile');

async function sendCoachMessages() {
  const users = await db.getMany(
    `SELECT * FROM users WHERE is_active = true AND onboarding_complete = true`
  );

  console.log(`Coach messages: processing ${users.length} users`);
  let sent = 0;

  for (const user of users) {
    try {
      if (!await whatsapp.isWindowOpen(user.id)) continue;

      const profile = await calculateProfile(user.id);
      const stats = await getWeekStats(user.id);

      const coachMsg = await claude.generateCoachMessage({
        name: user.name || 'there',
        weakestArea: profile ? profile.weakest : 'general',
        strongestArea: profile ? profile.strongest : 'general',
        streak: user.streak || 0,
        accuracy: stats.accuracy
      });

      await whatsapp.sendMessage(user.chatwoot_conversation_id,
        `\u{1F3CB}\uFE0F *Your Weekly Coach Tip*\n\n${coachMsg}`
      );
      sent++;
    } catch (err) {
      console.error(`Coach message error for user ${user.id}:`, err.message);
    }
  }

  console.log(`Coach messages: sent ${sent}/${users.length}`);
}

async function getWeekStats(userId) {
  const row = await db.getOne(
    `SELECT
       COUNT(*) AS total,
       COUNT(*) FILTER (WHERE is_correct = true) AS correct
     FROM user_sessions
     WHERE user_id = $1
       AND session_date >= CURRENT_DATE - INTERVAL '7 days'
       AND answered_at IS NOT NULL`,
    [userId]
  );

  return {
    total: parseInt(row.total) || 0,
    correct: parseInt(row.correct) || 0,
    accuracy: row.total > 0 ? Math.round((100 * row.correct) / row.total) : 0
  };
}

module.exports = { sendCoachMessages };
