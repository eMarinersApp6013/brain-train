const db = require('../db/pool');
const whatsapp = require('../services/whatsapp');
const content = require('../services/content');

function detectCountry(phone) {
  if (phone.startsWith('+91')) return { country: 'India', code: 'IN' };
  if (phone.startsWith('+1')) return { country: 'USA', code: 'US' };
  if (phone.startsWith('+44')) return { country: 'UK', code: 'GB' };
  if (phone.startsWith('+971')) return { country: 'UAE', code: 'AE' };
  if (phone.startsWith('+966')) return { country: 'Saudi Arabia', code: 'SA' };
  if (phone.startsWith('+65')) return { country: 'Singapore', code: 'SG' };
  if (phone.startsWith('+61')) return { country: 'Australia', code: 'AU' };
  return { country: 'Unknown', code: '' };
}

async function handleOnboarding(user, message, conversationId) {
  const msg = message.trim();
  const step = user.onboarding_step;

  switch (step) {
    case 'start':
      return await stepStart(user, conversationId);

    case 'mode_select':
      return await stepModeSelect(user, msg, conversationId);

    case 'child_age':
      return await stepChildAge(user, msg, conversationId);

    case 'ask_age':
      return await stepAskAge(user, msg, conversationId);

    case 'ask_name':
      return await stepAskName(user, msg, conversationId);

    case 'time_select':
      return await stepTimeSelect(user, msg, conversationId);

    case 'difficulty_select':
      return await stepDifficultySelect(user, msg, conversationId);

    default:
      return await stepStart(user, conversationId);
  }
}

async function stepStart(user, conversationId) {
  // Detect country from phone number and update user record
  const u = await db.getOne('SELECT phone FROM users WHERE id = $1', [user.id]);
  if (u && u.phone) {
    const { country, code } = detectCountry(u.phone);
    await db.query('UPDATE users SET country = $1, country_code = $2 WHERE id = $3', [country, code, user.id]);
  }

  await db.query("UPDATE users SET onboarding_step = 'mode_select' WHERE id = $1", [user.id]);
  await whatsapp.sendWelcomeMessage(conversationId);
}

async function stepModeSelect(user, msg, conversationId) {
  if (msg === '1' || msg.toLowerCase().includes('myself') || msg.toLowerCase().includes('adult')) {
    await db.query("UPDATE users SET mode = 'adult', age_group = 'adult', onboarding_step = 'ask_age' WHERE id = $1", [user.id]);
    await whatsapp.sendMessage(conversationId,
      '🎂 *How old are you?*\n\nPlease enter your age (18-100).'
    );
  } else if (msg === '2' || msg.toLowerCase().includes('child') || msg.toLowerCase().includes('kid')) {
    await db.query("UPDATE users SET mode = 'kids', onboarding_step = 'child_age' WHERE id = $1", [user.id]);
    await whatsapp.sendMessage(conversationId,
      '👶 *How old is your child?*\n\nPlease reply with their age (6-17).'
    );
  } else {
    await whatsapp.sendMessage(conversationId,
      'Please reply *1* (for myself) or *2* (for my child).'
    );
  }
}

async function stepAskAge(user, msg, conversationId) {
  const age = parseInt(msg);
  if (isNaN(age) || age < 18 || age > 100) {
    await whatsapp.sendMessage(conversationId, 'Please enter your age (18-100).');
    return;
  }
  await db.query("UPDATE users SET age = $1, onboarding_step = 'ask_name' WHERE id = $2", [age, user.id]);
  await whatsapp.sendMessage(conversationId, '👤 *What should I call you?*\n\nPlease type your name.');
}

async function stepAskName(user, msg, conversationId) {
  const name = msg.trim().substring(0, 50);
  if (!name) {
    await whatsapp.sendMessage(conversationId, 'Please type your name.');
    return;
  }
  await db.query("UPDATE users SET name = $1, onboarding_step = 'time_select' WHERE id = $2", [name, user.id]);
  await whatsapp.sendMessage(conversationId,
    `Nice to meet you, *${name}*! 🎉\n\n⏰ *When would you like your daily challenge?*\n\nReply:\n*1* - Morning (8:00 AM)\n*2* - Afternoon (1:00 PM)\n*3* - Evening (7:00 PM)`
  );
}

