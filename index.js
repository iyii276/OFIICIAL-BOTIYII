const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const OpenAI = require('openai');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Bot configuration
const ADMIN_NUMBER = '2347078226362@c.us';
const BOT_NAME = 'Iyii Bot';
const OFFICIAL_WEBSITE = 'https://iyii.onrender.com';
const AUDIOMACK_PROFILE = 'https://audiomack.com/Iyii217';

// Initialize OpenAI if API key is provided
const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
}) : null;

// Global states for bot management
const botState = {
  aiResponderEnabled: false,
  pairedSessions: new Map(),
  adminNumber: ADMIN_NUMBER
};

// WhatsApp client setup with authentication
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  }
});

// ==================== BOT FUNCTIONALITIES ====================

function isAdmin(number) {
  console.log('Checking admin:', number, 'Expected:', ADMIN_NUMBER);
  return number === ADMIN_NUMBER;
}

async function handleAdminCommand(message, command, args) {
  if (!isAdmin(message.from)) {
    await message.reply('❌ Unauthorized. Admin access required.');
    return;
  }

  switch (command) {
    case 'toggle_ai':
      if (!openai) {
        await message.reply('❌ AI features are unavailable. OpenAI API key not configured.');
        break;
      }
      botState.aiResponderEnabled = !botState.aiResponderEnabled;
      await message.reply(`✅ AI Auto-Responder ${botState.aiResponderEnabled ? 'ENABLED' : 'DISABLED'}`);
      console.log(`🔄 Admin toggled AI responder to: ${botState.aiResponderEnabled}`);
      break;
    case 'broadcast':
      const broadcastMessage = args.join(' ');
      if (broadcastMessage) {
        let successCount = 0;
        for (const [sessionId, session] of botState.pairedSessions.entries()) {
          try {
            await client.sendMessage(session.pairedNumber, `📢 *Broadcast from Admin:*\n\n${broadcastMessage}`);
            successCount++;
          } catch (error) {
            console.error(`Failed to broadcast to ${session.pairedNumber}:`, error);
          }
        }
        await message.reply(`📢 Broadcast sent to ${successCount} users`);
      } else {
        await message.reply('❌ Please provide a message to broadcast');
      }
      break;
    case 'stats':
      const stats = `🤖 *${BOT_NAME} Stats*\n\n` +
                   `✅ AI Auto-Responder: ${botState.aiResponderEnabled ? '🟢 ON' : '🔴 OFF'}\n` +
                   `🔗 Paired Sessions: ${botState.pairedSessions.size}\n` +
                   `🤝 Active Users: ${welcomedUsers.size}\n` +
                   `🔄 Status: Operational\n` +
                   `👑 Admin: ${ADMIN_NUMBER.replace('@c.us', '')}`;
      await message.reply(stats);
      break;
  }
}

function generateSessionId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

async function handlePairCommand(message) {
  const sessionId = generateSessionId();
  const userName = message._data?.notifyName || 'User';
  
  botState.pairedSessions.set(sessionId, {
    userInfo: userName,
    pairedAt: new Date(),
    pairedNumber: message.from
  });

  const pairMessage = `🔗 *Session Paired Successfully!*\n\n` +
                     `*Session ID:* ${sessionId}\n` +
                     `*Bot Name:* ${BOT_NAME}\n` +
                     `*Your Name:* ${userName}\n` +
                     `*Paired At:* ${new Date().toLocaleString()}\n\n` +
                     `💡 *Keep this ID safe to restore your session*\n\n` +
                     `🌐 *Website:* ${OFFICIAL_WEBSITE}\n` +
                     `🎵 *Audiomack:* ${AUDIOMACK_PROFILE}`;

  await message.reply(pairMessage);
}

async function restoreSession(sessionId, targetNumber) {
  if (botState.pairedSessions.has(sessionId)) {
    const session = botState.pairedSessions.get(sessionId);
    await client.sendMessage(targetNumber, 
      `✅ Session restored! Welcome back to ${BOT_NAME}`
    );
    return true;
  }
  return false;
}

