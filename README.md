# 🤖 Divyesh WhatsApp Bot

A personal AI assistant on WhatsApp for **Divyesh Patel**, a graphic designer based in Mumbai. Built with Node.js, Meta WhatsApp Cloud API, Google Gemini, and Supabase — all on **free tiers**.

---

## ✨ Features

| Feature | Details |
|---|---|
| 💬 AI Replies | Gemini 1.5 Flash — Hinglish/Hindi, friendly & personal |
| 🧠 Memory | Supabase DB stores name, skills, clients, deadlines, facts |
| 🎙️ Voice Notes | Transcribed by Gemini multimodal, replied in text |
| 📌 "Yaad Rakhna" | Mention this phrase to save any fact forever |
| ⏰ Daily Reminder | Morning task briefing at 9:00 AM IST via cron |
| 🔒 Secure | All secrets in env vars, never hardcoded |

---

## 🏗️ Architecture

```
WhatsApp User
     │
     ▼
Meta Cloud API  ──webhook──▶  Express Server (Render)
                                    │
                      ┌─────────────┼─────────────┐
                      ▼             ▼              ▼
                 Gemini AI    Supabase DB    node-cron
                (replies +   (user memory)  (9AM IST
                transcribe)                 reminder)
```

---

## 📋 Prerequisites

