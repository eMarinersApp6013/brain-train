const { query, getOne, getMany } = require('../db/pool');

/**
 * Calculate points for a challenge response.
 */
function calculatePoints(isCorrect, responseTimeSec, difficulty, hintUsed) {
  if (!isCorrect) return 0;

  const basePoints = { easy: 10, medium: 20, hard: 30 };
  let points = basePoints[difficulty] || 10;

  // Time bonus
  if (responseTimeSec < 30) {
    points += 5;
  } else if (responseTimeSec < 60) {
    points += 3;
  }

  // Hint penalty
  if (hintUsed) {
    points -= 5;
  }

  return Math.max(0, points);
}

/**
 * Update user streak. Increment if answered yesterday, else reset to 1.
 * Also update longest_streak if current exceeds it.
 * Returns new streak value.
 */
async function updateStreak(userId) {
  const user = await getOne('SELECT streak, longest_streak, last_active FROM users WHERE id = $1', [userId]);
  if (!user) return 0;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  let newStreak = 1;

  if (user.last_active) {
    const lastActive = new Date(user.last_active);
    const lastActiveDate = new Date(lastActive.getFullYear(), lastActive.getMonth(), lastActive.getDate());

    if (lastActiveDate.getTime() === yesterday.getTime()) {
      newStreak = (user.streak || 0) + 1;
    } else if (lastActiveDate.getTime() === today.getTime()) {
      // Already answered today, keep current streak
      newStreak = user.streak || 1;
    }
  }

  const longestStreak = Math.max(newStreak, user.longest_streak || 0);

  await query(
    'UPDATE users SET streak = $1, longest_streak = $2, last_active = NOW() WHERE id = $3',
    [newStreak, longestStreak, userId]
  );

  return newStreak;
}

/**
 * Insert/update score and add points to user total.
 */
async function updateScore(userId, questionId, points, isCorrect, responseTimeSec) {
  await query(
    `INSERT INTO scores (user_id, question_id, points, is_correct, response_time_sec)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id, score_date)
     DO UPDATE SET question_id = $2, points = $3, is_correct = $4, response_time_sec = $5`,
    [userId, questionId, points, isCorrect, responseTimeSec]
  );

  await query(
    'UPDATE users SET total_points = total_points + $1 WHERE id = $2',
    [points, userId]
  );
}

/**
 * Get weekly leaderboard with user info, sorted by rank.
 */
async function getWeeklyLeaderboard(limit = 10) {
  const weekStart = getWeekStart();

  return getMany(
    `SELECT lw.user_id, lw.points, lw.rank, lw.accuracy_pct,
            u.name, u.phone
     FROM leaderboard_weekly lw
     JOIN users u ON u.id = lw.user_id
     WHERE lw.week_start = $1
     ORDER BY lw.rank ASC
     LIMIT $2`,
    [weekStart, limit]
  );
}

/**
 * Recalculate weekly leaderboard from user_sessions for the current week.
 */
async function refreshWeeklyLeaderboard() {
  const weekStart = getWeekStart();

  await query(
    `INSERT INTO leaderboard_weekly (user_id, week_start, points, accuracy_pct, rank, updated_at)
     SELECT
       ranked.user_id,
       $1::date AS week_start,
       ranked.total_points,
       ranked.accuracy_pct,
       ranked.rank,
       NOW()
     FROM (
       SELECT
         us.user_id,
         COALESCE(SUM(us.points_earned), 0) AS total_points,
         CASE WHEN COUNT(*) > 0
           THEN ROUND(100.0 * COUNT(*) FILTER (WHERE us.is_correct = true) / COUNT(*))
           ELSE 0
         END AS accuracy_pct,
         ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(us.points_earned), 0) DESC) AS rank
       FROM user_sessions us
       WHERE us.session_date >= $1::date
         AND us.session_date < ($1::date + INTERVAL '7 days')
       GROUP BY us.user_id
     ) ranked
     ON CONFLICT (user_id, week_start)
     DO UPDATE SET
       points = EXCLUDED.points,
       accuracy_pct = EXCLUDED.accuracy_pct,
       rank = EXCLUDED.rank,
       updated_at = NOW()`,
    [weekStart]
  );
}

/**
 * Get comprehensive stats for a user.
 */
async function getUserStats(userId) {
  const user = await getOne(
    'SELECT streak, longest_streak, total_points, brain_age_score, iq_estimate_score FROM users WHERE id = $1',
    [userId]
  );
  if (!user) return null;

  const weekStart = getWeekStart();

  const weeklyRow = await getOne(
    `SELECT COALESCE(SUM(points_earned), 0) AS weekly_points
     FROM user_sessions
     WHERE user_id = $1 AND session_date >= $2::date AND session_date < ($2::date + INTERVAL '7 days')`,
    [userId, weekStart]
  );

  const accuracyRow = await getOne(
    `SELECT
       COUNT(*) AS questions_answered,
       CASE WHEN COUNT(*) > 0
         THEN ROUND(100.0 * COUNT(*) FILTER (WHERE is_correct = true) / COUNT(*))
         ELSE 0
       END AS accuracy
     FROM user_sessions
     WHERE user_id = $1 AND is_correct IS NOT NULL`,
    [userId]
  );

  return {
    streak: user.streak || 0,
    longestStreak: user.longest_streak || 0,
    totalPoints: user.total_points || 0,
    weeklyPoints: parseInt(weeklyRow.weekly_points) || 0,
    accuracy: parseInt(accuracyRow.accuracy) || 0,
    questionsAnswered: parseInt(accuracyRow.questions_answered) || 0,
    brainAge: user.brain_age_score || null,
    iqEstimate: user.iq_estimate_score || null
  };
}

