const db = require('../db/pool');
const whatsapp = require('../services/whatsapp');
const scoring = require('../services/scoring');
const claude = require('../services/claude');
const brainAge = require('./modules/brain_age');
const iqTest = require('./modules/iq_test');
const friendDuel = require('./modules/friend_duel');
const badges = require('./modules/badges');
const leaderboard = require('./modules/leaderboard');
const brainHealth = require('./modules/brain_health');

async function handleCommand(user, message, conversationId) {
  const cmd = message.trim().toUpperCase();

  // Check if user is in a module flow
  if (user.module_state && user.module_state.module) {
    return await handleModuleResponse(user, message, conversationId);
  }

  if (cmd === 'MENU') {
    await whatsapp.sendMenuMessage(conversationId);
    return true;
  }

  if (cmd === 'STATS') {
    return await handleStats(user, conversationId);
  }

  if (cmd === 'HINT') {
    return await handleHint(user, conversationId);
  }

  if (cmd === 'PAUSE') {
    await db.query('UPDATE users SET is_active = false WHERE id = $1', [user.id]);
    await whatsapp.sendMessage(conversationId, '⏸️ Daily challenges paused. Type *RESUME* anytime to restart.');
    return true;
  }

  if (cmd === 'RESUME') {
    await db.query('UPDATE users SET is_active = true WHERE id = $1', [user.id]);
    await whatsapp.sendMessage(conversationId, '▶️ Welcome back! Your daily challenges will resume at your scheduled time.');
    return true;
  }

  if (cmd === 'LEVEL') {
    await whatsapp.sendMessage(conversationId,
      '📈 *Change Difficulty*\n\nReply:\n*1* - Easy\n*2* - Medium\n*3* - Hard'
    );
    await db.query("UPDATE users SET module_state = $1 WHERE id = $2", [
      JSON.stringify({ module: 'level_change', step: 0 }), user.id
    ]);
    return true;
  }

  if (cmd === 'PREMIUM') {
    return await handlePremium(user, conversationId);
  }

  if (cmd === 'BRAIN AGE' || cmd === 'BRAINAGE') {
    await brainAge.handle(user, message, conversationId);
    return true;
  }

  if (cmd === 'IQ') {
    await iqTest.handle(user, message, conversationId);
    return true;
  }

  if (cmd.startsWith('DUEL ')) {
    await friendDuel.handle(user, message, conversationId);
    return true;
  }

  if (cmd === 'LEADERBOARD') {
    await leaderboard.handle(user, message, conversationId);
    return true;
  }

  if (cmd === 'BADGES') {
    await badges.handle(user, message, conversationId);
    return true;
  }

  if (cmd === 'REPORT') {
    await whatsapp.sendWeeklyScorecard(user);
    return true;
  }

  if (cmd === 'STOP') {
    await db.query('UPDATE users SET is_active = false WHERE id = $1', [user.id]);
    await whatsapp.sendMessage(conversationId,
      '🛑 You have been unsubscribed from BrainPing. All your data will be retained for 30 days.\n\nWe\'ll miss you! Type the trigger keyword anytime to rejoin.'
    );
    return true;
  }

  if (cmd === 'PROFILE') {
    const profileBuilder = require('./modules/profile_builder');
    await profileBuilder.handle(user, message, conversationId);
    return true;
  }

  if (cmd === 'BRAIN HEALTH' || cmd === 'HEALTH') {
    await brainHealth.handle(user, message, conversationId);
    return true;
  }

  if (cmd === 'MODULES' || cmd === 'MODULE' || cmd === 'EXPLORE') {
    return await handleModulesMenu(user, conversationId);
  }

  // Catch common module-related words
  if (cmd.startsWith('MODULE') || cmd === 'TEST' || cmd === 'CHALLENGE' || cmd === 'PLAY') {
    return await handleModulesMenu(user, conversationId);
  }

  return false; // Not a command
}

async function handleModuleResponse(user, message, conversationId) {
  const state = user.module_state;

  if (state.module === 'brain_age') {
    await brainAge.handle(user, message, conversationId);
    return true;
  }

  if (state.module === 'iq_test') {
    await iqTest.handle(user, message, conversationId);
    return true;
  }

  if (state.module === 'level_change') {
    return await handleLevelChange(user, message, conversationId);
  }

  if (state.module === 'duel') {
    await friendDuel.handle(user, message, conversationId);
    return true;
  }

  if (state.module === 'module_select') {
    return await handleModuleChoice(user, message, conversationId);
  }

  if (state.module === 'mood_check') {
    const profileBuilder = require('./modules/profile_builder');
    await profileBuilder.handleMoodResponse(user, message, conversationId);
    return true;
  }

  if (state.module === 'profile_build') {
    const profileBuilder = require('./modules/profile_builder');
    await profileBuilder.handle(user, message, conversationId);
    return true;
  }

  return false;
}

async function handleStats(user, conversationId) {
  const stats = await scoring.getUserStats(user.id);
  let msg = `📊 *Your BrainPing Stats*\n\n`;
  msg += `🔥 Current Streak: ${stats.streak} days\n`;
  msg += `🏆 Longest Streak: ${stats.longestStreak} days\n`;
  msg += `💰 Total Points: ${stats.totalPoints}\n`;
  msg += `📈 This Week: ${stats.weeklyPoints} pts\n`;
  msg += `🎯 Accuracy: ${stats.accuracy}%\n`;
  msg += `📝 Questions Answered: ${stats.questionsAnswered}\n`;

  if (user.brain_age_score) msg += `🧠 Brain Age: ${user.brain_age_score}\n`;
  if (user.iq_estimate_score) msg += `🧩 IQ Estimate: ${user.iq_estimate_score}\n`;
  if (user.cognitive_style) msg += `💡 Cognitive Style: ${user.cognitive_style}\n`;

  await whatsapp.sendMessage(conversationId, msg);
  return true;
}

