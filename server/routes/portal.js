const express = require('express');
const router = express.Router();
const db = require('../db/pool');
const { portalAuth } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimit');
const scoring = require('../services/scoring');
const whatsapp = require('../services/whatsapp');

router.use(apiLimiter);

// Login with phone - sends OTP via WhatsApp
router.post('/login', async (req, res) => {
  try {
    const { phone, otp } = req.body;
    const cleanPhone = phone.replace(/[^+\d]/g, '');

    if (otp) {
      // Verify OTP
      if (req.session.pendingOtp && req.session.pendingOtp.code === otp && req.session.pendingOtp.phone === cleanPhone) {
        const user = await db.getOne('SELECT id FROM users WHERE phone = $1', [cleanPhone]);
        if (!user) return res.status(404).json({ error: 'User not found' });
        req.session.userId = user.id;
        req.session.pendingOtp = null;
        return res.json({ success: true });
      }
      return res.status(401).json({ error: 'Invalid OTP' });
    }

    // Send OTP
    const user = await db.getOne('SELECT * FROM users WHERE phone = $1', [cleanPhone]);
    if (!user) return res.status(404).json({ error: 'Phone number not registered' });

    const code = String(Math.floor(100000 + Math.random() * 900000));
    req.session.pendingOtp = { phone: cleanPhone, code, expiresAt: Date.now() + 5 * 60 * 1000 };

    if (user.chatwoot_conversation_id) {
      try {
        await whatsapp.sendMessage(user.chatwoot_conversation_id, `Your BrainPing login OTP is: *${code}*\n\nValid for 5 minutes.`);
      } catch (err) {
        console.error('OTP send error:', err.message);
      }
    }

    res.json({ success: true, message: 'OTP sent to your WhatsApp' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// All routes below require auth
router.use(portalAuth);

router.get('/dashboard', async (req, res) => {
  try {
    const user = await db.getOne('SELECT * FROM users WHERE id = $1', [req.userId]);
    const stats = await scoring.getUserStats(req.userId);
    const recentSessions = await db.getMany(
      `SELECT us.*, q.type, q.question_text FROM user_sessions us
       JOIN questions q ON us.question_id = q.id
       WHERE us.user_id = $1 ORDER BY us.sent_at DESC LIMIT 10`,
      [req.userId]
    );
    res.json({ user, stats, recentSessions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/results', async (req, res) => {
  try {
    const { month, year } = req.query;
    const m = parseInt(month) || new Date().getMonth() + 1;
    const y = parseInt(year) || new Date().getFullYear();
    const sessions = await db.getMany(
      `SELECT us.session_date, us.is_correct, us.points_earned, us.response_time_seconds, q.type
       FROM user_sessions us JOIN questions q ON us.question_id = q.id
       WHERE us.user_id = $1 AND EXTRACT(MONTH FROM us.session_date) = $2 AND EXTRACT(YEAR FROM us.session_date) = $3
       ORDER BY us.session_date`,
      [req.userId, m, y]
    );
    res.json({ sessions, month: m, year: y });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/assessments', async (req, res) => {
  try {
    const assessments = await db.getMany(
      'SELECT * FROM brain_assessments WHERE user_id = $1 ORDER BY created_at DESC',
      [req.userId]
    );
    res.json({ assessments });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/badges', async (req, res) => {
  try {
    const earned = await db.getMany(
      'SELECT * FROM achievements WHERE user_id = $1 ORDER BY earned_at DESC',
      [req.userId]
    );
    res.json({ badges: earned });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/leaderboard', async (req, res) => {
  try {
    const lb = await scoring.getWeeklyLeaderboard(10);
    const myRank = await db.getOne(
      `SELECT rank, points FROM leaderboard_weekly WHERE user_id = $1 AND week_start = date_trunc('week', CURRENT_DATE)::date`,
      [req.userId]
    );
    res.json({ leaderboard: lb, myRank });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/subscription', async (req, res) => {
  try {
    const user = await db.getOne('SELECT plan_id, is_premium, premium_until FROM users WHERE id = $1', [req.userId]);
    const plan = user.plan_id ? await db.getOne('SELECT * FROM plans WHERE id = $1', [user.plan_id]) : null;
    const allPlans = await db.getMany('SELECT * FROM plans WHERE is_active = true ORDER BY price_inr');
    res.json({ currentPlan: plan, isPremium: user.is_premium, premiumUntil: user.premium_until, allPlans });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/settings', async (req, res) => {
  try {
    const { time_slot, difficulty } = req.body;
    const updates = {};
    if (time_slot) updates.time_slot = time_slot;
    if (difficulty) updates.difficulty = difficulty;

    const setClauses = Object.keys(updates).map((k, i) => `${k} = $${i + 2}`);
    if (setClauses.length === 0) return res.json({ success: true });

    await db.query(
      `UPDATE users SET ${setClauses.join(', ')} WHERE id = $1`,
      [req.userId, ...Object.values(updates)]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
