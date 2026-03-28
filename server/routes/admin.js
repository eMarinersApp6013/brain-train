const express = require('express');
const router = express.Router();
const multer = require('multer');
const { parse } = require('csv-parse/sync');
const { adminAuth } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimit');
const { query, getOne, getMany, getSetting, setSetting } = require('../db/pool');
const claude = require('../services/claude');
const openai = require('../services/openai');
const chatwoot = require('../services/chatwoot');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// Rate limit all admin routes
router.use(apiLimiter);

// ─── Auth ────────────────────────────────────────────────────────────────────

router.post('/login', (req, res) => {
  try {
    const { password } = req.body;
    if (password === process.env.ADMIN_PASSWORD) {
      req.session.isAdmin = true;
      return res.json({ success: true });
    }
    res.status(401).json({ error: 'Invalid password' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// ─── All routes below require admin auth ─────────────────────────────────────

router.use(adminAuth);

// ─── Dashboard ───────────────────────────────────────────────────────────────

router.get('/dashboard', async (req, res) => {
  try {
    const [totalUsers, activeToday, messagesSent, windowOpenCount, premiumUsers, monthlyRevenue] = await Promise.all([
      getOne('SELECT COUNT(*)::int AS count FROM users'),
      getOne("SELECT COUNT(*)::int AS count FROM users WHERE last_active::date = CURRENT_DATE"),
      getOne("SELECT COUNT(*)::int AS count FROM user_sessions WHERE created_at::date = CURRENT_DATE"),
      getOne("SELECT COUNT(*)::int AS count FROM users WHERE window_expired = false"),
      getOne("SELECT COUNT(*)::int AS count FROM users WHERE is_premium = true"),
      getOne("SELECT COALESCE(SUM(p.price), 0)::numeric AS total FROM subscriptions s JOIN plans p ON s.plan_id = p.id WHERE s.status = 'active'")
    ]);

    res.json({
      totalUsers: totalUsers.count,
      activeToday: activeToday.count,
      messagesSent: messagesSent.count,
      windowOpenCount: windowOpenCount.count,
      premiumUsers: premiumUsers.count,
      monthlyRevenue: parseFloat(monthlyRevenue.total)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Test Mode ───────────────────────────────────────────────────────────────

router.get('/test-mode', async (req, res) => {
  try {
    const testMode = await getSetting('TEST_MODE');
    const whitelist = await getMany('SELECT * FROM whitelist ORDER BY id');
    res.json({ testMode, whitelist });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/test-mode', async (req, res) => {
  try {
    const { enabled } = req.body;
    await setSetting('TEST_MODE', String(enabled));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/whitelist', async (req, res) => {
  try {
    const rows = await getMany('SELECT * FROM whitelist ORDER BY id');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/whitelist', async (req, res) => {
  try {
    const { phone, label, difficulty, time_slot } = req.body;
    const row = await getOne(
      'INSERT INTO whitelist (phone, label, difficulty, time_slot) VALUES ($1, $2, $3, $4) RETURNING *',
      [phone, label, difficulty, time_slot]
    );
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/whitelist/:id', async (req, res) => {
  try {
    await query('DELETE FROM whitelist WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Settings ────────────────────────────────────────────────────────────────

router.get('/settings', async (req, res) => {
  try {
    const rows = await getMany('SELECT key, value FROM settings ORDER BY key');
    const settings = {};
    for (const row of rows) {
      settings[row.key] = row.value;
    }
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/settings', async (req, res) => {
  try {
    const { settings } = req.body;
    for (const [key, value] of Object.entries(settings)) {
      await setSetting(key, String(value));
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/trigger-keyword', async (req, res) => {
  try {
    const { keyword } = req.body;
    await setSetting('TRIGGER_KEYWORD', keyword);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/test-chatwoot', async (req, res) => {
  try {
    const result = await chatwoot.searchContact('test');
    res.json({ success: true, contact: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/test-ai', async (req, res) => {
  try {
    const { provider } = req.body;
    if (provider === 'claude') {
      const { client, model } = await claude.getClient();
      const response = await client.messages.create({
        model,
        max_tokens: 32,
        messages: [{ role: 'user', content: 'Reply with "OK" only.' }]
      });
      res.json({ success: true, reply: response.content[0].text });
    } else if (provider === 'openai') {
      const { client, model } = await openai.getClient();
      const response = await client.chat.completions.create({
        model,
        max_tokens: 32,
        messages: [{ role: 'user', content: 'Reply with "OK" only.' }]
      });
      res.json({ success: true, reply: response.choices[0].message.content });
    } else {
      res.status(400).json({ error: 'Invalid provider. Use "claude" or "openai".' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Users ───────────────────────────────────────────────────────────────────

router.get('/users/export', async (req, res) => {
  try {
    const rows = await getMany('SELECT * FROM users ORDER BY created_at DESC');
    if (rows.length === 0) {
      res.setHeader('Content-Type', 'text/csv');
      return res.send('');
    }
    const headers = Object.keys(rows[0]);
    const lines = [headers.join(',')];
    for (const row of rows) {
      lines.push(headers.map(h => {
        const val = row[h] == null ? '' : String(row[h]).replace(/"/g, '""');
        return `"${val}"`;
      }).join(','));
    }
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=users.csv');
    res.send(lines.join('\n'));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/users', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const { search, status } = req.query;

    let where = 'WHERE 1=1';
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      where += ` AND (name ILIKE $${params.length} OR phone ILIKE $${params.length})`;
    }
    if (status === 'premium') {
      where += ' AND is_premium = true';
    } else if (status === 'free') {
      where += ' AND is_premium = false';
    }

    const countResult = await getOne(`SELECT COUNT(*)::int AS count FROM users ${where}`, params);
    const users = await getMany(
      `SELECT * FROM users ${where} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    res.json({
      users,
      total: countResult.count,
      page,
      totalPages: Math.ceil(countResult.count / limit)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/users/:id', async (req, res) => {
  try {
    const user = await getOne('SELECT * FROM users WHERE id = $1', [req.params.id]);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const sessions = await getMany(
      'SELECT * FROM user_sessions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20',
      [req.params.id]
    );

    res.json({ ...user, recentSessions: sessions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/users/:id', async (req, res) => {
  try {
    const fields = req.body;
    const keys = Object.keys(fields);
    if (keys.length === 0) return res.status(400).json({ error: 'No fields provided' });

    const setClauses = keys.map((k, i) => `${k} = $${i + 1}`);
    const values = keys.map(k => fields[k]);
    values.push(req.params.id);

    const user = await getOne(
      `UPDATE users SET ${setClauses.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values
    );
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Questions ───────────────────────────────────────────────────────────────

router.get('/questions/export', async (req, res) => {
  try {
    const rows = await getMany('SELECT * FROM questions ORDER BY id');
    if (rows.length === 0) {
      res.setHeader('Content-Type', 'text/csv');
      return res.send('');
    }
    const headers = Object.keys(rows[0]);
    const lines = [headers.join(',')];
    for (const row of rows) {
      lines.push(headers.map(h => {
        const val = row[h] == null ? '' : String(row[h]).replace(/"/g, '""');
        return `"${val}"`;
      }).join(','));
    }
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=questions.csv');
    res.send(lines.join('\n'));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/questions', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const { type, difficulty, audience, week_number, day_of_week, theme } = req.query;

    let where = 'WHERE 1=1';
    const params = [];

    if (type) { params.push(type); where += ` AND type = $${params.length}`; }
    if (difficulty) { params.push(difficulty); where += ` AND difficulty = $${params.length}`; }
    if (audience) { params.push(audience); where += ` AND audience = $${params.length}`; }
    if (week_number) { params.push(parseInt(week_number)); where += ` AND week_number = $${params.length}`; }
    if (day_of_week) { params.push(parseInt(day_of_week)); where += ` AND day_of_week = $${params.length}`; }
    if (theme) { params.push(theme); where += ` AND theme = $${params.length}`; }

    const countResult = await getOne(`SELECT COUNT(*)::int AS count FROM questions ${where}`, params);
    const questions = await getMany(
      `SELECT * FROM questions ${where} ORDER BY id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    res.json({
      questions,
      total: countResult.count,
      page,
      totalPages: Math.ceil(countResult.count / limit)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/questions', async (req, res) => {
  try {
    const { question_text, hint_text, answer, answer_type, explanation, tip_text, points,
      type, difficulty, audience, week_number, day_of_week, theme } = req.body;
    const row = await getOne(
      `INSERT INTO questions (question_text, hint_text, answer, answer_type, explanation, tip_text, points,
        type, difficulty, audience, week_number, day_of_week, theme)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [question_text, hint_text, answer, answer_type, explanation, tip_text, points,
        type, difficulty, audience, week_number, day_of_week, theme]
    );
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/questions/:id', async (req, res) => {
  try {
    const fields = req.body;
    const keys = Object.keys(fields);
    if (keys.length === 0) return res.status(400).json({ error: 'No fields provided' });

    const setClauses = keys.map((k, i) => `${k} = $${i + 1}`);
    const values = keys.map(k => fields[k]);
    values.push(req.params.id);

    const row = await getOne(
      `UPDATE questions SET ${setClauses.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values
    );
    if (!row) return res.status(404).json({ error: 'Question not found' });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/questions/:id', async (req, res) => {
  try {
    const row = await getOne(
      'UPDATE questions SET is_active = false WHERE id = $1 RETURNING *',
      [req.params.id]
    );
    if (!row) return res.status(404).json({ error: 'Question not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/questions/generate', async (req, res) => {
  try {
    const { type, difficulty, audience, count } = req.body;
    const questions = await claude.generateQuestions(type, difficulty, audience, count || 5);
    res.json({ questions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/questions/bulk-save', async (req, res) => {
  try {
    const { questions } = req.body;
    const saved = [];
    for (const q of questions) {
      const row = await getOne(
        `INSERT INTO questions (question_text, hint_text, answer, answer_type, explanation, tip_text, points,
          type, difficulty, audience, week_number, day_of_week, theme)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
        [q.question_text, q.hint_text, q.answer, q.answer_type, q.explanation, q.tip_text, q.points,
          q.type, q.difficulty, q.audience, q.week_number, q.day_of_week, q.theme]
      );
      saved.push(row);
    }
    res.json({ saved, count: saved.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/questions/import-csv', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const records = parse(req.file.buffer.toString(), {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });

    const preview = req.query.preview === 'true' || req.body.preview === 'true';
    if (preview) {
      return res.json({ rows: records, count: records.length });
    }

    const saved = [];
    for (const q of records) {
      const row = await getOne(
        `INSERT INTO questions (question_text, hint_text, answer, answer_type, explanation, tip_text, points,
          type, difficulty, audience, week_number, day_of_week, theme)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
        [q.question_text, q.hint_text, q.answer, q.answer_type, q.explanation, q.tip_text,
          parseInt(q.points) || null, q.type, q.difficulty, q.audience,
          parseInt(q.week_number) || null, parseInt(q.day_of_week) || null, q.theme]
      );
      saved.push(row);
    }
    res.json({ saved, count: saved.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Themes ──────────────────────────────────────────────────────────────────

router.get('/themes', async (req, res) => {
  try {
    const rows = await getMany('SELECT DISTINCT theme FROM questions WHERE theme IS NOT NULL ORDER BY theme');
    res.json(rows.map(r => r.theme));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/themes/active', async (req, res) => {
  try {
    const { theme } = req.body;
    await setSetting('ACTIVE_THEME', theme);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Modules ─────────────────────────────────────────────────────────────────

router.get('/modules', async (req, res) => {
  try {
    const config = await getSetting('MODULE_CONFIG');
    res.json(config ? JSON.parse(config) : {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/modules', async (req, res) => {
  try {
    const { modules } = req.body;
    await setSetting('MODULE_CONFIG', JSON.stringify(modules));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Plans ───────────────────────────────────────────────────────────────────

router.get('/plans', async (req, res) => {
  try {
    const rows = await getMany('SELECT * FROM plans ORDER BY id');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/plans', async (req, res) => {
  try {
    const { name, price, duration_days, features } = req.body;
    const row = await getOne(
      'INSERT INTO plans (name, price, duration_days, features) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, price, duration_days, features]
    );
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/plans/:id', async (req, res) => {
  try {
    const fields = req.body;
    const keys = Object.keys(fields);
    if (keys.length === 0) return res.status(400).json({ error: 'No fields provided' });

    const setClauses = keys.map((k, i) => `${k} = $${i + 1}`);
    const values = keys.map(k => fields[k]);
    values.push(req.params.id);

    const row = await getOne(
      `UPDATE plans SET ${setClauses.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values
    );
    if (!row) return res.status(404).json({ error: 'Plan not found' });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Subscriptions ───────────────────────────────────────────────────────────

router.get('/subscriptions', async (req, res) => {
  try {
    const rows = await getMany(
      `SELECT s.*, u.name AS user_name, u.phone AS user_phone, p.name AS plan_name
       FROM subscriptions s
       JOIN users u ON s.user_id = u.id
       JOIN plans p ON s.plan_id = p.id
       WHERE s.status = 'active'
       ORDER BY s.created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/subscriptions/assign', async (req, res) => {
  try {
    const { userId, planId } = req.body;
    const row = await getOne(
      `INSERT INTO subscriptions (user_id, plan_id, status, started_at)
       VALUES ($1, $2, 'active', NOW()) RETURNING *`,
      [userId, planId]
    );
    await query('UPDATE users SET is_premium = true WHERE id = $1', [userId]);
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Leaderboard ─────────────────────────────────────────────────────────────

router.get('/leaderboard', async (req, res) => {
  try {
    const week = req.query.week || null;
    let rows;
    if (week) {
      rows = await getMany(
        `SELECT l.*, u.name AS user_name FROM leaderboard l
         JOIN users u ON l.user_id = u.id
         WHERE l.week = $1
         ORDER BY l.score DESC`,
        [week]
      );
    } else {
      rows = await getMany(
        `SELECT l.*, u.name AS user_name FROM leaderboard l
         JOIN users u ON l.user_id = u.id
         ORDER BY l.week DESC, l.score DESC LIMIT 100`
      );
    }
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── AI Settings ─────────────────────────────────────────────────────────────

router.get('/ai-settings', async (req, res) => {
  try {
    const keys = ['ANTHROPIC_API_KEY', 'CLAUDE_MODEL', 'OPENAI_API_KEY', 'OPENAI_MODEL', 'AI_PROVIDER'];
    const settings = {};
    for (const key of keys) {
      settings[key] = await getSetting(key);
    }
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/ai-settings', async (req, res) => {
  try {
    const { settings } = req.body;
    for (const [key, value] of Object.entries(settings)) {
      await setSetting(key, String(value));
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Kids ────────────────────────────────────────────────────────────────────

router.get('/kids', async (req, res) => {
  try {
    const kids = await getMany("SELECT * FROM users WHERE audience = 'kids' ORDER BY created_at DESC");
    const stats = await getMany(
      "SELECT age_group, COUNT(*)::int AS count FROM users WHERE audience = 'kids' AND age_group IS NOT NULL GROUP BY age_group ORDER BY age_group"
    );
    res.json({ kids, ageGroupDistribution: stats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Sessions ────────────────────────────────────────────────────────────────

router.get('/sessions', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const { date } = req.query;

    let where = 'WHERE 1=1';
    const params = [];

    if (date) {
      params.push(date);
      where += ` AND s.created_at::date = $${params.length}::date`;
    }

    const countResult = await getOne(
      `SELECT COUNT(*)::int AS count FROM user_sessions s ${where}`, params
    );

    const sessions = await getMany(
      `SELECT s.*, u.name AS user_name, u.phone AS user_phone, q.question_text
       FROM user_sessions s
       LEFT JOIN users u ON s.user_id = u.id
       LEFT JOIN questions q ON s.question_id = q.id
       ${where}
       ORDER BY s.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    res.json({
      sessions,
      total: countResult.count,
      page,
      totalPages: Math.ceil(countResult.count / limit)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
