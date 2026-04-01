const db = require('../../db/pool');
const whatsapp = require('../../services/whatsapp');

// Difficulty levels
const LEVELS = {
  '1-back': { n: 1, items: 10, label: '1-Back (Beginner)' },
  '2-back': { n: 2, items: 12, label: '2-Back (Intermediate)' },
  '3-back': { n: 3, items: 15, label: '3-Back (Advanced)' }
};

function generateSequence(length) {
  const pool = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  return Array.from({ length }, () => pool[Math.floor(Math.random() * pool.length)]);
}

async function handle(user, message, conversationId) {
  const state = user.module_state;

  if (!state || state.module !== 'nback') {
    return await startNback(user, conversationId);
  }

  if (state.step === 'select_level') {
    return await selectLevel(user, message, conversationId);
  }

  if (state.step === 'playing') {
    return await processAnswer(user, message, conversationId, state);
  }
}

async function startNback(user, conversationId) {
  await db.query("UPDATE users SET module_state = $1 WHERE id = $2", [
    JSON.stringify({ module: 'nback', step: 'select_level' }), user.id
  ]);

  let msg = '🧠 *N-Back Memory Training*\n\n';
  msg += '_The #1 scientifically proven exercise for working memory (Jaeggi et al., 2008)_\n\n';
  msg += 'I\'ll show you letters one at a time. Tell me if the current letter matches the one from N positions back.\n\n';
  msg += 'Choose your level:\n';
  msg += '*1* - 1-Back (Beginner) — match the previous letter\n';
  msg += '*2* - 2-Back (Intermediate) — match 2 letters ago\n';
  msg += '*3* - 3-Back (Advanced) — match 3 letters ago\n';

  await whatsapp.sendMessage(conversationId, msg);
}

async function selectLevel(user, message, conversationId) {
  const levels = { '1': '1-back', '2': '2-back', '3': '3-back' };
  const level = levels[message.trim()];
  if (!level) {
    await whatsapp.sendMessage(conversationId, 'Please reply 1, 2, or 3.');
    return;
  }

  const config = LEVELS[level];
  const sequence = generateSequence(config.items);

  const state = {
    module: 'nback',
    step: 'playing',
    level,
    n: config.n,
    sequence,
    currentIndex: 0,
    correct: 0,
    total: 0,
    startedAt: Date.now()
  };

  await db.query("UPDATE users SET module_state = $1 WHERE id = $2", [JSON.stringify(state), user.id]);

  let msg = `🧠 *${config.label}*\n\n`;
  msg += `I'll send ${config.items} letters. After each, reply:\n`;
  msg += `*YES* — if it matches the letter from ${config.n} position${config.n > 1 ? 's' : ''} back\n`;
  msg += `*NO* — if it doesn't match\n\n`;
  msg += `Let's begin!\n\n`;
  msg += `📌 Letter 1/${config.items}: *${sequence[0]}*`;

  // First N items can't have a match, so note that
  if (config.n >= 1) {
    msg += `\n\n_Reply YES or NO (no match possible yet for first ${config.n} item${config.n > 1 ? 's' : ''})_`;
  }

  await whatsapp.sendMessage(conversationId, msg);
}

async function processAnswer(user, message, conversationId, state) {
  const answer = message.trim().toUpperCase();
  if (answer !== 'YES' && answer !== 'NO' && answer !== 'Y' && answer !== 'N') {
    await whatsapp.sendMessage(conversationId, 'Reply *YES* or *NO*');
    return;
  }

  const userSaidYes = answer === 'YES' || answer === 'Y';
  const idx = state.currentIndex;
  const seq = state.sequence;
  const n = state.n;

  // Check if current matches N-back
  const isMatch = idx >= n && seq[idx] === seq[idx - n];
  const isCorrect = (userSaidYes && isMatch) || (!userSaidYes && !isMatch);

  if (isCorrect) state.correct++;
  state.total++;

  // Move to next
  state.currentIndex++;

  const feedback = isCorrect ? '✅' : `❌ (was ${isMatch ? 'a match' : 'no match'})`;

  if (state.currentIndex >= seq.length) {
    // Session complete
    const accuracy = Math.round((state.correct / state.total) * 100);
    const duration = Math.round((Date.now() - state.startedAt) / 1000);

    await db.query("UPDATE users SET module_state = NULL WHERE id = $1", [user.id]);

    // Save to brain_assessments
    await db.query(
      `INSERT INTO brain_assessments (user_id, assessment_type, score, result_label, completed_at)
       VALUES ($1, 'nback', $2, $3, NOW())`,
      [user.id, accuracy, `${state.level}: ${accuracy}% in ${duration}s`]
    );

    let result = `${feedback}\n\n🏁 *N-Back Complete!*\n\n`;
    result += `📊 *Results:*\n`;
    result += `✅ Correct: ${state.correct}/${state.total}\n`;
    result += `🎯 Accuracy: ${accuracy}%\n`;
    result += `⏱️ Time: ${duration}s\n\n`;

    if (accuracy >= 80) result += '🌟 Excellent! Your working memory is sharp! Try a harder level next time.';
    else if (accuracy >= 60) result += '👍 Good job! Keep practising to improve.';
    else result += '💪 Keep at it! Working memory improves with regular practice.';

    result += '\n\nType *MODULES* to try another exercise.';

    await whatsapp.sendMessage(conversationId, result);
    return;
  }

  // Send next letter
  const nextLetter = seq[state.currentIndex];
  const progress = `${state.currentIndex + 1}/${seq.length}`;

  await db.query("UPDATE users SET module_state = $1 WHERE id = $2", [JSON.stringify(state), user.id]);

  let msg = `${feedback}\n\n📌 Letter ${progress}: *${nextLetter}*`;
  if (state.currentIndex < n) {
    msg += `\n_${n - state.currentIndex} more before matches are possible_`;
  }

  await whatsapp.sendMessage(conversationId, msg);
}

module.exports = { handle };