async function generateAIResponse(userMessage, context) {
  if (!openai) {
    return "❌ AI features are currently unavailable. Please configure OPENAI_API_KEY environment variable.";
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `You are ${BOT_NAME}, a helpful WhatsApp assistant. Respond concisely and helpfully in a friendly tone. Context: ${context}`
        },
        {
          role: "user",
          content: userMessage
        }
      ],
      max_tokens: 150
    });

    return completion.choices[0].message.content;
  } catch (error) {
    console.error('OpenAI Error:', error);
    return "🤖 I'm having trouble thinking right now. Please try again later.";
  }
}

async function translateText(text, targetLanguage = 'english') {
  if (!openai) return "Translation unavailable - OpenAI not configured";

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{
        role: "user",
        content: `Translate this to ${targetLanguage}: "${text}"`
      }],
      max_tokens: 100
    });

    return completion.choices[0].message.content;
  } catch (error) {
    return "Translation failed. Please try again.";
  }
}

async function showMainMenu(message) {
  const menu = `
🎵 *${BOT_NAME} - Official Menu* 🎵

🤖 *AI Features*
• !ai <message> - Chat with AI
• !translate <text> <language> - Translate text

🔗 *Session Management*
• !pair - Generate your session ID
• !restore <id> - Restore your session
• !menu - Show this menu

🌐 *Official Links*
• Website: ${OFFICIAL_WEBSITE}
• Audiomack: ${AUDIOMACK_PROFILE}

👑 *Admin Commands*
• !toggle_ai - Toggle AI auto-responder
• !broadcast <msg> - Broadcast message
• !stats - Show bot statistics

*Auto-responder Status: ${botState.aiResponderEnabled ? '🟢 ON' : '🔴 OFF'}*
*Need help? Contact admin.*
  `.trim();

  await message.reply(menu);
}

// ==================== EVENT HANDLERS ====================

client.on('qr', (qr) => {
  qrcode.generate(qr, { small: true });
  console.log('QR Code generated. Scan with WhatsApp.');
});

client.on('ready', () => {
  console.log(`${BOT_NAME} is ready and operational!`);
});

client.on('auth_failure', (msg) => {
  console.error('Authentication failed:', msg);
});

client.on('disconnected', (reason) => {
  console.log('Client disconnected:', reason);
  console.log('Reconnecting...');
  client.initialize();
});

const welcomedUsers = new Set();

client.on('message', async (message) => {
  if (message.from === 'status@broadcast') return;

  const messageBody = message.body || '';
  const command = messageBody.toLowerCase().split(' ')[0];

  console.log(`📱 Message from ${message.from}: "${messageBody}"`);
  console.log(`🔧 Auto-responder state: ${botState.aiResponderEnabled}`);

  // Welcome new users
  if (!welcomedUsers.has(message.from) && !message.from.includes('status')) {
    welcomedUsers.add(message.from);
    setTimeout(async () => {
      await message.reply(
        `👋 Welcome to *${BOT_NAME}!*\n\n` +
        `I'm your AI-powered WhatsApp assistant. Type *!menu* to see all available commands.\n\n` +
        `*Quick Start:*\n• Use *!pair* to get your session ID\n• Use *!ai* to chat with AI\n• Use *!translate* for translations\n\n` +
        `*Auto-responder is currently: ${botState.aiResponderEnabled ? '🟢 ON' : '🔴 OFF'}*`
      );
    }, 1000);
  }

  if (messageBody.startsWith('!')) {
    const args = messageBody.slice(1).split(' ').slice(1);
    
    switch(command) {
      case '!menu':
        await showMainMenu(message);
        break;
      case '!pair':
        await handlePairCommand(message);
        break;
      case '!toggle_ai':
        await handleAdminCommand(message, 'toggle_ai', args);
        break;
      case '!broadcast':
        await handleAdminCommand(message, 'broadcast', args);
        break;
      case '!stats':
        await handleAdminCommand(message, 'stats', args);
        break;
      case '!translate':
        const textToTranslate = args.slice(0, -1).join(' ');
        const targetLang = args[args.length - 1] || 'english';
        if (textToTranslate) {
          const translation = await translateText(textToTranslate, targetLang);
          await message.reply(`🌍 Translation to ${targetLang}:\n${translation}`);
        } else {
          await message.reply('❌ Usage: !translate <text> <language>');
        }
        break;
      case '!ai':
        const aiQuery = args.join(' ');
        if (aiQuery) {
          const aiResponse = await generateAIResponse(aiQuery, 'user requested AI chat');
          await message.reply(`🤖 ${aiResponse}`);
        } else {
          await message.reply('❌ Usage: !ai <your message>');
        }
        break;
      case '!restore':
        const sessionId = args[0];
        if (sessionId) {
          if (await restoreSession(sessionId, message.from)) {
            await message.reply('✅ Session restored successfully!');
          } else {
            await message.reply('❌ Invalid session ID');
          }
        } else {
          await message.reply('❌ Usage: !restore <session-id>');
        }
        break;
      default:
        await message.reply('❌ Unknown command. Type *!menu* for available commands.');
    }
  } 
  // Auto-responder for non-commands when enabled
  else if (botState.aiResponderEnabled && !messageBody.startsWith('!') && messageBody.trim().length > 0) {
    console.log(`🤖 Auto-responding to message: "${messageBody}"`);
    const autoResponse = await generateAIResponse(messageBody, 'auto-responder mode');
    await message.reply(`🤖 ${autoResponse}`);
  }
});