- [Node.js 18+](https://nodejs.org/)
- [Meta Developer Account](https://developers.facebook.com/) (free)
- [Google AI Studio account](https://aistudio.google.com/) (free Gemini API key)
- [Supabase account](https://supabase.com/) (free tier)
- [Render account](https://render.com/) (free tier)
- A WhatsApp number registered on Meta Business

---

## 🗄️ Step 1: Supabase Setup

1. Go to [supabase.com](https://supabase.com) → **New Project**
2. After project is ready, go to **SQL Editor** and run:

```sql
CREATE TABLE user_memory (
  phone         TEXT PRIMARY KEY,
  name          TEXT,
  skills        JSONB DEFAULT '[]'::jsonb,
  routine       TEXT,
  clients       JSONB DEFAULT '[]'::jsonb,
  deadlines     JSONB DEFAULT '[]'::jsonb,
  facts         JSONB DEFAULT '[]'::jsonb,
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS) but allow service key access
ALTER TABLE user_memory ENABLE ROW LEVEL SECURITY;

-- Allow all operations for authenticated/service role
CREATE POLICY "Allow all for service role" ON user_memory
  FOR ALL USING (true) WITH CHECK (true);
```

3. Go to **Settings → API**:
   - Copy **Project URL** → `SUPABASE_URL`
   - Copy **anon/public key** → `SUPABASE_KEY`

---

## 🔑 Step 2: Google Gemini API Key

1. Go to [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
2. Click **Create API Key**
3. Copy the key → `GEMINI_API_KEY`

> **Free tier**: 15 requests/minute, 1 million tokens/day — plenty for personal use.

---

## 📱 Step 3: Meta WhatsApp Cloud API Setup

1. Go to [developers.facebook.com](https://developers.facebook.com) → **My Apps → Create App**
2. Choose **Business** type, name it `Divyesh Bot`
3. Add **WhatsApp** product to your app
4. Under **WhatsApp → API Setup**:
   - Note down your **Phone Number ID** → `PHONE_NUMBER_ID`
   - Click **Generate Token** → copy → `WHATSAPP_TOKEN`
5. Under **WhatsApp → Configuration**:
   - Set **Callback URL**: `https://your-render-url.onrender.com/webhook`
   - Set **Verify Token**: same as your `VERIFY_TOKEN` env var
   - Subscribe to: `messages`
6. Click **Verify and Save** (your server must be running and reachable)

---

## 💻 Step 4: Local Development

```bash
# 1. Clone / navigate to project
cd divyesh-whatsapp-bot

# 2. Install dependencies
npm install

# 3. Create .env from example
cp .env.example .env
# Edit .env and fill in all values

# 4. Start the dev server
npm run dev
# Server starts at http://localhost:3000

# 5. Expose local server to internet for Meta webhook testing
# Install ngrok: https://ngrok.com/
ngrok http 3000
# Use the https://xxxx.ngrok.io URL as your Meta callback URL
```

**Test the health endpoint:**
```bash
curl http://localhost:3000/
# {"status":"ok","message":"Divyesh WhatsApp Bot is running 🚀"}
```

**Test webhook verification:**
```bash
curl "http://localhost:3000/webhook?hub.mode=subscribe&hub.verify_token=divyesh_bot_secret_2024&hub.challenge=test123"
# Should return: test123
```

---

## 🚀 Step 5: Deploy on Render (Free Plan)

### 5.1 Push to GitHub

```bash
# In project directory
git init
git add .
git commit -m "Initial commit: Divyesh WhatsApp Bot"

# Create a repo on github.com, then:
git remote add origin https://github.com/YOUR_USERNAME/divyesh-whatsapp-bot.git
git push -u origin main
```

> ⚠️ Make sure `.env` is in your `.gitignore` — never push real secrets!

### 5.2 Create Render Web Service

1. Go to [render.com](https://render.com) → **New → Web Service**
2. Connect your GitHub account and select the repo
3. Configure:

| Setting | Value |
|---|---|
| **Name** | `divyesh-whatsapp-bot` |
| **Region** | Singapore (closest to India) |
| **Branch** | `main` |
| **Runtime** | `Node` |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |
| **Plan** | **Free** |

### 5.3 Add Environment Variables on Render

In your Render service → **Environment** tab, add:

| Key | Value |
|---|---|
| `WHATSAPP_TOKEN` | Your Meta permanent token |
| `PHONE_NUMBER_ID` | Your Meta phone number ID |
| `VERIFY_TOKEN` | `divyesh_bot_secret_2024` (or your chosen value) |
| `GEMINI_API_KEY` | Your Google AI Studio key |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_KEY` | Your Supabase anon key |

4. Click **Create Web Service**
5. Wait for deploy — Render gives you a URL like `https://divyesh-whatsapp-bot.onrender.com`

### 5.4 Update Meta Webhook URL

Go back to Meta Developer Console → **WhatsApp → Configuration**:
- Update Callback URL to: `https://divyesh-whatsapp-bot.onrender.com/webhook`
- Click **Verify and Save**

---

## ⚠️ Render Free Plan — Important Notes

> [!WARNING]
> Render free services **spin down after 15 minutes of inactivity**. When a WhatsApp message comes in after the service is asleep, the first message might be delayed ~30-60 seconds while the service wakes up. Meta will retry, so the message won't be lost.

**To keep it always awake (optional):**
Use a free uptime monitor like [UptimeRobot](https://uptimerobot.com/) to ping `https://your-app.onrender.com/` every 10 minutes.

> [!NOTE]
> The 9 AM IST cron job may not fire if the server is asleep. The UptimeRobot ping above will also solve this.

---

## 🧠 How Memory Works

The bot automatically extracts and remembers:

| Trigger | What Gets Stored |
|---|---|
| `"yaad rakhna"` or `"yaad rakh"` in message | Saves the entire message as a fact |
| `"client XYZ"` or `"working with XYZ"` | Adds XYZ to clients list |
| `"deadline on [date]"` / `"due by [date]"` | Adds deadline entry |
| `"I know [skill]"` / `"I use [skill]"` | Adds to skills list |
| `"mera routine..."` / `"har roz..."` | Updates daily routine |

**Example messages Divyesh can send:**
```
"Yaad rakhna — Rajan ka logo Friday tak chahiye"
"Working with new client TechStartup Inc"
"Deadline on 25th November for brand kit"
"I use Figma, Illustrator, and Photoshop"
```

---

## 🎙️ Voice Note Support

Just send a voice note on WhatsApp — the bot will:
1. Download the audio from Meta servers
2. Transcribe using Gemini 1.5 Flash (supports Hindi, Hinglish, English)
3. Reply with the AI response in text

---

## 🔧 Troubleshooting

| Issue | Fix |
|---|---|
| Webhook verification fails | Make sure `VERIFY_TOKEN` matches exactly in both `.env` and Meta console |
| Bot not replying | Check Render logs; check `WHATSAPP_TOKEN` is valid and not expired |
| Supabase errors | Verify `SUPABASE_URL` and `SUPABASE_KEY`; check the table was created |
| Voice notes not working | Gemini free tier has audio size limits; keep voice notes under 1 minute |
| Morning reminder not firing | Render free service may be asleep; set up UptimeRobot pinger |
| "Token expired" from Meta | Generate a new Permanent Token from Meta System User settings |

---

## 📁 Project Structure

```
divyesh-whatsapp-bot/
├── index.js              # Entry point — Express + cron startup
├── src/
│   ├── webhook.js        # Meta webhook handler + WhatsApp sender
│   ├── gemini.js         # Gemini AI replies & morning briefing
│   ├── supabase.js       # DB: user memory CRUD
│   ├── transcribe.js     # Voice note → text via Gemini multimodal
│   └── reminder.js       # 9 AM IST daily cron reminder
├── package.json
├── .env.example          # Template for environment variables
└── README.md
```

---

## 📄 License

MIT — Personal use project for Divyesh Patel 🎨
