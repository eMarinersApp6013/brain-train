const OpenAI = require('openai');
const { getSetting } = require('../db/pool');

async function getClient() {
  const apiKey = (await getSetting('OPENAI_API_KEY')) || process.env.OPENAI_API_KEY;
  const model = (await getSetting('OPENAI_MODEL')) || 'gpt-4o';
  const client = new OpenAI({ apiKey });
  return { client, model };
}

async function checkAnswer(questionText, correctAnswer, userAnswer, answerType) {
  try {
    const { client } = await getClient();

    if (answerType === 'fuzzy') {
      const response = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        max_tokens: 8,
        messages: [{
          role: 'user',
          content: `Correct answer: ${correctAnswer}. User said: ${userAnswer}. Is this correct? Reply YES or NO only.`
        }]
      });

      const reply = response.choices[0].message.content.trim().toUpperCase();
      return { correct: reply === 'YES', explanation: null };
    }

    // ai_check: full check with explanation
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 256,
      messages: [
        {
          role: 'system',
          content: 'You are an answer checker. Compare the user answer to the correct answer. Return a JSON object with "correct" (boolean) and "explanation" (string explaining why it is correct or incorrect). Return ONLY the JSON object.'
        },
        {
          role: 'user',
          content: `Question: ${questionText}\nCorrect answer: ${correctAnswer}\nUser's answer: ${userAnswer}\n\nIs the user's answer correct?`
        }
      ]
    });

    const text = response.choices[0].message.content.trim();
    const result = JSON.parse(text);
    return { correct: !!result.correct, explanation: result.explanation };
  } catch (err) {
    console.error('OpenAI checkAnswer error:', err.message);
    throw err;
  }
}

async function scoreBrainAge(responses) {
  try {
    const { client, model } = await getClient();

    const response = await client.chat.completions.create({
      model,
      max_tokens: 256,
      messages: [
        {
          role: 'system',
          content: 'You are a cognitive performance analyst. Based on quiz performance data, estimate a "brain age". Return a JSON object with "brainAge" (number, typically 20-80) and "label" (a short descriptor like "Sharp as a tack!" or "Room to grow"). Return ONLY the JSON object.'
        },
        {
          role: 'user',
          content: `Analyze this quiz performance and estimate a brain age:\n${JSON.stringify(responses, null, 2)}`
        }
      ]
    });

    const text = response.choices[0].message.content.trim();
    const result = JSON.parse(text);
    return { brainAge: Number(result.brainAge), label: result.label };
  } catch (err) {
    console.error('OpenAI scoreBrainAge error:', err.message);
    throw err;
  }
}

async function estimateIQ(responses) {
  try {
    const { client, model } = await getClient();

    const response = await client.chat.completions.create({
      model,
      max_tokens: 256,
      messages: [
        {
          role: 'system',
          content: 'You are a cognitive performance analyst. Based on quiz performance data, estimate an IQ range. Return a JSON object with "iqEstimate" (number, typically 85-145), "label" (a short descriptor like "Above Average" or "Gifted"), and "confidence" (one of "low", "medium", "high"). Return ONLY the JSON object.'
        },
        {
          role: 'user',
          content: `Analyze this quiz performance and estimate an IQ range:\n${JSON.stringify(responses, null, 2)}`
        }
      ]
    });

    const text = response.choices[0].message.content.trim();
    const result = JSON.parse(text);
    return {
      iqEstimate: Number(result.iqEstimate),
      label: result.label,
      confidence: result.confidence
    };
  } catch (err) {
    console.error('OpenAI estimateIQ error:', err.message);
    throw err;
  }
}

async function fuzzyMatchWord(expected, actual) {
  try {
    const { client } = await getClient();

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 8,
      messages: [{
        role: 'user',
        content: `Is "${actual}" semantically the same word as "${expected}"? Account for typos and minor spelling differences. Reply YES or NO only.`
      }]
    });

    const reply = response.choices[0].message.content.trim().toUpperCase();
    return reply === 'YES';
  } catch (err) {
    console.error('OpenAI fuzzyMatchWord error:', err.message);
    throw err;
  }
}

async function generateQuestions(type, difficulty, audience, count) {
  const { client, model } = await getClient();
  const response = await client.chat.completions.create({
    model,
    messages: [
      {
        role: 'system',
        content: `You are a brain training question generator. Generate ${count} ${type} questions at ${difficulty} difficulty for ${audience} audience. Return a JSON array of objects with fields: question_text, hint_text, answer, answer_type (exact/keyword/mcq/fuzzy), explanation, tip_text, points (10-30 based on difficulty). Return ONLY the JSON array, no markdown.`
      },
      { role: 'user', content: `Generate ${count} ${type} questions.` }
    ],
    temperature: 0.8
  });

  const text = response.choices[0].message.content.trim();
  const cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(cleanText);
}

module.exports = {
  getClient,
  checkAnswer,
  scoreBrainAge,
  estimateIQ,
  fuzzyMatchWord,
  generateQuestions
};