async function stepChildAge(user, msg, conversationId) {
  const age = parseInt(msg);
  if (isNaN(age) || age < 6 || age > 17) {
    await whatsapp.sendMessage(conversationId, 'Please enter an age between 6 and 17.');
    return;
  }

  let ageGroup, difficulty;
  if (age >= 6 && age <= 9) {
    ageGroup = '6-9';
    difficulty = 'easy';
  } else if (age >= 10 && age <= 13) {
    ageGroup = '10-13';
    difficulty = 'medium';
  } else {
    ageGroup = '14-17';
    difficulty = 'medium';
  }

  await db.query(
    "UPDATE users SET age = $1, age_group = $2, difficulty = $3, onboarding_step = 'ask_name' WHERE id = $4",
    [age, ageGroup, difficulty, user.id]
  );

  await whatsapp.sendMessage(conversationId, '👤 *What should I call you?*\n\nPlease type your name.');
}

async function stepTimeSelect(user, msg, conversationId) {
  const timeSlots = { '1': '08:00', '2': '13:00', '3': '19:00' };
  const timeLabels = { '1': '8:00 AM', '2': '1:00 PM', '3': '7:00 PM' };

  const slot = timeSlots[msg.trim()];
  if (!slot) {
    await whatsapp.sendMessage(conversationId, 'Please reply *1*, *2*, or *3*.');
    return;
  }

  await db.query("UPDATE users SET time_slot = $1, onboarding_step = $2 WHERE id = $3", [
    slot,
    user.mode === 'kids' ? 'complete' : 'difficulty_select',
    user.id
  ]);

  if (user.mode === 'kids') {
    // Kids difficulty is auto-set based on age group
    return await completeOnboarding(user, conversationId, timeLabels[msg.trim()]);
  }

  await whatsapp.sendMessage(conversationId,
    '💪 *Choose your difficulty level:*\n\nReply:\n*1* - Easy (Warm-up pace)\n*2* - Medium (Balanced challenge)\n*3* - Hard (Brain-buster!)'
  );
}

async function stepDifficultySelect(user, msg, conversationId) {
  const difficulties = { '1': 'easy', '2': 'medium', '3': 'hard' };
  const diffLabels = { '1': 'Easy', '2': 'Medium', '3': 'Hard' };
  const key = msg.trim().toLowerCase();

  let difficulty;
  if (difficulties[key]) {
    difficulty = difficulties[key];
  } else if (['easy', 'medium', 'hard'].includes(key)) {
    difficulty = key;
  } else {
    await whatsapp.sendMessage(conversationId, 'Please reply *1* (Easy), *2* (Medium), or *3* (Hard).');
    return;
  }

  await db.query("UPDATE users SET difficulty = $1 WHERE id = $2", [difficulty, user.id]);

  const u = await db.getOne('SELECT time_slot FROM users WHERE id = $1', [user.id]);
  const timeLabel = u.time_slot === '08:00' ? '8:00 AM' : u.time_slot === '13:00' ? '1:00 PM' : '7:00 PM';

  await completeOnboarding(user, conversationId, timeLabel);
}

async function completeOnboarding(user, conversationId, timeLabel) {
  await db.query("UPDATE users SET onboarding_step = 'complete', is_active = true WHERE id = $1", [user.id]);

  const botName = await db.getSetting('BOT_NAME') || 'BrainPing';
  const updatedUser = await db.getOne('SELECT name FROM users WHERE id = $1', [user.id]);
  const name = updatedUser?.name || 'Brain Trainer';

  await whatsapp.sendMessage(conversationId,
    `✅ *Welcome aboard, ${name}!*\n\nYour daily ${botName} challenge arrives at *${timeLabel}*.\n\nBut why wait? Try one of our modules now! 👇`
  );

  // Show modules menu
  let msg = '🧠 *Available Modules:*\n\n';
  msg += '*1* 🧠 Brain Age Test — How old is your brain?\n';
  msg += '*2* 🧩 IQ Estimation — Test your IQ range\n';
  msg += '*3* ⚡ Speed Challenge — Quick-fire bonus round\n';
  msg += '*4* ⚔️ Friend Duel — Challenge a friend\n';
  msg += '*5* 💡 Cognitive Profile — Your thinking style\n';
  msg += '*6* 📊 Brain Health Score — Track fitness\n';
  msg += '*7* 🏆 Leaderboard — Top performers\n';
  msg += '*8* 🏅 Badges — Achievements\n';
  msg += '\n_Reply with a number to start, or type *MENU* for all commands._';

  await db.query("UPDATE users SET module_state = $1 WHERE id = $2", [
    JSON.stringify({ module: 'module_select', step: 0 }), user.id
  ]);
  await whatsapp.sendMessage(conversationId, msg);
}

module.exports = { handleOnboarding };
