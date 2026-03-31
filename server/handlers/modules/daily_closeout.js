const db = require('../../db/pool');
const whatsapp = require('../../services/whatsapp');

async function sendEveningCloseout(user) {
  if (!await whatsapp.isWindowOpen(user.id)) return;
  if (await whatsapp.isTestModeBlocked(user.phone)) return;

  const sessions = await db.getMany(
    `SELECT us.is_correct, us.points_earned, q.type FROM user_sessions us JOIN questions q ON us.question_id = q.id
     WHERE us.user_id = $1 AND us.session_date = CURRENT_DATE`, [user.id]
  );
  const correct = sessions.filter(s => s.is_correct).length;
  const total = sessions.length;
  const points = sessions.reduce((sum, s) => sum + (s.points_earned || 0), 0);

  let msg = `🌙 *Good Evening, ${user.name || 'Brain Trainer'}!*\n\n`;
  if (total > 0) {
    msg += `📊 *Today:* ✅ ${correct}/${total} correct, 💰 ${points} pts, 🔥 ${user.streak} day streak\n\n`;
  }
  msg += `🤔 *How was your day?*\n\n*1* 😊 Great!\n*2* 😐 Okay\n*3* 😔 Tough\n*4* 😤 Stressful\n*5* 🎉 Amazing!`;

  await db.query("UPDATE users SET module_state = $1 WHERE id = $2", [
    JSON.stringify({ module: 'evening_closeout', step: 'mood' }), user.id
  ]);
  await whatsapp.sendMessage(user.chatwoot_conversation_id, msg);
}

async function handleCloseoutResponse(user, message, conversationId, state) {
  if (state.step === 'mood') {
    const moods = { '1': 'great', '2': 'okay', '3': 'tough', '4': 'stressed', '5': 'amazing' };
    const mood = moods[message.trim()];
    if (!mood) { await whatsapp.sendMessage(conversationId, 'Please reply 1-5.'); return; }

    await db.query("UPDATE users SET daily_mood = $1, module_state = $2 WHERE id = $3",
      [mood, JSON.stringify({ module: 'evening_closeout', step: 'gratitude', mood }), user.id]);

    const responses = { great: '😊 Wonderful!', okay: '😐 That\'s fine!', tough: '😔 Hang in there!', stressed: '😤 Take a breath.', amazing: '🎉 Awesome!' };
    await whatsapp.sendMessage(conversationId, `${responses[mood]}\n\n🙏 *Gratitude moment:* Name *one thing* you\'re grateful for today.\n\n_This simple exercise boosts happiness for up to 6 months! (Seligman, 2005)_\n\n_Type your answer or SKIP._`);
    return;
  }

  if (state.step === 'gratitude') {
    const gratitude = message.trim().toLowerCase() === 'skip' ? null : message.trim();
    await db.query(
      `INSERT INTO daily_closeout (user_id, closeout_date, mood_evening, gratitude_items) VALUES ($1, CURRENT_DATE, $2, $3)
       ON CONFLICT (user_id, closeout_date) DO UPDATE SET mood_evening = $2, gratitude_items = $3`,
      [user.id, state.mood, gratitude]
    );
    await db.query("UPDATE users SET module_state = NULL WHERE id = $1", [user.id]);

    let msg = '🌟 *Day Complete!*\n\n';
    if (gratitude) msg += `Your gratitude: _"${gratitude}"_ 💛\n\n`;
    msg += '💤 Rest well! Your brain consolidates memories during sleep.\n🧠 Tomorrow brings fresh challenges!\n\n_Good night! 🌙_';
    await whatsapp.sendMessage(conversationId, msg);
  }
}

async function sendEveningCloseouts() {
  const users = await db.getMany("SELECT * FROM users WHERE is_active = true AND onboarding_step = 'complete'");
  for (const user of users) {
    try {
      if (await whatsapp.isTestModeBlocked(user.phone)) continue;
      await sendEveningCloseout(user);
      await new Promise(r => setTimeout(r, 200));
    } catch (err) { console.error(`Closeout error ${user.id}:`, err.message); }
  }
}

module.exports = { sendEveningCloseout, handleCloseoutResponse, sendEveningCloseouts };
