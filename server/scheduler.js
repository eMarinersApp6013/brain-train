const cron = require('node-cron');
const scheduler = require('./services/scheduler');

const TZ = process.env.TIMEZONE || 'Asia/Kolkata';

function start() {
  console.log('[Cron] Starting scheduler with timezone:', TZ);

  // Morning challenges at 07:55
  cron.schedule('55 7 * * *', () => {
    scheduler.sendDailyChallenges('08:00');
  }, { timezone: TZ });

  // Afternoon challenges at 12:55
  cron.schedule('55 12 * * *', () => {
    scheduler.sendDailyChallenges('13:00');
  }, { timezone: TZ });

  // Evening challenges at 18:55
  cron.schedule('55 18 * * *', () => {
    scheduler.sendDailyChallenges('19:00');
  }, { timezone: TZ });

  // Friday evening memory recall at 19:00
  cron.schedule('0 19 * * 5', () => {
    scheduler.sendDailyChallenges('memory_recall');
  }, { timezone: TZ });

  // Monday morning coach messages at 07:30
  cron.schedule('30 7 * * 1', () => {
    scheduler.sendCoachMessages();
  }, { timezone: TZ });

  // Speed challenges (random 2-3x per week: Tue, Thu, Sat at 11:00)
  cron.schedule('0 11 * * 2,4,6', () => {
    scheduler.sendSpeedChallenges();
  }, { timezone: TZ });

  // Wednesday spaced recall at 10:00
  cron.schedule('0 10 * * 3', () => {
    scheduler.sendRecallChallenges();
  }, { timezone: TZ });

  // Sunday 19:55 weekly scorecard
  cron.schedule('55 19 * * 0', () => {
    scheduler.sendWeeklyScorecard();
  }, { timezone: TZ });

  // Sunday 20:00 brain health calculation
  cron.schedule('0 20 * * 0', () => {
    scheduler.calculateBrainHealth();
  }, { timezone: TZ });

  // Monday midnight leaderboard refresh
  cron.schedule('0 0 * * 1', () => {
    scheduler.refreshLeaderboard();
  }, { timezone: TZ });

  // Daily cognitive profile check at 09:00
  cron.schedule('0 9 * * *', () => {
    scheduler.checkCognitiveProfiles();
  }, { timezone: TZ });

  // Health tips at 08:30 AM
  cron.schedule('30 8 * * *', () => {
    const healthTips = require('./handlers/modules/health_tips');
    healthTips.sendHealthTips();
  }, { timezone: TZ });

  // Check reminders every minute
  cron.schedule('* * * * *', () => {
    const reminders = require('./handlers/modules/reminders');
    reminders.checkAndSendReminders();
  }, { timezone: TZ });

  // Evening fun question at 8:00 PM
  cron.schedule('0 20 * * *', () => {
    try {
      const evening = require('./handlers/modules/evening_engagement');
      evening.sendEveningBets();
    } catch (e) { console.error('[Cron] Evening bet error:', e.message); }
  }, { timezone: TZ });

  // Evening closeout at 9:00 PM
  cron.schedule('0 21 * * *', () => {
    try {
      const closeout = require('./handlers/modules/daily_closeout');
      closeout.sendEveningCloseouts();
    } catch (e) { console.error('[Cron] Closeout error:', e.message); }
  }, { timezone: TZ });

  // Kids emotional support (Wed and Sat at 4 PM)
  cron.schedule('0 16 * * 3,6', async () => {
    try {
      const kidsSupport = require('./handlers/modules/kids_support');
      const db = require('./db/pool');
      const users = await db.getMany("SELECT * FROM users WHERE mode = 'kids' AND is_active = true AND onboarding_step = 'complete'");
      for (const user of users) {
        try { await kidsSupport.sendEmotionalSupport(user); } catch(e) {}
        await new Promise(r => setTimeout(r, 200));
      }
    } catch (e) { console.error('[Cron] Kids support error:', e.message); }
  }, { timezone: TZ });

  console.log('[Cron] All jobs scheduled');
}

module.exports = { start };
