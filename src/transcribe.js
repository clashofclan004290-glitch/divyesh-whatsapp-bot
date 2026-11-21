const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Transcribe an audio buffer using Gemini's multimodal capability
 * @param {Buffer} audioBuffer - The audio file buffer
 * @param {string} mimeType - MIME type of the audio (e.g. 'audio/ogg; codecs=opus')
 * @returns {Promise<string>} - Transcribed text
 */
async function transcribeAudio(audioBuffer, mimeType) {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    // Convert buffer to base64
    const base64Audio = audioBuffer.toString('base64');

    // Normalize mimeType — Gemini prefers clean mime types
    const cleanMime = mimeType.split(';')[0].trim() || 'audio/ogg';

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: cleanMime,
          data: base64Audio,
        },
      },
      {
        text: 'Please transcribe this audio message accurately. The speaker may be speaking in Hindi, Hinglish (mix of Hindi and English), or English. Return only the transcribed text, nothing else.',
      },
    ]);

    const response = await result.response;
    const transcription = response.text().trim();

    if (!transcription) {
      return '[Audio samajh nahi aaya, please text mein likhein 🙏]';
    }

    console.log(`🎤 Transcribed: "${transcription.substring(0, 80)}..."`);
    return transcription;
  } catch (error) {
    console.error('❌ Transcription error:', error.message);
    return '[Audio samajh nahi aaya, please text mein likhein 🙏]';
  }
}

module.exports = { transcribeAudio };
