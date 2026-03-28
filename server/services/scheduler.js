const db = require('../db/pool');
const whatsapp = require('./whatsapp');
const scoring = require('./scoring');

async function sendDailyChallenges(timeSlot) {
  console.log(`[Scheduler] Sending challenges for time slot: ${timeSlot}`);
  try {
    const users = await db.getMany(
      `SELECT * FROM users WHERE is_active = true AND onboarding_step = 'complete' AND time_slot = $1`,
      [timeSlot]
    );

    let sent = 0, skipped = 0;
    for (const user of users) {
      try {
        // Test mode check
        if (await whatsapp.isTestModeBlocked(user.phone)) {
          skipped++;
          continue;
        }

        const result = await whatsapp.sendChallenge(user);
        if (result.sent) sent++;
        else skipped++;

        // Stagger sends
        await new Promise(r => setTimeout(r, 200));
      } catch (err) {
        console.error(`[Scheduler] Error sending to user ${user.id}:`, err.message);
        skipped++;
      }
    }

    console.log(`[Scheduler] ${timeSlot}: sent=${sent}, skipped=${skipped}, total=${users.length}`);
  } catch (err) {
    console.error('[Scheduler] Daily challenge error:', err);
  }
}

async function sendWeeklyScorecard() {
  console.log('[Scheduler] Sending weekly scorecards');
  try {
    const users = await db.getMany(
      "SELECT * FROM users WHERE is_active = true AND onboarding_step = 'complete'"
    );

    for (const user of users) {
      try {
        if (await whatsapp.isTestModeBlocked(user.phone)) continue;
        await whatsapp.sendWeeklyScorecard(user);
        await new Promise(r => setTimeout(r, 200));
      } catch (err) {
        console.error(`[Scheduler] Scorecard error for user ${user.id}:`, err.message);
      }
    }
  } catch (err) {
    console.error('[Scheduler] Weekly scorecard error:', err);
  }
}

async function sendCoachMessages() {
  try {
    const coachModule = require('../handlers/modules/coach_message');
    await coachModule.sendCoachMessages();
  } catch (err) {
    console.error('[Scheduler] Coach message error:', err);
  }
}

async function sendSpeedChallenges() {
  try {
    const speedModule = require('../handlers/modules/speed_challenge');
    await speedModule.sendSpeedChallenges();
  } catch (err) {
    console.error('[Scheduler] Speed challenge error:', err);
  }
}

async function sendRecallChallenges() {
  try {
    const recallModule = require('../handlers/modules/spaced_recall');
    await recallModule.sendRecallChallenges();
  } catch (err) {
    console.error('[Scheduler] Recall challenge error:', err);
  }
}

async function calculateBrainHealth() {
  try {
    const healthModule = require('../handlers/modules/brain_health');
    await healthModule.calculateBrainHealthScores();
  } catch (err) {
    console.error('[Scheduler] Brain health error:', err);
  }
}

async function refreshLeaderboard() {
  try {
    await scoring.refreshWeeklyLeaderboard();
  } catch (err) {
    console.error('[Scheduler] Leaderboard refresh error:', err);
  }
}

async function checkCognitiveProfiles() {
  try {
    const cogModule = require('../handlers/modules/cognitive_profile');
    const users = await db.getMany(
      `SELECT * FROM users WHERE is_active = true AND onboarding_step = 'complete'
       AND cognitive_style IS NULL AND joined_at <= NOW() - INTERVAL '7 days'`
    );
    for (const user of users) {
      try {
        if (await whatsapp.isTestModeBlocked(user.phone)) continue;
        if (!await whatsapp.isWindowOpen(user.id)) continue;
        await cogModule.handle(user, '', user.chatwoot_conversation_id);
        await new Promise(r => setTimeout(r, 200));
      } catch (err) {
        console.error(`[Scheduler] Cognitive profile error for user ${user.id}:`, err.message);
      }
    }
  } catch (err) {
    console.error('[Scheduler] Cognitive profile error:', err);
  }
}

module.exports = {
  sendDailyChallenges,
  sendWeeklyScorecard,
  sendCoachMessages,
  sendSpeedChallenges,
  sendRecallChallenges,
  calculateBrainHealth,
  refreshLeaderboard,
  checkCognitiveProfiles
};
