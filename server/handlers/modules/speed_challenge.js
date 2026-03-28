const db = require('../../db/pool');
const whatsapp = require('../../services/whatsapp');

const SPEED_TIME_LIMIT = 600; // 10 minutes in seconds

async function handle(user) {
  const conversationId = user.chatwoot_conversation_id;

  // Check if messaging window is open
  if (!await whatsapp.isWindowOpen(user.id)) return;

  // Pick a random question
  const question = await db.getOne(
    `SELECT * FROM questions WHERE is_active = true ORDER BY RANDOM() LIMIT 1`
  );

  if (!question) {
    console.error('Speed challenge: no questions available');
    return;
  }

  await whatsapp.sendMessage(conversationId,
    `\u26A1 *SPEED CHALLENGE!* Answer in 10 minutes for 5 bonus points!\n\n${question.question_text}`
  );

  await db.query(
    `INSERT INTO user_sessions (user_id, question_id, sent_at, session_date, session_type)
     VALUES ($1, $2, NOW(), CURRENT_DATE, 'speed')`,
    [user.id, question.id]
  );
}

async function sendSpeedChallenges() {
  // Get all active users with onboarding complete
  const users = await db.getMany(
    `SELECT * FROM users WHERE is_active = true AND onboarding_complete = true`
  );

  if (users.length === 0) return;

  // Randomly select ~20% of active users
  const subset = users.filter(() => Math.random() < 0.2);

  console.log(`Speed challenge: sending to ${subset.length}/${users.length} users`);

  for (const user of subset) {
    try {
      await handle(user);
    } catch (err) {
      console.error(`Speed challenge error for user ${user.id}:`, err.message);
    }
  }
}

module.exports = { handle, sendSpeedChallenges, SPEED_TIME_LIMIT };
