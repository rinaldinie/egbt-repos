#!/usr/bin/env node

/**
 * Script per simulare comandi Telegram durante il debug
 *
 * Uso:
 * 1. Avvia il bot in debug (F5)
 * 2. In un altro terminale nel container, lancia questo script
 */

const TelegramBot = require('node-telegram-bot-api');

// Simula un messaggio Telegram
class TelegramSimulator {
  constructor(token) {
    // Non connettersi realmente, solo per simulare
    this.token = token;
  }

  // Crea un messaggio simulato
  createMockMessage(chatId, text, userId = 12345) {
    return {
      message_id: Date.now(),
      from: {
        id: userId,
        is_bot: false,
        first_name: 'Test',
        username: 'test_user'
      },
      chat: {
        id: chatId,
        first_name: 'Test',
        username: 'test_user',
        type: 'private'
      },
      date: Math.floor(Date.now() / 1000),
      text: text
    };
  }

  // Simula il comando /start
  simulateStart() {
    console.log('📤 Simulando comando /start...');
    console.log('Messaggio:', JSON.stringify(this.createMockMessage(123456, '/start'), null, 2));
    return this.createMockMessage(123456, '/start');
  }

  // Simula il comando /help
  simulateHelp() {
    console.log('📤 Simulando comando /help...');
    console.log('Messaggio:', JSON.stringify(this.createMockMessage(123456, '/help'), null, 2));
    return this.createMockMessage(123456, '/help');
  }
}

// Se eseguito direttamente
if (require.main === module) {
  console.log('🤖 Telegram Command Simulator');
  console.log('=============================\n');

  console.log('Per simulare comandi durante il debug:');
  console.log('1. Metti un breakpoint nel CommandHandler (src/handlers/CommandHandler.js)');
  console.log('2. Avvia il bot con F5 (Debug: Launch Bot Modular)');
  console.log('3. Usa l\'app Telegram reale o modifica il codice per testare\n');

  console.log('Comandi disponibili:');
  console.log('• /start  - Avvia il bot e mostra il benvenuto');
  console.log('• /help   - Mostra questo messaggio di aiuto\n');

  console.log('⚠️  Per testare davvero, devi:');
  console.log('1. Configurare BOT_TOKEN in .env');
  console.log('2. Inviare i comandi dal tuo account Telegram al bot');
  console.log('   (cerca @tuo_bot_username su Telegram)');
}

module.exports = TelegramSimulator;
