const db = require('../../db/pool');
const whatsapp = require('../../services/whatsapp');

async function sendDailyHealthTip(user) {
  if (!await whatsapp.isWindowOpen(user.id)) return;

  let audience = 'all';
  if (user.mode === 'kids') audience = `kids-${user.age_group}`;

  const tip = await db.getOne(
    `SELECT * FROM health_tips WHERE is_active = true AND (audience = 'all' OR audience = $1) ORDER BY RANDOM() LIMIT 1`,
    [audience]
  );
  if (!tip) return;

  let msg = `💊 *Daily Health Tip*\n\n${tip.tip_text}`;
  if (tip.source) msg += `\n\n_Source: ${tip.source}_`;
  await whatsapp.sendMessage(user.chatwoot_conversation_id, msg);
}

async function sendHealthTips() {
  const users = await db.getMany("SELECT * FROM users WHERE is_active = true AND onboarding_step = 'complete'");
  for (const user of users) {
    try {
      if (await whatsapp.isTestModeBlocked(user.phone)) continue;
      await sendDailyHealthTip(user);
      await new Promise(r => setTimeout(r, 200));
    } catch (err) {
      console.error(`Health tip error for user ${user.id}:`, err.message);
    }
  }
}

module.exports = { sendDailyHealthTip, sendHealthTips };