/**
 * Check all badge conditions and award any not already earned.
 * Returns array of newly earned badge types.
 */
async function checkAndAwardBadges(userId) {
  const user = await getOne('SELECT streak, longest_streak FROM users WHERE id = $1', [userId]);
  if (!user) return [];

  const existingBadges = await getMany(
    'SELECT badge_type FROM achievements WHERE user_id = $1',
    [userId]
  );
  const earned = new Set(existingBadges.map(b => b.badge_type));

  const newBadges = [];

  // Streak badges
  if (!earned.has('streak_7') && (user.streak >= 7 || user.longest_streak >= 7)) {
    newBadges.push({ type: 'streak_7', label: '7-Day Streak' });
  }
  if (!earned.has('streak_30') && (user.streak >= 30 || user.longest_streak >= 30)) {
    newBadges.push({ type: 'streak_30', label: '30-Day Streak' });
  }
  if (!earned.has('streak_100') && (user.streak >= 100 || user.longest_streak >= 100)) {
    newBadges.push({ type: 'streak_100', label: '100-Day Streak' });
  }

  // Perfect week: 7/7 correct in current week
  if (!earned.has('perfect_week')) {
    const weekStart = getWeekStart();
    const perfectRow = await getOne(
      `SELECT COUNT(*) AS correct_count
       FROM user_sessions
       WHERE user_id = $1
         AND session_date >= $2::date
         AND session_date < ($2::date + INTERVAL '7 days')
         AND is_correct = true`,
      [userId, weekStart]
    );
    if (parseInt(perfectRow.correct_count) >= 7) {
      newBadges.push({ type: 'perfect_week', label: 'Perfect Week' });
    }
  }

  // Speed demon: 3+ answers under 5 seconds
  if (!earned.has('speed_demon')) {
    const speedRow = await getOne(
      `SELECT COUNT(*) AS fast_count
       FROM user_sessions
       WHERE user_id = $1 AND response_time_seconds < 5 AND is_correct = true`,
      [userId]
    );
    if (parseInt(speedRow.fast_count) >= 3) {
      newBadges.push({ type: 'speed_demon', label: 'Speed Demon' });
    }
  }

  // Brain age test: has a brain assessment
  if (!earned.has('brain_age_test')) {
    const assessmentRow = await getOne(
      'SELECT id FROM brain_assessments WHERE user_id = $1 LIMIT 1',
      [userId]
    );
    if (assessmentRow) {
      newBadges.push({ type: 'brain_age_test', label: 'Brain Age Tested' });
    }
  }

  // Top 3 in weekly leaderboard
  if (!earned.has('top_3')) {
    const weekStart = getWeekStart();
    const rankRow = await getOne(
      'SELECT rank FROM leaderboard_weekly WHERE user_id = $1 AND week_start = $2',
      [userId, weekStart]
    );
    if (rankRow && rankRow.rank <= 3) {
      newBadges.push({ type: 'top_3', label: 'Top 3 Weekly' });
    }
  }

  // Recall master: recalled 10/10 words on memory challenge
  if (!earned.has('recall_master')) {
    const recallRow = await getOne(
      `SELECT us.user_answer, q.answer
       FROM user_sessions us
       JOIN questions q ON q.id = us.question_id
       WHERE us.user_id = $1 AND q.type = 'memory' AND us.is_correct = true
       ORDER BY us.answered_at DESC LIMIT 1`,
      [userId]
    );
    if (recallRow && recallRow.user_answer && recallRow.answer) {
      const correctWords = recallRow.answer.split(',').map(w => w.trim().toLowerCase());
      const userWords = recallRow.user_answer.split(',').map(w => w.trim().toLowerCase());
      const matched = correctWords.filter(cw => userWords.some(uw => uw.includes(cw)));
      if (correctWords.length >= 10 && matched.length >= correctWords.length) {
        newBadges.push({ type: 'recall_master', label: 'Recall Master' });
      }
    }
  }

  // Award new badges
  for (const badge of newBadges) {
    await query(
      'INSERT INTO achievements (user_id, badge_type, badge_label) VALUES ($1, $2, $3)',
      [userId, badge.type, badge.label]
    );
  }

  return newBadges;
}

/**
 * Helper: get Monday of the current week as YYYY-MM-DD string.
 */
function getWeekStart() {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff);
  return monday.toISOString().slice(0, 10);
}

module.exports = {
  calculatePoints,
  updateStreak,
  updateScore,
  getWeeklyLeaderboard,
  refreshWeeklyLeaderboard,
  getUserStats,
  checkAndAwardBadges,
  getWeekStart
};
