const cron = require('node-cron');
const axios = require('axios');
const { getAllUsers, getUserMemory } = require('./supabase');
const { getMorningBriefing } = require('./gemini');

const WHATSAPP_API_URL = 'https://graph.facebook.com/v18.0';

/**
 * Send a WhatsApp text message (local copy to avoid circular deps)
 */
async function sendMessage(to, text) {
  try {
    await axios.post(
      `${WHATSAPP_API_URL}/${process.env.PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: { body: text },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );
    console.log(`⏰ Morning reminder sent to ${to}`);
  } catch (err) {
    console.error(`❌ Reminder send failed for ${to}:`, err.response?.data || err.message);
  }
}

/**
 * Send morning briefing to all users
 */
async function sendMorningReminders() {
  console.log('⏰ Running morning reminder job...');
  const users = await getAllUsers();

  if (!users || users.length === 0) {
    console.log('ℹ️ No users found for morning reminder.');
    return;
  }

  for (const user of users) {
    try {
      const memory = await getUserMemory(user.phone);
      const briefing = await getMorningBriefing(memory || {});
      await sendMessage(user.phone, briefing);
      // Small delay between messages to respect rate limits
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (err) {
      console.error(`❌ Morning reminder error for ${user.phone}:`, err.message);
    }
  }

  console.log(`✅ Morning reminders sent to ${users.length} user(s)`);
}

/**
 * Start the cron scheduler
 * 9:00 AM IST = 03:30 UTC
 * Cron: 30 3 * * *
 */
function startReminderScheduler() {
  cron.schedule(
    '30 3 * * *',
    async () => {
      await sendMorningReminders();
    },
    {
      timezone: 'UTC',
    }
  );
  console.log('✅ Cron scheduled: Morning reminder at 9:00 AM IST (03:30 UTC) daily');
}

module.exports = { startReminderScheduler, sendMorningReminders };
