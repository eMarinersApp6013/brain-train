const db = require('./db/pool');
const whatsapp = require('./services/whatsapp');
const { handleOnboarding } = require('./handlers/onboarding');
const { handleAnswer } = require('./handlers/answer');
const { handleCommand } = require('./handlers/commands');

const processedMessages = new Set();

// Clean up processed message IDs every 5 minutes
setInterval(() => processedMessages.clear(), 5 * 60 * 1000);

// BrainPing keywords that activate the bot - everything else is ignored
const BRAINPING_KEYWORDS = [
  'brain', 'module', 'modules', 'menu', 'stats', 'hint', 'pause', 'resume',
  'level', 'premium', 'brain age', 'brainage', 'iq', 'leaderboard', 'badges',
  'report', 'stop', 'profile', 'explore', 'test', 'challenge', 'play', 'duel',
  'brain health', 'health'
];

function isBrainPingMessage(content, triggerKeyword) {
  const msg = content.toLowerCase().trim();
  // Check trigger keyword
  if (msg === triggerKeyword) return true;
  // Check known commands
  if (BRAINPING_KEYWORDS.includes(msg)) return true;
  // Check DUEL command
  if (msg.startsWith('duel ')) return true;
  // Single digit 1-8 (module selection or answer during active session)
  if (/^[1-8]$/.test(msg)) return true;
  return false;
}

async function handleWebhook(req, res) {
  try {
    res.status(200).json({ status: 'ok' });

    const payload = req.body;

    // Only process incoming messages
    if (payload.event !== 'message_created') return;
    if (payload.message_type === 'outgoing') return;
    if (!payload.content) return;

    const messageId = payload.id || payload.content_attributes?.external_id;
    if (messageId && processedMessages.has(messageId)) return;
    if (messageId) processedMessages.add(messageId);

    const content = payload.content.trim();
    const conversationId = payload.conversation?.id;
    const phone = payload.meta?.sender?.phone_number ||
                  payload.conversation?.meta?.sender?.phone_number ||
                  extractPhone(payload);

    if (!conversationId || !phone) {
      return;
    }

    const cleanPhone = phone.replace(/[^+\d]/g, '');

    // TEST MODE CHECK - must be first
    if (await whatsapp.isTestModeBlocked(cleanPhone)) {
      return; // Silent drop
    }

    const triggerKeyword = (await db.getSetting('TRIGGER_KEYWORD') || 'brain').toLowerCase();

    // Check if user exists
    const user = await db.getOne('SELECT * FROM users WHERE phone = $1', [cleanPhone]);

    if (user) {
      // EXISTING USER — only respond to BrainPing-related messages
      // If user is in active module/onboarding, accept any message (they're answering a question)
      const hasActiveSession = await db.getOne(
        'SELECT id FROM user_sessions WHERE user_id = $1 AND answered_at IS NULL AND sent_at IS NOT NULL LIMIT 1',
        [user.id]
      );
      const isInOnboarding = user.onboarding_step !== 'complete';
      const isInModule = user.module_state && user.module_state.module;

      // Accept message if: in onboarding, in module, has active question, or is a brainping keyword
      if (!isInOnboarding && !isInModule && !hasActiveSession && !isBrainPingMessage(content, triggerKeyword)) {
        return; // Silent ignore — not a BrainPing message
      }

      await whatsapp.updateMessageWindow(user.id);

      // Update chatwoot conversation ID if changed
      if (user.chatwoot_conversation_id !== conversationId) {
        await db.query('UPDATE users SET chatwoot_conversation_id = $1 WHERE id = $2', [conversationId, user.id]);
        user.chatwoot_conversation_id = conversationId;
      }

      // Parse module_state from DB
      if (typeof user.module_state === 'string') {
        try { user.module_state = JSON.parse(user.module_state); } catch (e) { user.module_state = null; }
      }

      // PAUSED USER - only respond to RESUME and STOP
      if (!user.is_active) {
        const cmd = content.toUpperCase().trim();
        if (cmd === 'RESUME') {
          await db.query('UPDATE users SET is_active = true WHERE id = $1', [user.id]);
          await whatsapp.sendMessage(conversationId, '▶️ Welcome back! Daily challenges will resume.');
        } else if (cmd === 'STOP') {
          await whatsapp.sendMessage(conversationId, '🛑 You have been unsubscribed. Type the trigger keyword to rejoin anytime.');
        }
        return;
      }

      // ONBOARDING IN PROGRESS
      if (user.onboarding_step !== 'complete') {
        await handleOnboarding(user, content, conversationId);
        return;
      }

      // TRY COMMAND FIRST
      const wasCommand = await handleCommand(user, content, conversationId);
      if (wasCommand) return;

      // FALLBACK: TREAT AS ANSWER
      await handleAnswer(user, content, conversationId);

    } else {
      // NEW USER - ONLY respond to trigger keyword
      const msgLower = content.toLowerCase().trim();

      if (msgLower === triggerKeyword) {
        const newUser = await db.getOne(
          `INSERT INTO users (phone, chatwoot_conversation_id, onboarding_step, last_user_message_at, window_open_until)
           VALUES ($1, $2, 'start', NOW(), NOW() + INTERVAL '23 hours 55 minutes')
           RETURNING *`,
          [cleanPhone, conversationId]
        );

        // Auto-assign plan from whitelist if configured
        const wlEntry = await db.getOne('SELECT plan_type FROM whitelist WHERE phone = $1 AND is_active = true', [cleanPhone]);
        if (wlEntry && wlEntry.plan_type && wlEntry.plan_type !== 'free') {
          const planRow = await db.getOne('SELECT id FROM plans WHERE LOWER(name) = $1', [wlEntry.plan_type.toLowerCase()]);
          if (planRow) {
            await db.query('UPDATE users SET plan_id = $1, is_premium = true WHERE id = $2', [planRow.id, newUser.id]);
          }
        }

        await handleOnboarding(newUser, content, conversationId);
      }
      // Else: unknown user, wrong keyword - complete silence
    }

  } catch (err) {
    console.error('Webhook error:', err);
  }
}

function extractPhone(payload) {
  if (payload.sender?.phone_number) return payload.sender.phone_number;
  if (payload.conversation?.contact?.phone_number) return payload.conversation.contact.phone_number;
  return null;
}

module.exports = { handleWebhook };