async function handleHint(user, conversationId) {
  const session = await db.getOne(
    `SELECT us.id, q.hint_text, q.question_text, q.answer
     FROM user_sessions us JOIN questions q ON us.question_id = q.id
     WHERE us.user_id = $1 AND us.answered_at IS NULL
     ORDER BY us.sent_at DESC LIMIT 1`,
    [user.id]
  );

  if (!session) {
    await whatsapp.sendMessage(conversationId, "You don't have a pending challenge right now.");
    return true;
  }

  await db.query('UPDATE user_sessions SET hint_used = true WHERE id = $1', [session.id]);

  let hint = session.hint_text;
  if (!hint) {
    try {
      hint = await claude.generateHint(session.question_text, session.answer);
    } catch (err) {
      hint = "Think carefully about the question. Sometimes the answer is simpler than you think!";
    }
  }

  await whatsapp.sendMessage(conversationId, `💡 *Hint* (-1 point):\n\n${hint}`);
  return true;
}

async function handlePremium(user, conversationId) {
  const plans = await db.getMany('SELECT * FROM plans WHERE is_active = true ORDER BY price_inr');
  let msg = '⭐ *BrainPing Plans*\n\n';

  plans.forEach(plan => {
    const current = user.plan_id === plan.id ? ' ← Current' : '';
    msg += `*${plan.name}* - ₹${plan.price_inr}/month${current}\n`;
    msg += `  • ${plan.challenges_per_day} challenge${plan.challenges_per_day > 1 ? 's' : ''}/day\n`;
    if (plan.has_analytics) msg += '  • Advanced analytics\n';
    if (plan.has_special_modules) msg += '  • All special modules\n';
    if (plan.has_kids_mode) msg += '  • Kids mode\n';
    msg += '\n';
  });

  msg += 'Contact us to upgrade your plan!';
  await whatsapp.sendMessage(conversationId, msg);
  return true;
}

async function handleLevelChange(user, message, conversationId) {
  const difficulties = { '1': 'easy', '2': 'medium', '3': 'hard' };
  const msg = message.trim().toLowerCase();

  let difficulty;
  if (difficulties[msg]) {
    difficulty = difficulties[msg];
  } else if (['easy', 'medium', 'hard'].includes(msg)) {
    difficulty = msg;
  } else {
    await whatsapp.sendMessage(conversationId, 'Please reply *1* (Easy), *2* (Medium), or *3* (Hard).');
    return true;
  }

  await db.query('UPDATE users SET difficulty = $1, module_state = NULL WHERE id = $2', [difficulty, user.id]);
  await whatsapp.sendMessage(conversationId, `✅ Difficulty changed to *${difficulty}*. Your next challenge will match this level.`);
  return true;
}

async function handleModulesMenu(user, conversationId) {
  let msg = '🧠 *BrainPing Special Modules*\n\n';
  msg += 'Reply with the number to start:\n\n';
  msg += '*1* 🧠 Brain Age Test — How old is your brain?\n';
  msg += '*2* 🧩 IQ Estimation — Test your IQ range\n';
  msg += '*3* ⚡ Speed Challenge — Quick-fire bonus round\n';
  msg += '*4* ⚔️ Friend Duel — Challenge a friend\n';
  msg += '*5* 💡 Cognitive Profile — Discover your thinking style\n';
  msg += '*6* 📊 Brain Health — Your brain fitness score\n';
  msg += '*7* 🏆 Leaderboard — See top performers\n';
  msg += '*8* 🏅 Badges — View achievements\n';
  msg += '\n💡 Type *MENU* for all commands';

  await db.query("UPDATE users SET module_state = $1 WHERE id = $2", [
    JSON.stringify({ module: 'module_select', step: 0 }), user.id
  ]);
  await whatsapp.sendMessage(conversationId, msg);
  return true;
}

async function handleModuleChoice(user, message, conversationId) {
  const choice = message.trim();
  await db.query("UPDATE users SET module_state = NULL WHERE id = $1", [user.id]);

  switch (choice) {
    case '1': await brainAge.handle(user, message, conversationId); return true;
    case '2': await iqTest.handle(user, message, conversationId); return true;
    case '3':
      const speed = require('./modules/speed_challenge');
      await speed.handle(user);
      return true;
    case '4':
      await whatsapp.sendMessage(conversationId, 'To duel, type: *DUEL +91XXXXXXXXXX*');
      return true;
    case '5':
      const cogProfile = require('./modules/cognitive_profile');
      await cogProfile.handle(user, message, conversationId);
      return true;
    case '6':
      await brainHealth.handle(user, message, conversationId);
      return true;
    case '7':
      await leaderboard.handle(user, message, conversationId);
      return true;
    case '8':
      await badges.handle(user, message, conversationId);
      return true;
    default:
      await whatsapp.sendMessage(conversationId, 'Please reply with a number 1-8.');
      await db.query("UPDATE users SET module_state = $1 WHERE id = $2", [
        JSON.stringify({ module: 'module_select', step: 0 }), user.id
      ]);
      return true;
  }
}

module.exports = { handleCommand };
