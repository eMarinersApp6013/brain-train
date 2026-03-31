const db = require('../../db/pool');
const whatsapp = require('../../services/whatsapp');

async function handleAspiration(user, message, conversationId) {
  const state = user.module_state;
  if (!state || state.module !== 'aspiration') {
    await db.query("UPDATE users SET module_state = $1 WHERE id = $2", [
      JSON.stringify({ module: 'aspiration', step: 'ask' }), user.id
    ]);
    const msg = user.age_group === '6-9'
      ? '🌈 *Dream Big!*\n\nWhat do you want to be when you grow up? 🚀'
      : '🌟 *Future You!*\n\nWhat career or goal excites you most?';
    await whatsapp.sendMessage(conversationId, msg);
    return;
  }

  if (state.step === 'ask') {
    const aspiration = message.trim();
    await db.query("UPDATE users SET aspiration = $1, module_state = NULL WHERE id = $2", [aspiration, user.id]);
    await whatsapp.sendMessage(conversationId,
      `🎉 *${aspiration}* — that's AMAZING!\n\nEvery puzzle you solve makes your brain stronger for your dream. The skills you're building (logic, memory, speed) are exactly what successful people use every day!\n\nKeep training! 🧠💪`
    );
  }
}

async function sendEmotionalSupport(user) {
  if (!await whatsapp.isWindowOpen(user.id)) return;
  if (user.mode !== 'kids') return;

  const msgs = {
    '6-9': [
      '🌈 Remember: it\'s okay to make mistakes. That\'s how your brain learns! 🧠💪',
      '🌟 Every time you try hard, your brain grows new connections. You\'re getting smarter every day!',
      '🎈 Feeling sad? Try this: take 3 deep breaths, then think of your favorite animal. Now smile! 😊',
      '💛 You are braver than you believe, stronger than you seem, and smarter than you think!'
    ],
    '10-13': [
      '💪 Tough day? Write down 3 things that went well. Your brain remembers good stuff better when you do!',
      '🌟 Your brain is growing faster now than at any other time in life. Every challenge makes it stronger!',
      '🎯 Feeling stuck? That\'s a GOOD sign — it means you\'re challenging yourself!',
      '💛 Don\'t compare yourself to others. You have YOUR own superpowers!'
    ],
    '14-17': [
      '💪 Exam stress? Study 25 min, break 5. "Pomodoro" technique is backed by brain science.',
      '🧠 Your teen brain is literally built for learning. Connections you make now last a lifetime!',
      '🌟 Feeling overwhelmed? Break big tasks into tiny steps. Your brain handles small chunks better.',
      '💛 It\'s okay to not have everything figured out. The smartest people are always learning.'
    ]
  };
  const list = msgs[user.age_group] || msgs['10-13'];
  await whatsapp.sendMessage(user.chatwoot_conversation_id, list[Math.floor(Math.random() * list.length)]);
}

module.exports = { handleAspiration, sendEmotionalSupport };
