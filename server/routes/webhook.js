const express = require('express');
const router = express.Router();
const { handleWebhook } = require('../webhook');
const { webhookLimiter } = require('../middleware/rateLimit');

router.post('/chatwoot', webhookLimiter, handleWebhook);

module.exports = router;
