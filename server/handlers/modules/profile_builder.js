const db = require('../../db/pool');
const whatsapp = require('../../services/whatsapp');

const PROFILE_QUESTIONS = [
  { key: 'birthday', question: '🎂 When is your birthday? (DD/MM format)', parse: parseDateDDMM },
  { key: 'gender', question: '👤 What is your gender?\n\n*1* Male\n*2* Female\n*3* Other', parse: parseGender },
  { key: 'marital_status', question: '💍 What is your relationship status?\n\n*1* Single\n*2* Married\n*3* In a relationship', parse: parseMarital },
  { key: 'profession', question: '💼 What is your profession/occupation?', parse: parseText },
  { key: 'interests', question: '🎯 What are your interests? (e.g. sports, music, cooking, reading)', parse: parseText },
  { key: 'anniversary', question: '💑 When is your anniversary? (DD/MM format, or type SKIP)', parse: parseDateOrSkip },
];

function parseDateDDMM(msg) {
  const match = msg.match(/(\d{1,2})[\/\-](\d{1,2})/);
  if (!match) return null;
  const day = parseInt(match[1]);
  const month = parseInt(match[2]);
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;
  return `2000-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
}

function parseGender(msg) {
  const m = msg.trim();
  if (m === '1' || m.toLowerCase() === 'male') return 'male';
  if (m === '2' || m.toLowerCase() === 'female') return 'female';
  if (m === '3') return 'other';
  return null;
}

function parseMarital(msg) {
  const m = msg.trim();
  if (m === '1' || m.toLowerCase() === 'single') return 'single';
  if (m === '2' || m.toLowerCase() === 'married') return 'married';
  if (m === '3') return 'relationship';
  return null;
}

function parseText(msg) {
  const t = msg.trim();
  return t.length > 0 ? t.substring(0, 200) : null;
}

function parseDateOrSkip(msg) {
  if (msg.trim().toLowerCase() === 'skip') return 'SKIP';
  return parseDateDDMM(msg);
}

async function handle(user, message, conversationId) {
  const state = user.module_state;
  if (!state || state.module !== 'profile_build') {
    return await startProfileBuild(user, conversationId);
  }
  return await processProfileAnswer(user, message, conversationId, state);
}

async function startProfileBuild(user, conversationId) {
  // Find first missing profile field
  const idx = await findNextMissingField(user);
  if (idx === -1) {
    await whatsapp.sendMessage(conversationId, '✅ Your profile is complete! This helps us personalise your brain training experience.');
    return;
  }

  await db.query("UPDATE users SET module_state = $1 WHERE id = $2", [
    JSON.stringify({ module: 'profile_build', step: idx }), user.id
  ]);
  await whatsapp.sendMessage(conversationId, PROFILE_QUESTIONS[idx].question);
}

async function processProfileAnswer(user, message, conversationId, state) {
  const idx = state.step;
  const pq = PROFILE_QUESTIONS[idx];
  const parsed = pq.parse(message);

  if (parsed === null) {
    await whatsapp.sendMessage(conversationId, 'Sorry, I didn\'t understand that. ' + pq.question);
    return;
  }

  // Save to user profile
  if (parsed !== 'SKIP') {
    if (['birthday', 'anniversary'].includes(pq.key)) {
      await db.query(`UPDATE users SET ${pq.key} = $1 WHERE id = $2`, [parsed, user.id]);
    } else {
      await db.query(`UPDATE users SET ${pq.key} = $1 WHERE id = $2`, [parsed, user.id]);
    }
  }

  // Find next missing field
  const updatedUser = await db.getOne('SELECT * FROM users WHERE id = $1', [user.id]);
  const nextIdx = await findNextMissingFieldFromUser(updatedUser, idx + 1);

  if (nextIdx === -1) {
    await db.query("UPDATE users SET module_state = NULL, profile_step = 'complete' WHERE id = $1", [user.id]);
    await whatsapp.sendMessage(conversationId, '🎉 *Profile complete!* We\'ll use this to personalise your brain training.\n\nType *MENU* to continue.');
    return;
  }

  await db.query("UPDATE users SET module_state = $1 WHERE id = $2", [
    JSON.stringify({ module: 'profile_build', step: nextIdx }), user.id
  ]);
  await whatsapp.sendMessage(conversationId, '✅ Saved!\n\n' + PROFILE_QUESTIONS[nextIdx].question);
}

async function findNextMissingField(user) {
  return findNextMissingFieldFromUser(user, 0);
}

function findNextMissingFieldFromUser(user, startIdx) {
  for (let i = startIdx; i < PROFILE_QUESTIONS.length; i++) {
    const key = PROFILE_QUESTIONS[i].key;
    if (!user[key]) return i;
  }
  return -1;
}

// Send daily mood check - called from scheduler
async function sendMoodCheck(user) {
  if (!await whatsapp.isWindowOpen(user.id)) return;
  await whatsapp.sendMessage(user.chatwoot_conversation_id,
    '🌅 *Good morning!* How are you feeling today?\n\n*1* 😊 Great\n*2* 😐 Okay\n*3* 😔 Not great\n*4* 😤 Stressed'
  );
  await db.query("UPDATE users SET module_state = $1 WHERE id = $2", [
    JSON.stringify({ module: 'mood_check' }), user.id
  ]);
}

async function handleMoodResponse(user, message, conversationId) {
  const moods = { '1': 'great', '2': 'okay', '3': 'low', '4': 'stressed' };
  const mood = moods[message.trim()] || message.trim().toLowerCase();

  await db.query("UPDATE users SET daily_mood = $1, module_state = NULL WHERE id = $2", [mood, user.id]);

  const responses = {
    'great': '😊 Awesome! Let\'s channel that energy into today\'s challenge!',
    'okay': '😐 That\'s fine! A brain workout might be just what you need.',
    'low': '😔 Sorry to hear that. Brain exercises can actually help boost your mood!',
    'stressed': '😤 Deep breath! Let\'s take your mind off stress with a fun challenge.'
  };

  await whatsapp.sendMessage(conversationId, responses[mood] || '👍 Got it! Let\'s go!');
}

module.exports = { handle, sendMoodCheck, handleMoodResponse };
