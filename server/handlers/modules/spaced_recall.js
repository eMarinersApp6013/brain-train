const db = require('../../db/pool');
const whatsapp = require('../../services/whatsapp');

async function sendRecallChallenges() {
  const users = await db.getMany(
    `SELECT * FROM users WHERE is_active = true AND onboarding_complete = true`
  );

  console.log(`Spaced recall: processing ${users.length} users`);
  let sent = 0;

  for (const user of users) {
    try {
      if (!await whatsapp.isWindowOpen(user.id)) continue;

      // Find a question they answered ~14 days ago
      const oldSession = await db.getOne(
        `SELECT us.id, q.id AS question_id, q.question_text
         FROM user_sessions us
         JOIN questions q ON q.id = us.question_id
         WHERE us.user_id = $1
           AND us.session_date = CURRENT_DATE - INTERVAL '14 days'
           AND us.answered_at IS NOT NULL
         ORDER BY RANDOM()
         LIMIT 1`,
        [user.id]
      );

      if (!oldSession) continue;

      await whatsapp.sendMessage(user.chatwoot_conversation_id,
        `\u{1F504} *Remember this one from 2 weeks ago?*\n\n${oldSession.question_text}`
      );

      await db.query(
        `INSERT INTO user_sessions (user_id, question_id, sent_at, session_date, session_type)
         VALUES ($1, $2, NOW(), CURRENT_DATE, 'recall')`,
        [user.id, oldSession.question_id]
      );

      sent++;
    } catch (err) {
      console.error(`Spaced recall error for user ${user.id}:`, err.message);
    }
  }

  console.log(`Spaced recall: sent ${sent}/${users.length}`);
}

async function handleRecallResult(user, isCorrect, conversationId) {
  if (isCorrect) {
    await whatsapp.sendMessage(conversationId, 'Memory locked in! \u{1F512}');
  } else {
    await whatsapp.sendMessage(conversationId, "Memory fading! Let's reinforce this. \u{1F4AA}");
  }
}

module.exports = { sendRecallChallenges, handleRecallResult };
