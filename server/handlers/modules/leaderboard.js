const db = require('../../db/pool');
const whatsapp = require('../../services/whatsapp');
const scoring = require('../../services/scoring');

async function handle(user, message, conversationId) {
  const top10 = await scoring.getWeeklyLeaderboard(10);

  if (top10.length === 0) {
    await whatsapp.sendMessage(conversationId,
      '\u{1F3C6} *Weekly Leaderboard*\n\nNo scores this week yet. Be the first!'
    );
    return;
  }

  const medals = ['\u{1F947}', '\u{1F948}', '\u{1F949}'];
  let msg = '\u{1F3C6} *Weekly Leaderboard*\n\n';

  let userInTop10 = false;

  for (let i = 0; i < top10.length; i++) {
    const entry = top10[i];
    const name = entry.name || entry.phone.slice(-4);
    const prefix = i < 3 ? medals[i] : `${i + 1}.`;
    const isMe = entry.user_id === user.id;

    if (isMe) userInTop10 = true;

    msg += `${prefix} ${isMe ? '*' + name + ' (You)*' : name} — ${entry.points} pts`;
    if (entry.accuracy_pct) msg += ` (${entry.accuracy_pct}%)`;
    msg += '\n';
  }

  // If user not in top 10, show their rank
  if (!userInTop10) {
    const weekStart = scoring.getWeekStart();
    const userRank = await db.getOne(
      `SELECT rank, points, accuracy_pct FROM leaderboard_weekly
       WHERE user_id = $1 AND week_start = $2`,
      [user.id, weekStart]
    );

    if (userRank) {
      msg += `\n---\n${userRank.rank}. *You* — ${userRank.points} pts (${userRank.accuracy_pct}%)`;
    } else {
      msg += '\n---\nYou: Not ranked this week yet. Answer challenges to get on the board!';
    }
  }

  await whatsapp.sendMessage(conversationId, msg);
}

module.exports = { handle };
