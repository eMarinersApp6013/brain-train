const axios = require('axios');
const { getSetting } = require('../db/pool');

const ACCOUNT_ID = process.env.CHATWOOT_ACCOUNT_ID || '1';

async function getConfig() {
  const url = (await getSetting('CHATWOOT_URL')) || process.env.CHATWOOT_URL;
  const token = (await getSetting('CHATWOOT_TOKEN')) || process.env.CHATWOOT_TOKEN;
  const inboxId = (await getSetting('CHATWOOT_INBOX_ID')) || process.env.CHATWOOT_INBOX_ID;

  return { url, token, inboxId };
}

async function sendMessage(conversationId, content) {
  try {
    const { url, token } = await getConfig();
    const response = await axios.post(
      `${url}/api/v1/accounts/${ACCOUNT_ID}/conversations/${conversationId}/messages`,
      { content, message_type: 'outgoing', private: false },
      { headers: { api_access_token: token } }
    );
    return response.data;
  } catch (err) {
    console.error('Chatwoot sendMessage error:', err.message);
    throw err;
  }
}

async function searchContact(phone) {
  try {
    const { url, token } = await getConfig();
    const response = await axios.get(
      `${url}/api/v1/accounts/${ACCOUNT_ID}/contacts/search`,
      {
        params: { q: phone },
        headers: { api_access_token: token }
      }
    );
    const contacts = response.data.payload;
    return contacts.length > 0 ? contacts[0] : null;
  } catch (err) {
    console.error('Chatwoot searchContact error:', err.message);
    throw err;
  }
}

async function createConversation(contactId, message) {
  try {
    const { url, token, inboxId } = await getConfig();
    const response = await axios.post(
      `${url}/api/v1/accounts/${ACCOUNT_ID}/contacts/${contactId}/conversations`,
      { inbox_id: inboxId, message: { content: message } },
      { headers: { api_access_token: token } }
    );
    return response.data;
  } catch (err) {
    console.error('Chatwoot createConversation error:', err.message);
    throw err;
  }
}

async function getOrCreateConversation(phone, initialMessage) {
  try {
    const contact = await searchContact(phone);
    if (!contact) {
      throw new Error(`No Chatwoot contact found for phone: ${phone}`);
    }

    const contactId = contact.id;

    // Check for an existing conversation on this contact
    const { url, token } = await getConfig();
    const convResponse = await axios.get(
      `${url}/api/v1/accounts/${ACCOUNT_ID}/contacts/${contactId}/conversations`,
      { headers: { api_access_token: token } }
    );

    const conversations = convResponse.data.payload;
    if (conversations && conversations.length > 0) {
      return { contactId, conversationId: conversations[0].id };
    }

    // No existing conversation - create one
    const newConv = await createConversation(contactId, initialMessage);
    return { contactId, conversationId: newConv.id };
  } catch (err) {
    console.error('Chatwoot getOrCreateConversation error:', err.message);
    throw err;
  }
}

module.exports = {
  getConfig,
  sendMessage,
  searchContact,
  createConversation,
  getOrCreateConversation
};
