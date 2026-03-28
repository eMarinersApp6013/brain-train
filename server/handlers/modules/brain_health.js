const db = require('../../db/pool');
const whatsapp = require('../../services/whatsapp');

const TOTAL_MODULES = 10;

async function calculateBrainHealthScores() {
  const users = await db.getMany(
    `SELECT * FROM users WHERE is_active = true AND onboarding_complete = true`
  );

  console.log(`Brain health: calculating for ${users.length} users`);

  for (const user of users) {
    try {
      const score = await calculateForUser(user.id);
      await db.query(
        'UPDATE users SET brain_health_score = $1 WHERE id = $2',
        [score, user.id]
      );
    } catch (err) {
      console.error(`Brain health error for user ${user.id}:`, err.message);
    }
  }
}

async function calculateForUser(userId) {
  // 1. Accuracy from last 30 days
  const accRow = await db.getOne(
    `SELECT
       COUNT(*) AS total,
       COUNT(*) FILTER (WHERE is_correct = true) AS correct
     FROM user_sessions
     WHERE user_id = $1
       AND session_date >= CURRENT_DATE - INTERVAL '30 days'
       AND answered_at IS NOT NULL`,
    [userId]
  );
  const accuracyPct = accRow.total > 0 ? (100 * accRow.correct) / accRow.total : 0;

  // 2. Streak consistency: days active in last 30
  const activeRow = await db.getOne(
    `SELECT COUNT(DISTINCT session_date) AS days_active
     FROM user_sessions
     WHERE user_id = $1
       AND session_date >= CURRENT_DATE - INTERVAL '30 days'`,
    [userId]
  );
  const streakConsistency = (parseInt(activeRow.days_active) / 30) * 100;

  // 3. Speed improvement: this week avg vs last week avg
  const thisWeekSpeed = await db.getOne(
    `SELECT AVG(response_time_seconds) AS avg_time
     FROM user_sessions
     WHERE user_id = $1
       AND session_date >= CURRENT_DATE - INTERVAL '7 days'
       AND response_time_seconds IS NOT NULL`,
    [userId]
  );
  const lastWeekSpeed = await db.getOne(
    `SELECT AVG(response_time_seconds) AS avg_time
     FROM user_sessions
     WHERE user_id = $1
       AND session_date >= CURRENT_DATE - INTERVAL '14 days'
       AND session_date < CURRENT_DATE - INTERVAL '7 days'
       AND response_time_seconds IS NOT NULL`,
    [userId]
  );

  let speedImprovement = 0;
  if (thisWeekSpeed.avg_time && lastWeekSpeed.avg_time) {
    // Positive if faster (lower time) this week
    speedImprovement = Math.min(100, Math.max(0,
      ((lastWeekSpeed.avg_time - thisWeekSpeed.avg_time) / lastWeekSpeed.avg_time) * 100 + 50
    ));
  } else {
    speedImprovement = 50; // neutral if insufficient data
  }

  // 4. Module completion: distinct session_types used
  const moduleRow = await db.getOne(
    `SELECT COUNT(DISTINCT session_type) AS modules_used
     FROM user_sessions
     WHERE user_id = $1`,
    [userId]
  );
  const moduleCompletion = (parseInt(moduleRow.modules_used) / TOTAL_MODULES) * 100;

  // Weighted score
  const raw = (accuracyPct * 0.4) + (streakConsistency * 0.3) + (speedImprovement * 0.2) + (moduleCompletion * 0.1);
  return Math.round(Math.min(100, Math.max(0, raw)));
}

async function handle(user, message, conversationId) {
  if (!user.is_premium) {
    await whatsapp.sendMessage(conversationId,
      '\u{1F512} *Brain Health Score* is a Premium feature.\n\nType PREMIUM to upgrade and unlock your full brain health dashboard!'
    );
    return;
  }

  const currentScore = user.brain_health_score;

  if (currentScore == null) {
    await whatsapp.sendMessage(conversationId,
      '\u{1F9E0} Your Brain Health Score is being calculated. Check back after Sunday!'
    );
    return;
  }

  // Get previous score for trend
  const prevRow = await db.getOne(
    `SELECT score FROM brain_assessments
     WHERE user_id = $1 AND assessment_type = 'brain_health'
     ORDER BY created_at DESC OFFSET 1 LIMIT 1`,
    [user.id]
  );

  let trend = '';
  if (prevRow) {
    const diff = currentScore - prevRow.score;
    if (diff > 0) trend = `\u{1F4C8} Up ${diff} points from last week!`;
    else if (diff < 0) trend = `\u{1F4C9} Down ${Math.abs(diff)} points from last week.`;
    else trend = '\u27A1\uFE0F Same as last week.';
  }

  let level;
  if (currentScore >= 80) level = 'Excellent';
  else if (currentScore >= 60) level = 'Good';
  else if (currentScore >= 40) level = 'Average';
  else level = 'Needs Work';

  let msg = `\u{1F9E0} *Brain Health Score: ${currentScore}/100*\n`;
  msg += `Level: ${level}\n`;
  if (trend) msg += `\n${trend}\n`;
  msg += '\nThis score is based on your accuracy, consistency, speed improvement, and module engagement over the last 30 days.';

  await whatsapp.sendMessage(conversationId, msg);
}

module.exports = { handle, calculateBrainHealthScores, calculateForUser };
