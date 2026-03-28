require('dotenv').config({ path: require('path').join(__dirname, '.env') });
if (!process.env.DB_HOST) {
  require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
}

const { createApp } = require('./app');
const scheduler = require('./scheduler');

const MAIN_PORT = process.env.MAIN_PORT || 3000;
const ADMIN_PORT = process.env.ADMIN_PORT || 4200;
const PORTAL_PORT = process.env.PORTAL_PORT || 4201;

// Main server (webhook + API)
const mainApp = createApp('main');
mainApp.listen(MAIN_PORT, () => {
  console.log(`[BrainPing] Webhook server running on port ${MAIN_PORT}`);
});

// Admin panel
const adminApp = createApp('admin');
adminApp.listen(ADMIN_PORT, () => {
  console.log(`[BrainPing] Admin panel running on port ${ADMIN_PORT}`);
});

// User portal
const portalApp = createApp('portal');
portalApp.listen(PORTAL_PORT, () => {
  console.log(`[BrainPing] User portal running on port ${PORTAL_PORT}`);
});

// Start scheduler
scheduler.start();

console.log('[BrainPing] All services started successfully');

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
});
