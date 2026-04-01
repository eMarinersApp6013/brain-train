const db = require('../../db/pool');
const whatsapp = require('../../services/whatsapp');

const EXERCISES = [
  {
    type: 'emoji_count',
    generate: () => {
      const target = '🐱';
      const others = ['🐶', '🐸', '🐱', '🐰', '🐱', '🐶', '🐱', '🐸', '🐶', '🐱', '🐰', '🐸', '🐱', '🐶', '🐱'];
      const shuffled = others.sort(() => Math.random() - 0.5);
      const count = shuffled.filter(e => e === target).length;
      return {
        question: `🔍 *Attention Test!*\n\nCount all the 🐱 in this sequence:\n\n${shuffled.join(' ')}\n\nHow many cats? Reply with the number.`,
        answer: String(count),
        explanation: `There are ${count} cats 🐱 in the sequence.`
      };
    }
  },
  {
    type: 'letter_count',
    generate: () => {
      const letters = 'BKAEIMROSUQLNEFTDPWGHCJVXY';
      const vowels = letters.split('').filter(l => 'AEIOU'.includes(l)).length;
      return {
        question: `🔍 *Focus Challenge!*\n\nCount the VOWELS (A, E, I, O, U) in this sequence:\n\n${letters.split('').join(' ')}\n\nHow many vowels? Reply with the number.`,
        answer: String(vowels),
        explanation: `The vowels are: ${letters.split('').filter(l => 'AEIOU'.includes(l)).join(', ')} = ${vowels} vowels.`
      };
    }
  },
  {
    type: 'reading_detail',
    generate: () => {
      const stories = [
        {
          text: 'The old man walked his brown DOG past the blue HOUSE and stopped at the RED mailbox where he found THREE letters and ONE package.',
          questions: [
            { q: 'What colour was the house?', a: 'blue' },
            { q: 'How many letters were there?', a: '3|three' },
            { q: 'What animal was mentioned?', a: 'dog' }
          ]
        },
        {
          text: 'Sarah bought FIVE apples and TWO oranges from the GREEN market on TUESDAY. She paid with a 500 rupee note and got 120 rupees change.',
          questions: [
            { q: 'How many apples did Sarah buy?', a: '5|five' },
            { q: 'What day was it?', a: 'tuesday' },
            { q: 'How much change did she get?', a: '120' }
          ]
        },
        {
          text: 'Dr. Kumar arrived at the HOSPITAL at 8:30 AM driving his WHITE car. He treated SEVEN patients before lunch and FOUR after. His last patient was a 12-year-old GIRL.',
          questions: [
            { q: 'What time did Dr. Kumar arrive?', a: '8:30|8:30 am' },
            { q: 'How many patients before lunch?', a: '7|seven' },
            { q: 'What was the last patient\'s gender?', a: 'girl|female' }
          ]
        }
      ];
      const story = stories[Math.floor(Math.random() * stories.length)];
      const qIdx = Math.floor(Math.random() * story.questions.length);
      return {
        question: `🔍 *Reading Attention!*\n\nRead carefully, then answer:\n\n_"${story.text}"_\n\n❓ ${story.questions[qIdx].q}`,
        answer: story.questions[qIdx].a,
        explanation: `The answer is in the text — attention to detail is key!`
      };
    }
  },
  {
    type: 'stroop',
    generate: () => {
      const pairs = [
        { word: 'RED', colour: 'blue', answer: 'blue' },
        { word: 'GREEN', colour: 'yellow', answer: 'yellow' },
        { word: 'BLUE', colour: 'red', answer: 'red' },
        { word: 'YELLOW', colour: 'green', answer: 'green' }
      ];
      const pair = pairs[Math.floor(Math.random() * pairs.length)];
      return {
        question: `🔍 *Stroop Test!*\n\nThe word "${pair.word}" is printed in *${pair.colour}* colour.\n\n❓ What COLOUR is it printed in? (Don't read the word — name the colour!)`,
        answer: pair.answer,
        explanation: `The word says "${pair.word}" but it's printed in ${pair.colour}. The Stroop effect makes this hard because your brain wants to read the word!`
      };
    }
  },
  {
    type: 'reverse',
    generate: () => {
      const words = ['BRAIN', 'MEMORY', 'FOCUS', 'SMART', 'THINK', 'LEARN'];
      const word = words[Math.floor(Math.random() * words.length)];
      const reversed = word.split('').reverse().join('');
      return {
        question: `🔍 *Reverse Spell!*\n\nSpell this word BACKWARDS:\n\n*${word}*\n\nType the reversed word:`,
        answer: reversed.toLowerCase(),
        explanation: `${word} reversed is ${reversed}. This exercise trains working memory and attention!`
      };
    }
  }
];

async function handle(user, message, conversationId) {
  const state = user.module_state;

  if (!state || state.module !== 'attention') {
    return await startAttention(user, conversationId);
  }

  if (state.step === 'answering') {
    return await checkAnswer(user, message, conversationId, state);
  }
}

async function startAttention(user, conversationId) {
  const exercise = EXERCISES[Math.floor(Math.random() * EXERCISES.length)];
  const generated = exercise.generate();

  await db.query("UPDATE users SET module_state = $1 WHERE id = $2", [
    JSON.stringify({
      module: 'attention',
      step: 'answering',
      answer: generated.answer,
      explanation: generated.explanation,
      exerciseType: exercise.type,
      sentAt: Date.now()
    }), user.id
  ]);

  await whatsapp.sendMessage(conversationId, generated.question);
}

async function checkAnswer(user, message, conversationId, state) {
  const userAnswer = message.trim().toLowerCase();
  const correctAnswers = state.answer.toLowerCase().split('|');
  const isCorrect = correctAnswers.some(a => userAnswer.includes(a) || a.includes(userAnswer));
  const responseTime = Math.round((Date.now() - state.sentAt) / 1000);

  await db.query("UPDATE users SET module_state = NULL WHERE id = $1", [user.id]);

  let msg;
  if (isCorrect) {
    msg = `✅ *Correct!* (${responseTime}s)\n\n${state.explanation}\n\n`;
    msg += responseTime < 10 ? '⚡ Lightning fast! Your attention is razor sharp!' :
           responseTime < 30 ? '👍 Good focus!' : '🧠 Correct! Try to be faster next time.';
  } else {
    msg = `❌ *Not quite!*\n\nCorrect answer: ${state.answer.split('|')[0]}\n\n${state.explanation}`;
  }

  msg += '\n\nType *MODULES* for more exercises.';
  await whatsapp.sendMessage(conversationId, msg);
}

module.exports = { handle };