// ==================== EXPRESS ROUTES ====================

app.get('/', (req, res) => {
  res.send(`
    <html>
      <head>
        <title>${BOT_NAME}</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; background: #f0f0f0; }
          .header { background: #25D366; color: white; padding: 30px; border-radius: 15px; text-align: center; }
          .status { background: white; padding: 20px; margin: 20px 0; border-radius: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
          .links a { display: block; margin: 10px 0; color: #25D366; text-decoration: none; font-weight: bold; }
          .status-on { color: #25D366; font-weight: bold; }
          .status-off { color: #ff4444; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🤖 ${BOT_NAME}</h1>
          <p>WhatsApp Bot is running and ready...</p>
        </div>
        <div class="status">
          <h3>📊 Bot Status: <span style="color: #25D366;">● Online</span></h3>
          <p>Paired Sessions: ${botState.pairedSessions.size}</p>
          <p>Active Users: ${welcomedUsers.size}</p>
          <p>AI Auto-Responder: <span class="${botState.aiResponderEnabled ? 'status-on' : 'status-off'}">${botState.aiResponderEnabled ? '🟢 ENABLED' : '🔴 DISABLED'}</span></p>
          <p>OpenAI: ${openai ? '✅ Configured' : '❌ Not Configured'}</p>
        </div>
        <div class="links">
          <h3>🔗 Quick Links:</h3>
          <a href="${OFFICIAL_WEBSITE}" target="_blank">🌐 Official Website</a>
          <a href="${AUDIOMACK_PROFILE}" target="_blank">🎵 Audiomack Profile</a>
          <a href="/health">📊 Bot Health Status</a>
        </div>
      </body>
    </html>
  `);
});

app.get('/health', (req, res) => {
  const uptime = process.uptime();
  res.status(200).json({
    status: 'ok',
    bot: BOT_NAME,
    ready: client.info ? true : false,
    sessions: botState.pairedSessions.size,
    activeUsers: welcomedUsers.size,
    aiEnabled: botState.aiResponderEnabled,
    openaiConfigured: !!openai,
    uptime: `${Math.floor(uptime / 60)}m ${Math.floor(uptime % 60)}s`,
    memory: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
    timestamp: new Date().toISOString()
  });
});

// ==================== START APPLICATION ====================

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
  console.log(`🌐 Health check: http://localhost:${port}/health`);
  console.log(`🤖 OpenAI: ${openai ? 'Configured' : 'Not configured'}`);
  console.log(`🔧 Auto-responder initial state: ${botState.aiResponderEnabled}`);
  console.log(`👑 Admin number: ${ADMIN_NUMBER}`);
});

client.initialize();

console.log('🤖 Starting Iyii Bot...');