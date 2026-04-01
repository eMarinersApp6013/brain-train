const db = require('../../db/pool');
const whatsapp = require('../../services/whatsapp');

const MEMORY_PROMPTS = [
  { key: 'breakfast', ask: 'What did you have for breakfast today?', recall: 'What did you have for breakfast this morning?', delay: 'evening' },
  { key: 'wore', ask: 'What colour shirt/top are you wearing today?', recall: 'What colour were you wearing today?', delay: 'evening' },
  { key: 'last_movie', ask: 'What was the last movie or TV show you watched?', recall: 'What was that movie/show you told me about?', delay: '3days' },
  { key: 'yesterday_dinner', ask: 'What did you have for dinner yesterday?', recall: 'What was your dinner yesterday?', delay: 'same' },
  { key: 'weekend', ask: 'What did you do last weekend? Name 3 activities.', recall: 'You told me 3 things you did last weekend. What were they?', delay: '3days' },
  { key: 'friend_birthday', ask: 'When is your best friend\'s birthday? (DD/MM)', recall: 'When is your best friend\'s birthday?', delay: '7days' },
  { key: 'phone_numbers', ask: 'Without looking at your phone, what are the last 4 digits of your mom\'s number?', recall: 'Last time I asked you your mom\'s number digits. What were they?', delay: '7days' },
  { key: 'route', ask: 'Name 3 landmarks you pass on your daily commute/walk.', recall: 'What were those 3 landmarks from your daily route?', delay: '3days' },
  { key: 'grocery', ask: 'Name 5 items you\'d buy at the grocery store right now.', recall: 'What were those 5 grocery items you mentioned?', delay: 'evening' },
  { key: 'news', ask: 'What\'s one news story you heard about today/yesterday?', recall: 'What was that news story you mentioned?', delay: '3days' }
];

async function handle(user, message, conversationId) {
  const state = user.module_state;

  if (!state || state.module !== 'life_memory') {
    return await startLifeMemory(user, conversationId);
  }

  if (state.step === 'ask') {
    return await recordAnswer(user, message, conversationId, state);
  }

  if (state.step === 'recall') {
    return await checkRecall(user, message, conversationId, state);
  }
}

async function startLifeMemory(user, conversationId) {
  // Pick a random prompt
  const prompt = MEMORY_PROMPTS[Math.floor(Math.random() * MEMORY_PROMPTS.length)];

  await db.query("UPDATE users SET module_state = $1 WHERE id = $2", [
    JSON.stringify({ module: 'life_memory', step: 'ask', promptKey: prompt.key, recallText: prompt.recall }), user.id
  ]);

  let msg = '🧠 *Life Memory Trainer*\n\n';
  msg += '_Training your memory with YOUR real experiences — the strongest way to build memory (Craik & Tulving, 1975)_\n\n';
  msg += `❓ ${prompt.ask}\n\n_Type your answer:_`;

  await whatsapp.sendMessage(conversationId, msg);
}

async function recordAnswer(user, message, conversationId, state) {
  const answer = message.trim();
  if (answer.length < 2) {
    await whatsapp.sendMessage(conversationId, 'Please give a more detailed answer.');
    return;
  }

  // Store in profile_data
  const profileData = user.profile_data || {};
  profileData.life_memories = profileData.life_memories || {};
  profileData.life_memories[state.promptKey] = {
    answer,
    askedAt: new Date().toISOString()
  };

  await db.query("UPDATE users SET profile_data = $1, module_state = NULL WHERE id = $2",
    [JSON.stringify(profileData), user.id]);

  let msg = '✅ *Got it!* I\'ve memorised your answer.\n\n';
  msg += '🔔 I\'ll ask you to recall this later — your brain will thank you for the workout!\n\n';
  msg += '_Memory tip: Try to visualise your answer as a vivid picture. Visual memories are 6x stronger than verbal ones._\n\n';
  msg += 'Type *MODULES* for more exercises.';

  await whatsapp.sendMessage(conversationId, msg);
}

async function sendRecallChallenge(user) {
  if (!await whatsapp.isWindowOpen(user.id)) return;

  const profileData = user.profile_data || {};
  const memories = profileData.life_memories || {};

  // Find a memory to recall (at least 1 hour old)
  const keys = Object.keys(memories);
  if (keys.length === 0) return;

  const randomKey = keys[Math.floor(Math.random() * keys.length)];
  const memory = memories[randomKey];
  const prompt = MEMORY_PROMPTS.find(p => p.key === randomKey);
  if (!prompt || !memory) return;

  await db.query("UPDATE users SET module_state = $1 WHERE id = $2", [
    JSON.stringify({ module: 'life_memory', step: 'recall', promptKey: randomKey, originalAnswer: memory.answer }), user.id
  ]);

  let msg = '🔄 *Memory Recall Challenge!*\n\n';
  msg += `Earlier I asked you a question. Can you remember your answer?\n\n`;
  msg += `❓ ${prompt.recall}\n\n_Type what you remember:_`;

  await whatsapp.sendMessage(user.chatwoot_conversation_id, msg);
}

async function checkRecall(user, message, conversationId, state) {
  const recalled = message.trim().toLowerCase();
  const original = state.originalAnswer.toLowerCase();

  // Simple similarity check
  const words1 = original.split(/\s+/);
  const words2 = recalled.split(/\s+/);
  const matched = words1.filter(w => words2.some(w2 => w2.includes(w) || w.includes(w2)));
  const similarity = words1.length > 0 ? Math.round((matched.length / words1.length) * 100) : 0;

  await db.query("UPDATE users SET module_state = NULL WHERE id = $1", [user.id]);

  let msg;
  if (similarity >= 70) {
    msg = `✅ *Memory locked in!* 🔒\n\nYou recalled: _"${message.trim()}"_\nOriginal: _"${state.originalAnswer}"_\n\n🧠 Match: ${similarity}% — Your memory is working great!`;
  } else if (similarity >= 40) {
    msg = `🟡 *Partially remembered!*\n\nYou recalled: _"${message.trim()}"_\nOriginal: _"${state.originalAnswer}"_\n\n🧠 Match: ${similarity}% — Getting there! Regular practice strengthens these connections.`;
  } else {
    msg = `🔄 *Memory fading!*\n\nYou said: _"${message.trim()}"_\nOriginal was: _"${state.originalAnswer}"_\n\n💪 Don't worry — this is exactly WHY we practice! Each attempt strengthens the memory pathway.`;
  }

  msg += '\n\nType *MODULES* for more exercises.';
  await whatsapp.sendMessage(conversationId, msg);
}

module.exports = { handle, sendRecallChallenge };
