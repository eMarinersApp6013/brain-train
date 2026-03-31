const db = require('../../db/pool');
const whatsapp = require('../../services/whatsapp');

const FUN_FACTS = [
  { question: 'Which animal can sleep for 3 years? 🐌', answer: 'Snail', fact: 'Snails can sleep for up to 3 years in hibernation!' },
  { question: 'How many hearts does an octopus have? 🐙', answer: '3', fact: '2 pump blood to gills, 1 pumps to the rest of the body!' },
  { question: 'What percentage of your brain is water? 🧠', answer: '75%', fact: 'Dehydration can temporarily shrink your brain!' },
  { question: 'How many thoughts does the average brain have per day?', answer: '60,000-80,000', fact: 'Training helps make them count!' },
  { question: 'How fast do brain signals travel? ⚡', answer: '268 mph', fact: 'Faster than a Formula 1 car!' },
  { question: 'Which fruit floats in water? 🍎', answer: 'Apple', fact: 'Apples are 25% air — that\'s why bobbing for apples works!' },
  { question: 'How long would it take to walk to the Moon? 🌙', answer: 'About 9 years', fact: 'At 5 km/h it would take roughly 9 years!' },
  { question: 'Never take seashells from beaches — do you know why? 🐚', answer: 'They protect coastlines', fact: 'Seashells prevent erosion, provide homes for hermit crabs, and support the ecosystem. Many beaches are shrinking because of shell collecting!' },
  { question: 'How does a CD store data? 💿', answer: 'Tiny pits and bumps', fact: 'A laser reads microscopic pits (0.5 microns) burned into the disc surface. A single CD has a spiral track 5km long!' },
  { question: 'How do you calm down after a stressful day? 😮‍💨', answer: 'Box breathing (4-4-4-4)', fact: 'Navy SEALs use "box breathing": inhale 4 sec, hold 4 sec, exhale 4 sec, hold 4 sec. It activates your parasympathetic nervous system in 90 seconds!' },
  { question: 'What\'s the smallest country in the world? 🌍', answer: 'Vatican City', fact: 'Just 0.44 sq km — smaller than most parks!' },
  { question: 'At what age does the brain stop growing?', answer: '25', fact: 'The prefrontal cortex (decision-making) doesn\'t fully develop until 25!' },
  { question: 'What country has the most languages? 🗣️', answer: 'Papua New Guinea (840+)', fact: 'More than any other country — including India!' },
  { question: 'Which planet spins the fastest? 🪐', answer: 'Jupiter', fact: 'One rotation in just 10 hours despite being the largest planet!' },
  { question: 'How many bones does a baby have? 👶', answer: '300 (adults have 206)', fact: 'Some bones fuse together as you grow!' },
  { question: 'NASA recently discovered water on which celestial body? 🌊', answer: 'Mars and Moon', fact: 'Ice water has been confirmed on both Mars and the Moon\'s south pole!' },
  { question: 'What\'s the Hubble Space Telescope\'s greatest discovery? 🔭', answer: 'Universe is expanding faster than expected', fact: 'This discovery won the 2011 Nobel Prize and changed our understanding of the cosmos!' },
  { question: 'A true story: A man survived 76 days lost at sea on a raft. Who was he?', answer: 'Steven Callahan (1982)', fact: 'He survived by catching fish and collecting rainwater. His book "Adrift" became a survival classic!' },
  { question: 'How many steps should you walk daily for brain health? 🚶', answer: '7,000-10,000', fact: 'A 2025 study found even 4,000 steps/day reduces dementia risk by 25%!' }
];

async function sendEveningBet(user) {
  if (!await whatsapp.isWindowOpen(user.id)) return;
  if (await whatsapp.isTestModeBlocked(user.phone)) return;

  const fact = FUN_FACTS[Math.floor(Math.random() * FUN_FACTS.length)];
  await db.query("UPDATE users SET module_state = $1 WHERE id = $2", [
    JSON.stringify({ module: 'evening_bet', answer: fact.answer, fact: fact.fact }), user.id
  ]);
  await whatsapp.sendMessage(user.chatwoot_conversation_id,
    `🎲 *Evening Brain Teaser!*\n\n❓ ${fact.question}\n\nThink you know?\nReply *YES* to see the answer! 🧠`
  );
}

async function handleBetResponse(user, message, conversationId, state) {
  await db.query("UPDATE users SET module_state = NULL WHERE id = $1", [user.id]);
  const msg = message.trim().toUpperCase();
  if (msg === 'YES' || msg === 'Y') {
    await whatsapp.sendMessage(conversationId, `✨ *Answer:* ${state.answer}\n\n📚 ${state.fact}\n\n_See you tomorrow! 🧠_`);
  } else {
    await whatsapp.sendMessage(conversationId, `🤔 Interesting guess!\n\n✨ *Answer:* ${state.answer}\n\n📚 ${state.fact}\n\n_Good night! 🌙_`);
  }
}

async function sendEveningBets() {
  const users = await db.getMany("SELECT * FROM users WHERE is_active = true AND onboarding_step = 'complete'");
  for (const user of users) {
    try {
      if (await whatsapp.isTestModeBlocked(user.phone)) continue;
      await sendEveningBet(user);
      await new Promise(r => setTimeout(r, 300));
    } catch (err) { console.error(`Evening bet error ${user.id}:`, err.message); }
  }
}

module.exports = { sendEveningBet, handleBetResponse, sendEveningBets };
