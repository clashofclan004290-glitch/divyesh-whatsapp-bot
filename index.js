require('dotenv').config();
const express = require('express');
const webhookRouter = require('./src/webhook');
const { startReminderScheduler } = require('./src/reminder');

const app = express();
app.use(express.json());

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Divyesh WhatsApp Bot is running 🚀' });
});

// Webhook routes
app.use('/webhook', webhookRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  startReminderScheduler();
  console.log('⏰ Daily reminder scheduler started (9:00 AM IST)');
});
