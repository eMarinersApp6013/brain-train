const Anthropic = require('@anthropic-ai/sdk');
const { getSetting } = require('../db/pool');

async function getClient() {
  const apiKey = (await getSetting('ANTHROPIC_API_KEY')) || process.env.ANTHROPIC_API_KEY;
  const model = (await getSetting('CLAUDE_MODEL')) || 'claude-sonnet-4-6';
  const client = new Anthropic({ apiKey });
  return { client, model };
}

async function generateQuestions(type, difficulty, audience, count) {
  try {
    const { client, model } = await getClient();

    const systemPrompt = `You are a quiz question generator for a brain training app called BrainPing. Generate exactly ${count} questions as a JSON array. Each question object must have these fields:
- question_text: the question to ask
- hint_text: a helpful hint that doesn't give away the answer
- answer: the correct answer
- answer_type: one of "exact", "fuzzy", "multiple_choice", or "ai_check"
- explanation: a brief explanation of why the answer is correct
- tip_text: a learning tip related to the question
- points: point value (10-50 based on difficulty)

Return ONLY the JSON array, no other text.`;

    const userMessage = `Generate ${count} ${difficulty} difficulty ${type} questions for a ${audience} audience.`;

    const response = await client.messages.create({
      model,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }]
    });

    const text = response.content[0].text;
    const questions = JSON.parse(text);
    return questions;
  } catch (err) {
    console.error('Claude generateQuestions error:', err.message);
    throw err;
  }
}

async function generateCoachMessage(userStats) {
  try {
    const { client, model } = await getClient();
    const { name, weakestArea, strongestArea, streak, accuracy } = userStats;

    const response = await client.messages.create({
      model,
      max_tokens: 256,
      system: 'You are a friendly and encouraging brain training coach. Keep your response to exactly 2 sentences.',
      messages: [{
        role: 'user',
        content: `Generate a personalized coaching message for ${name}. Their strongest area is ${strongestArea}, weakest area is ${weakestArea}. They have a ${streak}-day streak and ${accuracy}% accuracy.`
      }]
    });

    return response.content[0].text.trim();
  } catch (err) {
    console.error('Claude generateCoachMessage error:', err.message);
    throw err;
  }
}

async function generateHint(questionText, answer) {
  try {
    const { client, model } = await getClient();

    const response = await client.messages.create({
      model,
      max_tokens: 256,
      system: 'You are a helpful tutor. Generate a hint for the given question that guides the user toward the answer without giving it away. Keep it to one sentence.',
      messages: [{
        role: 'user',
        content: `Question: ${questionText}\nAnswer (do NOT reveal this): ${answer}\n\nGenerate a helpful hint.`
      }]
    });

    return response.content[0].text.trim();
  } catch (err) {
    console.error('Claude generateHint error:', err.message);
    throw err;
  }
}

async function generateExplanation(questionText, answer, userAnswer) {
  try {
    const { client, model } = await getClient();

    const response = await client.messages.create({
      model,
      max_tokens: 512,
      system: 'You are a knowledgeable tutor. Explain why the correct answer is what it is. Be concise but educational. If the user gave a wrong answer, gently explain why it was incorrect.',
      messages: [{
        role: 'user',
        content: `Question: ${questionText}\nCorrect answer: ${answer}\nUser's answer: ${userAnswer}\n\nExplain why the correct answer is "${answer}".`
      }]
    });

    return response.content[0].text.trim();
  } catch (err) {
    console.error('Claude generateExplanation error:', err.message);
    throw err;
  }
}

module.exports = {
  getClient,
  generateQuestions,
  generateCoachMessage,
  generateHint,
  generateExplanation
};
