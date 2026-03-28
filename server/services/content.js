const { query, getOne, getMany } = require('../db/pool');

const DAY_TYPE_MAP = {
  monday: 'logic',
  tuesday: 'words',
  wednesday: 'math',
  thursday: 'pattern',
  friday: 'memory',
  saturday: 'trivia',
  sunday: 'riddle'
};

const CHALLENGE_TYPE_LABELS = {
  monday: 'Logic Puzzle',
  tuesday: 'Word Scramble',
  wednesday: 'Math Speed Round',
  thursday: 'Pattern Recognition',
  friday: 'Memory Challenge',
  saturday: 'Trivia Blitz',
  sunday: 'Riddle'
};

const DAY_EMOJIS = {
  monday: '\u{1F9E9}',
  tuesday: '\u{1F524}',
  wednesday: '\u{1F522}',
  thursday: '\u{1F50D}',
  friday: '\u{1F9E0}',
  saturday: '\u{1F4A1}',
  sunday: '\u{2753}'
};

/**
 * Get a daily question for a user, avoiding recently seen questions.
 * Returns null if none found (caller handles AI fallback).
 */
async function getDailyQuestion(userId, dayOfWeek, difficulty, audience) {
  const type = DAY_TYPE_MAP[dayOfWeek];
  if (!type) return null;

  const question = await getOne(
    `SELECT * FROM questions
     WHERE type = $1
       AND difficulty = $2
       AND audience = $3
       AND is_active = true
       AND id NOT IN (
         SELECT question_id FROM user_sessions
         WHERE user_id = $4
           AND session_date >= CURRENT_DATE - INTERVAL '30 days'
           AND question_id IS NOT NULL
       )
     ORDER BY RANDOM()
     LIMIT 1`,
    [type, difficulty, audience, userId]
  );

  return question || null;
}

/**
 * Get a question by its ID.
 */
async function getQuestionById(id) {
  return getOne('SELECT * FROM questions WHERE id = $1', [id]);
}

/**
 * Get the day abbreviation from a Date object (mon, tue, wed, etc).
 */
function getDayType(date) {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return days[date.getDay()];
}

/**
 * Get human-readable challenge type name for a day of week.
 */
function getChallengeType(dayOfWeek) {
  return CHALLENGE_TYPE_LABELS[dayOfWeek] || 'Brain Challenge';
}

/**
 * Format a challenge message for WhatsApp delivery.
 */
function formatChallengeMessage(question, dayOfWeek, weekNum) {
  const emoji = DAY_EMOJIS[dayOfWeek] || '\u{1F9E0}';
  const challengeType = getChallengeType(dayOfWeek);
  const type = DAY_TYPE_MAP[dayOfWeek];

  let message = `${emoji} *BrainPing - ${challengeType}*\n`;
  message += `Week ${weekNum} | ${challengeType}\n\n`;
  message += `${question.question_text}\n`;

  // Type-specific instructions
  if (type === 'memory') {
    message += '\n_Read the list carefully. You\'ll be asked to recall it shortly!_';
  } else if (type === 'logic') {
    message += '\n_Think step by step. Reply with your answer._';
  } else if (type === 'words') {
    message += '\n_Unscramble the letters and reply with the word._';
  } else if (type === 'math') {
    message += '\n_Solve as fast as you can! Reply with the number._';
  } else if (type === 'pattern') {
    message += '\n_Find the pattern and reply with the next item._';
  } else if (type === 'trivia') {
    message += '\n_Reply with your answer._';
  } else if (type === 'riddle') {
    message += '\n_Think creatively! Reply with your answer._';
  }

  if (question.hint_text) {
    message += '\n\n_Type "hint" if you need a clue._';
  }

  if (question.time_limit_seconds) {
    message += `\n\u23F1 Time limit: ${question.time_limit_seconds} seconds`;
  }

  return message;
}

/**
 * Format the result message after a user answers.
 */
function formatResultMessage(isCorrect, points, streak, explanation) {
  let message = '';

  if (isCorrect) {
    message += '\u2705 *Correct!*\n';
    message += `+${points} points earned\n`;
  } else {
    message += '\u274C *Not quite!*\n';
  }

  if (streak > 1) {
    message += `\u{1F525} Streak: ${streak} days\n`;
  }

  if (explanation) {
    message += `\n\u{1F4A1} *Explanation:* ${explanation}`;
  }

  return message;
}

/**
 * Format memory recall text for WhatsApp.
 */
function formatMemoryRecallMessage(question) {
  if (!question.memory_recall_text) return null;

  let message = '\u{1F9E0} *Memory Recall Time!*\n\n';
  message += 'Now, try to remember the list from earlier.\n';
  message += `${question.memory_recall_text}\n\n`;
  message += '_Reply with the items separated by commas._';

  return message;
}

/**
 * Get week number (1-4) based on current date (week of month).
 */
function getWeekNumber() {
  const now = new Date();
  const dayOfMonth = now.getDate();
  return Math.min(4, Math.ceil(dayOfMonth / 7));
}

/**
 * Check exact answer: strip whitespace, lowercase, split correct by pipe,
 * check if any variant matches.
 */
function checkExactAnswer(correctAnswer, userAnswer) {
  const normalizedUser = userAnswer.trim().toLowerCase();
  const variants = correctAnswer.split('|').map(v => v.trim().toLowerCase());
  return variants.some(v => v === normalizedUser);
}

/**
 * Check keyword answer: split correct by pipe,
 * check if userAnswer contains any keyword.
 */
function checkKeywordAnswer(correctAnswer, userAnswer) {
  const normalizedUser = userAnswer.trim().toLowerCase();
  const keywords = correctAnswer.split('|').map(k => k.trim().toLowerCase());
  return keywords.some(k => normalizedUser.includes(k));
}

/**
 * Check MCQ answer: compare single letter, case insensitive.
 */
function checkMcqAnswer(correctAnswer, userAnswer) {
  return correctAnswer.trim().toLowerCase() === userAnswer.trim().toLowerCase();
}

/**
 * Check memory recall: split both by comma, count matches.
 * Returns { matched, total, percentage, passed }.
 */
function checkMemoryRecall(correctWords, userWords) {
  const correct = correctWords.split(',').map(w => w.trim().toLowerCase()).filter(Boolean);
  const user = userWords.split(',').map(w => w.trim().toLowerCase()).filter(Boolean);

  const matched = correct.filter(cw => user.some(uw => uw.includes(cw))).length;
  const total = correct.length;
  const percentage = total > 0 ? Math.round((matched / total) * 100) : 0;

  return {
    matched,
    total,
    percentage,
    passed: percentage >= 70
  };
}

module.exports = {
  getDailyQuestion,
  getQuestionById,
  getDayType,
  getChallengeType,
  formatChallengeMessage,
  formatResultMessage,
  formatMemoryRecallMessage,
  getWeekNumber,
  checkExactAnswer,
  checkKeywordAnswer,
  checkMcqAnswer,
  checkMemoryRecall
};
