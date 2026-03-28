const db = require('../../db/pool');
const whatsapp = require('../../services/whatsapp');

const BADGE_LIST = [
  { type: 'streak_7',       emoji: '\u{1F525}',               label: '7-Day Streak' },
  { type: 'streak_30',      emoji: '\u{1F525}\u{1F525}',           label: '30-Day Streak' },
  { type: 'streak_100',     emoji: '\u{1F525}\u{1F525}\u{1F525}',       label: '100-Day Streak' },
  { type: 'perfect_week',   emoji: '\u2B50',               label: 'Perfect Week' },
  { type: 'speed_demon',    emoji: '\u26A1',               label: 'Speed Demon' },
  { type: 'brain_age_test', emoji: '\u{1F9E0}',               label: 'Brain Explorer' },
  { type: 'top_3',          emoji: '\u{1F3C6}',               label: 'Top 3 Finish' },
  { type: 'recall_master',  emoji: '\u{1F9E9}',               label: 'Recall Master' }
];

async function handle(user, message, conversationId) {
  const achievements = await db.getMany(
    'SELECT badge_type, earned_at FROM achievements WHERE user_id = $1',
    [user.id]
  );

  const earnedSet = new Set(achievements.map(a => a.badge_type));

  let msg = '\u{1F3C5} *Your Badges*\n\n';

  for (const badge of BADGE_LIST) {
    if (earnedSet.has(badge.type)) {
      msg += `${badge.emoji} *${badge.label}* \u2713\n`;
    } else {
      msg += `\u{1F512} ${badge.label}\n`;
    }
  }

  const earned = achievements.length;
  const total = BADGE_LIST.length;
  msg += `\n${earned}/${total} badges earned`;

  if (earned < total) {
    msg += '\n\nKeep playing to unlock more!';
  } else {
    msg += '\n\nAmazing! You have them all!';
  }

  await whatsapp.sendMessage(conversationId, msg);
}

module.exports = { handle, BADGE_LIST };
