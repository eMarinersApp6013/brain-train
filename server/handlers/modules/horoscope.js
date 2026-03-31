const db = require('../../db/pool');
const whatsapp = require('../../services/whatsapp');
const claude = require('../../services/claude');

const ZODIAC_SIGNS = {
  aries: { emoji: '♈', dates: 'Mar 21 - Apr 19', hindi: 'मेष' },
  taurus: { emoji: '♉', dates: 'Apr 20 - May 20', hindi: 'वृषभ' },
  gemini: { emoji: '♊', dates: 'May 21 - Jun 20', hindi: 'मिथुन' },
  cancer: { emoji: '♋', dates: 'Jun 21 - Jul 22', hindi: 'कर्क' },
  leo: { emoji: '♌', dates: 'Jul 23 - Aug 22', hindi: 'सिंह' },
  virgo: { emoji: '♍', dates: 'Aug 23 - Sep 22', hindi: 'कन्या' },
  libra: { emoji: '♎', dates: 'Sep 23 - Oct 22', hindi: 'तुला' },
  scorpio: { emoji: '♏', dates: 'Oct 23 - Nov 21', hindi: 'वृश्चिक' },
  sagittarius: { emoji: '♐', dates: 'Nov 22 - Dec 21', hindi: 'धनु' },
  capricorn: { emoji: '♑', dates: 'Dec 22 - Jan 19', hindi: 'मकर' },
  aquarius: { emoji: '♒', dates: 'Jan 20 - Feb 18', hindi: 'कुंभ' },
  pisces: { emoji: '♓', dates: 'Feb 19 - Mar 20', hindi: 'मीन' }
};

function getSignFromBirthday(birthday) {
  if (!birthday) return null;
  const d = new Date(birthday);
  const month = d.getMonth() + 1, day = d.getDate();
  if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) return 'aries';
  if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) return 'taurus';
  if ((month === 5 && day >= 21) || (month === 6 && day <= 20)) return 'gemini';
  if ((month === 6 && day >= 21) || (month === 7 && day <= 22)) return 'cancer';
  if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) return 'leo';
  if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) return 'virgo';
  if ((month === 9 && day >= 23) || (month === 10 && day <= 22)) return 'libra';
  if ((month === 10 && day >= 23) || (month === 11 && day <= 21)) return 'scorpio';
  if ((month === 11 && day >= 22) || (month === 12 && day <= 21)) return 'sagittarius';
  if ((month === 12 && day >= 22) || (month === 1 && day <= 19)) return 'capricorn';
  if ((month === 1 && day >= 20) || (month === 2 && day <= 18)) return 'aquarius';
  return 'pisces';
}

async function handle(user, message, conversationId) {
  const state = user.module_state;
  if (state && state.module === 'horoscope_setup') {
    return await handleSignSelection(user, message, conversationId);
  }

  let sign = user.horoscope_sign;
  if (!sign && user.birthday) {
    sign = getSignFromBirthday(user.birthday);
    if (sign) await db.query('UPDATE users SET horoscope_sign = $1 WHERE id = $2', [sign, user.id]);
  }
  if (!sign) return await askForSign(user, conversationId);
  await sendHoroscope(user, sign, conversationId);
}

async function askForSign(user, conversationId) {
  let msg = '🔮 *Daily Horoscope*\n\nWhat\'s your zodiac sign (राशि)?\n\n';
  Object.entries(ZODIAC_SIGNS).forEach(([name, info], i) => {
    msg += `*${i + 1}* ${info.emoji} ${name.charAt(0).toUpperCase() + name.slice(1)} (${info.hindi})\n`;
  });
  await db.query("UPDATE users SET module_state = $1 WHERE id = $2", [
    JSON.stringify({ module: 'horoscope_setup' }), user.id
  ]);
  await whatsapp.sendMessage(conversationId, msg);
}

async function handleSignSelection(user, message, conversationId) {
  const signNames = Object.keys(ZODIAC_SIGNS);
  const num = parseInt(message.trim());
  let sign;
  if (num >= 1 && num <= 12) sign = signNames[num - 1];
  else {
    sign = message.trim().toLowerCase();
    if (!ZODIAC_SIGNS[sign]) { await whatsapp.sendMessage(conversationId, 'Please reply 1-12 or type your sign name.'); return; }
  }
  await db.query('UPDATE users SET horoscope_sign = $1, module_state = NULL WHERE id = $2', [sign, user.id]);
  await sendHoroscope(user, sign, conversationId);
}

async function sendHoroscope(user, sign, conversationId) {
  const info = ZODIAC_SIGNS[sign];
  if (!info) return;
  const signName = sign.charAt(0).toUpperCase() + sign.slice(1);
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  try {
    const { client, model } = await claude.getClient();
    const response = await client.messages.create({
      model, max_tokens: 300,
      system: 'Write a brief positive daily horoscope (3-4 sentences). Include a brain/learning tip naturally. Include a lucky number and mood word. Keep it encouraging. No negative predictions.',
      messages: [{ role: 'user', content: `Horoscope for ${sign} (${info.hindi}) on ${today}. Include brain training motivation.` }]
    });
    const horoscope = response.content[0].text.trim();
    await whatsapp.sendMessage(conversationId, `🔮 *${info.emoji} ${signName} (${info.hindi})*\n📅 ${today}\n\n${horoscope}`);
  } catch (err) {
    console.error('Horoscope error:', err.message);
    await whatsapp.sendMessage(conversationId, `🔮 *${info.emoji} ${signName}*\n\nToday is a great day for learning! Your mind is sharp and ready for challenges. Try something new — your brain will thank you.\n\n🧠 Brain tip: Spend 5 minutes learning one new thing today.`);
  }
}

module.exports = { handle, sendHoroscope, getSignFromBirthday, ZODIAC_SIGNS };
