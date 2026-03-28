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

  console.log('[Cron] All jobs scheduled');
}

module.exports = { start };
