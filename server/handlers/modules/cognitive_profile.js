const db = require('../../db/pool');
const whatsapp = require('../../services/whatsapp');

const STYLE_MAP = {
  logic: 'Logical Thinker',
  words: 'Creative Mind',
  memory: 'Memory Champion',
  math: 'Speed Demon'
};

const ALL_TYPES = ['logic', 'words', 'math', 'pattern', 'memory', 'trivia', 'riddle'];

async function handle(user, message, conversationId) {
  const profile = await calculateProfile(user.id);

  if (!profile) {
    await whatsapp.sendMessage(conversationId,
      "You need at least 7 days of activity before we can build your cognitive profile. Keep going!"
    );
    return;
  }

  await db.query('UPDATE users SET cognitive_style = $1 WHERE id = $2', [profile.style, user.id]);

  let msg = `\u{1F9E0} *Your Cognitive Profile*\n\n`;
  msg += `Style: *${profile.styleLabel}*\n\n`;
  msg += `\u{1F4CA} Accuracy by category:\n`;

  for (const type of ALL_TYPES) {
    const acc = profile.accuracy[type];
    if (acc !== undefined) {
      const bar = getBar(acc);
      msg += `${type}: ${bar} ${acc}%\n`;
    }
  }

  msg += `\n\u{1F4AA} Strongest: *${profile.strongest}*`;
  msg += `\n\u{1F3AF} Weakest: *${profile.weakest}*`;

  await whatsapp.sendMessage(conversationId, msg);
}

async function calculateProfile(userId) {
  const rows = await db.getMany(
    `SELECT q.type,
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE us.is_correct = true) AS correct
     FROM user_sessions us
     JOIN questions q ON q.id = us.question_id
     WHERE us.user_id = $1
       AND us.session_date >= CURRENT_DATE - INTERVAL '7 days'
       AND us.answered_at IS NOT NULL
     GROUP BY q.type`,
    [userId]
  );

  if (rows.length === 0) return null;

  const accuracy = {};
  let strongest = null;
  let weakest = null;
  let highestAcc = -1;
  let lowestAcc = 101;

  for (const row of rows) {
    const pct = row.total > 0 ? Math.round((100 * row.correct) / row.total) : 0;
    accuracy[row.type] = pct;

    if (pct > highestAcc) {
      highestAcc = pct;
      strongest = row.type;
    }
    if (pct < lowestAcc) {
      lowestAcc = pct;
      weakest = row.type;
    }
  }

  // Determine style
  let style, styleLabel;
  const spread = highestAcc - lowestAcc;
  if (spread <= 15 && rows.length >= 3) {
    style = 'balanced';
    styleLabel = 'Balanced Brain';
  } else if (STYLE_MAP[strongest]) {
    style = strongest;
    styleLabel = STYLE_MAP[strongest];
  } else {
    style = 'balanced';
    styleLabel = 'Balanced Brain';
  }

  return { accuracy, strongest, weakest, style, styleLabel };
}

function getBar(pct) {
  const filled = Math.round(pct / 10);
  return '\u2588'.repeat(filled) + '\u2591'.repeat(10 - filled);
}

module.exports = { handle, calculateProfile };
