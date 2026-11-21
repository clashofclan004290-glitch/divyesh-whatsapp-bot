const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const SYSTEM_PROMPT = `Tu Divyesh Patel ka personal AI assistant hai, bilkul Siri jaisa lekin aur bhi smart.
Divyesh ek talented graphic designer hai jo Mumbai mein kaam karta hai.
Tera kaam hai unhe unke clients, deadlines, daily routine, aur creative projects manage karne mein help karna.

Rules:
- Hamesha Hinglish ya Hindi mein baat kar (mix of Hindi + English is perfect)
- Short, friendly, aur helpful replies de — zyada lambi bakwaas mat kar
- Thoda casual reh, jaise koi close friend baat kar raha ho
- Deadlines yaad dilana, clients ka status puchna, kaam organize karna — yeh sab teri responsibility hai
- Kabhi bhi robotic ya formal mat lag
- Agar kuch yaad karna hai toh confirm kar ke bata "Yaad kar liya! ✅"
- Emojis ka thoda use karo — natural lage`;

/**
 * Get AI reply from Gemini
 * @param {string} userMessage - The user's message
 * @param {object} userContext - User memory from Supabase
 * @returns {Promise<string>} - AI generated reply
 */
async function getGeminiReply(userMessage, userContext = {}) {
  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: SYSTEM_PROMPT,
    });

    // Build context string from user memory
    let contextParts = [];
    if (userContext.name) contextParts.push(`User ka naam: ${userContext.name}`);
    if (userContext.skills && userContext.skills.length > 0)
      contextParts.push(`Skills: ${userContext.skills.join(', ')}`);
    if (userContext.routine) contextParts.push(`Daily routine: ${userContext.routine}`);
    if (userContext.clients && userContext.clients.length > 0)
      contextParts.push(`Current clients: ${userContext.clients.join(', ')}`);
    if (userContext.deadlines && userContext.deadlines.length > 0)
      contextParts.push(`Upcoming deadlines: ${JSON.stringify(userContext.deadlines)}`);
    if (userContext.facts && userContext.facts.length > 0)
      contextParts.push(`Important facts to remember: ${userContext.facts.join(' | ')}`);

    const contextString =
      contextParts.length > 0
        ? `[User ke baare mein info]\n${contextParts.join('\n')}\n\n`
        : '';

    const fullPrompt = contextString + userMessage;

    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    return response.text().trim();
  } catch (error) {
    console.error('❌ Gemini error:', error.message);
    return 'Oops! Thoda technical issue aa gaya. Ek second mein try karo 🙏';
  }
}

/**
 * Generate morning task list for daily reminder
 * @param {object} userContext - User memory from Supabase
 * @returns {Promise<string>} - Morning briefing message
 */
async function getMorningBriefing(userContext = {}) {
  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: SYSTEM_PROMPT,
    });

    let contextParts = [];
    if (userContext.name) contextParts.push(`Naam: ${userContext.name}`);
    if (userContext.clients && userContext.clients.length > 0)
      contextParts.push(`Clients: ${userContext.clients.join(', ')}`);
    if (userContext.deadlines && userContext.deadlines.length > 0)
      contextParts.push(`Deadlines: ${JSON.stringify(userContext.deadlines)}`);
    if (userContext.routine) contextParts.push(`Routine: ${userContext.routine}`);
    if (userContext.facts && userContext.facts.length > 0)
      contextParts.push(`Important notes: ${userContext.facts.join(' | ')}`);

    const contextString = contextParts.join('\n');

    const prompt = `${contextString}\n\nAaj subah ka ek friendly morning briefing message bana. Include:\n- Ek motivational greeting\n- Aaj ke possible tasks ya deadlines\n- Koi important reminder\nShort rakho, max 5-6 lines. Hinglish mein.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text().trim();
  } catch (error) {
    console.error('❌ Gemini morning briefing error:', error.message);
    return '🌅 Good morning Divyesh bhai! Aaj ka din productive banao. Clients ko update karna mat bhoolna! 💪';
  }
}

module.exports = { getGeminiReply, getMorningBriefing };
