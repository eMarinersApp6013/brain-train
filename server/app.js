const express = require('express');
const session = require('express-session');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

const webhookRoutes = require('./routes/webhook');
const adminRoutes = require('./routes/admin');
const portalRoutes = require('./routes/portal');

function createApp(type) {
  const app = express();

  app.use(cors());
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.use(session({
    secret: process.env.SESSION_SECRET || 'brainping-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000, secure: false }
  }));

  if (type === 'main') {
    app.use('/webhook', webhookRoutes);
    app.get('/health', async (req, res) => {
      try {
        const db = require('./db/pool');
        await db.query('SELECT 1');
        res.json({ status: 'ok', timestamp: new Date().toISOString() });
      } catch (err) {
        res.status(500).json({ status: 'error', error: err.message });
      }
    });
  }

  if (type === 'admin') {
    const adminViewsDir = path.join(__dirname, '../admin-panel/views');
    app.set('view engine', 'ejs');
    app.set('views', adminViewsDir);
    app.use(express.static(path.join(__dirname, '../admin-panel/public')));
    app.use('/api/admin', adminRoutes);
    app.get('*', (req, res) => {
      res.render('layout', { page: 'dashboard' });
    });
  }

  if (type === 'portal') {
    const portalViewsDir = path.join(__dirname, '../user-portal/views');
    app.set('view engine', 'ejs');
    app.set('views', portalViewsDir);
    app.use(express.static(path.join(__dirname, '../user-portal/public')));
    app.use('/api/portal', portalRoutes);
    app.get('*', (req, res) => {
      res.render('layout', { page: 'dashboard' });
    });
  }

  return app;
}

module.exports = { createApp };
