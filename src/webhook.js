const express = require('express');
const axios = require('axios');
const { getGeminiReply } = require('./gemini');
const { getUserMemory, upsertUserMemory, addFact } = require('./supabase');
const { transcribeAudio } = require('./transcribe');

const router = express.Router();

const WHATSAPP_API_URL = 'https://graph.facebook.com/v18.0';
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

// ─── Webhook Verification (GET) ───────────────────────────────────────────────
router.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.VERIFY_TOKEN) {
    console.log('✅ Webhook verified by Meta');
    return res.status(200).send(challenge);
  }
  console.warn('❌ Webhook verification failed');
  return res.sendStatus(403);
});

// ─── Incoming Messages (POST) ─────────────────────────────────────────────────
router.post('/', async (req, res) => {
  // Always respond 200 immediately so Meta doesn't retry
  res.sendStatus(200);

  try {
    const body = req.body;

    if (body.object !== 'whatsapp_business_account') return;

    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    if (!value?.messages || value.messages.length === 0) return;

    const message = value.messages[0];
    const senderPhone = message.from;
    const contactName = value.contacts?.[0]?.profile?.name || 'Divyesh';
    const msgType = message.type;

    console.log(`📩 Message from ${contactName} (${senderPhone}) | Type: ${msgType}`);

    // ── Load user memory ──────────────────────────────────────────────────────
    let userMemory = await getUserMemory(senderPhone);

    // If new user, create their memory record
    if (!userMemory) {
      userMemory = { phone: senderPhone, name: contactName, facts: [], clients: [], deadlines: [], skills: [] };
      await upsertUserMemory(senderPhone, userMemory);
    } else if (!userMemory.name && contactName) {
      // Update name if we now have it
      await upsertUserMemory(senderPhone, { name: contactName });
      userMemory.name = contactName;
    }

    let userText = '';

    // ── Handle Text Message ───────────────────────────────────────────────────
    if (msgType === 'text') {
      userText = message.text?.body || '';
    }

    // ── Handle Audio / Voice Note ─────────────────────────────────────────────
    else if (msgType === 'audio') {
      const mediaId = message.audio?.id;
      if (!mediaId) return;

      try {
        // Step 1: Get the media URL from Meta
        const mediaMetaRes = await axios.get(
          `${WHATSAPP_API_URL}/${mediaId}`,
          { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` } }
        );
        const mediaUrl = mediaMetaRes.data?.url;
        const mimeType = mediaMetaRes.data?.mime_type || 'audio/ogg';

        if (!mediaUrl) {
          await sendWhatsAppMessage(senderPhone, '🎙️ Voice note mil gayi, lekin download nahi ho payi. Try karo dobara!');
          return;
        }

        // Step 2: Download the audio binary
        const audioRes = await axios.get(mediaUrl, {
          headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` },
          responseType: 'arraybuffer',
        });
        const audioBuffer = Buffer.from(audioRes.data);

        // Step 3: Transcribe
        await sendWhatsAppMessage(senderPhone, '🎙️ Voice note sun raha hoon...');
        userText = await transcribeAudio(audioBuffer, mimeType);
        console.log(`📝 Transcription result: "${userText}"`);
      } catch (audioErr) {
        console.error('❌ Audio processing error:', audioErr.message);
        await sendWhatsAppMessage(senderPhone, '😅 Voice note process nahi ho payi. Text mein likh do bhai!');
        return;
      }
    }

    // ── Unsupported message type ──────────────────────────────────────────────
    else {
      await sendWhatsAppMessage(senderPhone, '😅 Yeh type ka message abhi support nahi karta. Text ya voice note bhejo!');
      return;
    }

    if (!userText.trim()) return;

    // ── Handle "yaad rakhna" keyword ──────────────────────────────────────────
    const lowerText = userText.toLowerCase();
    if (lowerText.includes('yaad rakhna') || lowerText.includes('yaad rakh') || lowerText.includes('remember this')) {
      await addFact(senderPhone, userText);
      // Also get a natural reply confirming the memory
    }

    // ── Extract & update user data from message (basic NLP hints) ────────────
    await extractAndUpdateMemory(senderPhone, userText, userMemory);

    // ── Reload updated memory ─────────────────────────────────────────────────
    const freshMemory = await getUserMemory(senderPhone);

    // ── Get Gemini reply ──────────────────────────────────────────────────────
    const reply = await getGeminiReply(userText, freshMemory || userMemory);

    // ── Send reply ────────────────────────────────────────────────────────────
    await sendWhatsAppMessage(senderPhone, reply);
  } catch (err) {
    console.error('❌ Webhook POST handler error:', err.message);
  }
});

// ─── Extract & update memory from message content ─────────────────────────────
async function extractAndUpdateMemory(phone, text, currentMemory) {
  try {
    const lower = text.toLowerCase();
    const updates = {};

    // Detect client mentions: "client XYZ", "working with ABC"
    const clientMatch = text.match(/(?:client|working with|project for)\s+([A-Z][a-zA-Z\s]{2,20})/i);
    if (clientMatch) {
      const newClient = clientMatch[1].trim();
      const clients = currentMemory?.clients || [];
      if (!clients.includes(newClient)) {
        updates.clients = [...clients, newClient];
      }
    }

    // Detect deadline: "deadline on [date]", "submit by [date]"
    const deadlineMatch = text.match(/(?:deadline|submit by|due on|due by)\s+(.{3,30}?)(?:\.|,|$)/i);
    if (deadlineMatch) {
      const deadlines = currentMemory?.deadlines || [];
      const newDeadline = { task: text.substring(0, 50), date: deadlineMatch[1].trim() };
      updates.deadlines = [...deadlines, newDeadline].slice(-10); // Keep last 10
    }

    // Detect skills: "I know", "I work in", "I use"
    const skillMatch = text.match(/(?:I (?:know|work in|use|do)|mujhe aata hai|main karta hoon)\s+([a-zA-Z\s,]{3,40})/i);
    if (skillMatch) {
      const skills = currentMemory?.skills || [];
      const newSkill = skillMatch[1].trim();
      if (!skills.includes(newSkill)) {
        updates.skills = [...skills, newSkill];
      }
    }

    // Detect routine update: "mera routine", "daily I"
    if (lower.includes('mera routine') || lower.includes('daily i ') || lower.includes('har roz')) {
      updates.routine = text;
    }

    if (Object.keys(updates).length > 0) {
      await upsertUserMemory(phone, updates);
    }
  } catch (err) {
    console.error('❌ extractAndUpdateMemory error:', err.message);
  }
}

// ─── Send WhatsApp Text Message ───────────────────────────────────────────────
async function sendWhatsAppMessage(to, text) {
  try {
    await axios.post(
      `${WHATSAPP_API_URL}/${PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: to,
        type: 'text',
        text: { body: text },
      },
      {
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );
    console.log(`✅ Message sent to ${to}`);
  } catch (err) {
    const errData = err.response?.data || err.message;
    console.error(`❌ Failed to send message to ${to}:`, JSON.stringify(errData));
  }
}

module.exports = router;
module.exports.sendWhatsAppMessage = sendWhatsAppMessage;
