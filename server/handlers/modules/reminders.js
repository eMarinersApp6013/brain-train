const db = require('../../db/pool');
const whatsapp = require('../../services/whatsapp');

async function handle(user, message, conversationId) {
  const state = user.module_state;
  if (!state || state.module !== 'set_reminder') {
    return await startReminder(user, conversationId);
  }
  if (state.step === 'ask_text') return await setReminderText(user, message, conversationId);
  if (state.step === 'ask_time') return await setReminderTime(user, message, conversationId, state);
}

async function startReminder(user, conversationId) {
  await db.query("UPDATE users SET module_state = $1 WHERE id = $2", [
    JSON.stringify({ module: 'set_reminder', step: 'ask_text' }), user.id
  ]);
  await whatsapp.sendMessage(conversationId, '⏰ *Set a Reminder*\n\nWhat would you like to be reminded about?\n\nType your reminder message:');
}

async function setReminderText(user, message, conversationId) {
  const text = message.trim();
  if (!text || text.length < 2) {
    await whatsapp.sendMessage(conversationId, 'Please type what you want to be reminded about.');
    return;
  }
  await db.query("UPDATE users SET module_state = $1 WHERE id = $2", [
    JSON.stringify({ module: 'set_reminder', step: 'ask_time', text }), user.id
  ]);
  await whatsapp.sendMessage(conversationId,
    `Got it! When should I remind you?\n\n*1* - 8:00 AM\n*2* - 10:00 AM\n*3* - 12:00 PM\n*4* - 3:00 PM\n*5* - 6:00 PM\n*6* - 9:00 PM\n\nOr type a time like *14:30*`
  );
}

async function setReminderTime(user, message, conversationId, state) {
  const opts = { '1': '08:00', '2': '10:00', '3': '12:00', '4': '15:00', '5': '18:00', '6': '21:00' };
  let time = opts[message.trim()];
  if (!time) {
    const m = message.trim().match(/^(\d{1,2}):(\d{2})$/);
    if (m && parseInt(m[1]) <= 23 && parseInt(m[2]) <= 59) {
      time = `${String(parseInt(m[1])).padStart(2, '0')}:${m[2]}`;
    }
  }
  if (!time) { await whatsapp.sendMessage(conversationId, 'Please select 1-6 or type a time like 14:30'); return; }

  await db.query('INSERT INTO reminders (user_id, reminder_text, remind_at, timezone) VALUES ($1, $2, $3, $4)',
    [user.id, state.text, time, process.env.TIMEZONE || 'Asia/Kolkata']);
  await db.query("UPDATE users SET module_state = NULL WHERE id = $1", [user.id]);

  const h = parseInt(time.split(':')[0]);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  await whatsapp.sendMessage(conversationId,
    `✅ *Reminder set!*\n\n📝 "${state.text}"\n⏰ Daily at ${h12}:${time.split(':')[1]} ${ampm}\n\nType *REMINDERS* to see all your reminders.`
  );
}

async function listReminders(user, conversationId) {
  const reminders = await db.getMany('SELECT * FROM reminders WHERE user_id = $1 AND is_active = true ORDER BY remind_at', [user.id]);
  if (reminders.length === 0) {
    await whatsapp.sendMessage(conversationId, '📋 No active reminders.\n\nType *REMIND* to set one!');
    return;
  }
  let msg = '⏰ *Your Reminders:*\n\n';
  reminders.forEach((r, i) => {
    const h = parseInt(r.remind_at.split(':')[0]);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    msg += `${i + 1}. ${h12}:${r.remind_at.split(':')[1]} ${ampm} — ${r.reminder_text}\n`;
  });
  await whatsapp.sendMessage(conversationId, msg);
}

async function checkAndSendReminders() {
  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const reminders = await db.getMany(
    `SELECT r.*, u.chatwoot_conversation_id FROM reminders r JOIN users u ON r.user_id = u.id
     WHERE r.is_active = true AND r.remind_at = $1 AND (r.last_sent_at IS NULL OR r.last_sent_at < CURRENT_DATE)`,
    [currentTime]
  );
  for (const r of reminders) {
    try {
      if (!r.chatwoot_conversation_id) continue;
      await whatsapp.sendMessage(r.chatwoot_conversation_id, `⏰ *Reminder*\n\n${r.reminder_text}`);
      await db.query('UPDATE reminders SET last_sent_at = NOW() WHERE id = $1', [r.id]);
    } catch (err) { console.error(`Reminder error ${r.id}:`, err.message); }
  }
}

module.exports = { handle, listReminders, checkAndSendReminders };
