/**
 * Bot principale Epic Games Free - Architettura Modulare
 * Versione rifattorizzata con separazione delle responsabilità
 */

const TelegramBot = require('node-telegram-bot-api');
const cron = require('node-cron');
const http = require('http');
const dotenv = require('dotenv');

// Import dei moduli
const DatabaseManager = require('./src/database/DatabaseManager');
const EpicGamesService = require('./src/services/EpicGamesService');
const DiagnosticsService = require('./src/diagnostics/DiagnosticsService');
const CommandHandler = require('./src/handlers/CommandHandler');

// Carica le variabili d'ambiente
dotenv.config();

class EpicGamesBot {
  constructor() {
    this.botToken = process.env.TELEGRAM_BOT_TOKEN || '';
    this.dbPath = process.env.DATABASE_PATH || './bot.db';
    this.checkSchedule = process.env.CHECK_SCHEDULE || '0 18 * * *';
    this.webhookUrl = process.env.WEBHOOK_URL || '';
    this.useWebhook = process.env.USE_WEBHOOK === 'true';

    // ID dell'amministratore (da impostare nelle variabili d'ambiente)
    this.adminId = process.env.ADMIN_ID;

    if (!this.botToken) {
      throw new Error('TELEGRAM_BOT_TOKEN is required');
    }

    // Inizializza i servizi
    this.databaseManager = new DatabaseManager(this.dbPath);
    this.epicGamesService = new EpicGamesService();
    this.diagnosticsService = new DiagnosticsService(this.databaseManager, this.epicGamesService);

    // Configura il bot per webhook o polling
    if (this.useWebhook && this.webhookUrl) {
      this.bot = new TelegramBot(this.botToken, { webHook: true });
      this.bot.setWebHook(this.webhookUrl);
    } else {
      this.bot = new TelegramBot(this.botToken, { polling: true });
    }

    this.init();
  }

  async init() {
    try {
      await this.databaseManager.init();

      // Inizializza gli handler dei comandi
      this.commandHandler = new CommandHandler(
        this.bot,
        this.databaseManager,
        this.epicGamesService,
        this.diagnosticsService,
        this.adminId
      );

      this.setupScheduler();

      if (this.useWebhook) {
        this.setupWebhookServer();
      }

      console.log('✅ Bot Epic Games inizializzato con successo!');
      console.log(`🔧 Modalità: ${this.useWebhook ? 'Webhook' : 'Polling'}`);

      // Avviso per configurazione admin
      if (!this.adminId) {
        console.log('⚠️ ATTENZIONE: ADMIN_ID non configurato. Il comando /admin sarà disabilitato.');
        console.log('💡 Per abilitare il comando admin, imposta la variabile d\'ambiente ADMIN_ID con il tuo Telegram user ID.');
      } else {
        console.log(`🔑 Comando admin abilitato per l'utente ID: ${this.adminId}`);
      }

    } catch (error) {
      console.error('❌ Errore durante l\'inizializzazione del bot:', error);
      process.exit(1);
    }
  }

  setupWebhookServer() {
    const PORT = process.env.PORT || 3000;

    const server = http.createServer((req, res) => {
      // Health check endpoint
      if (req.method === 'GET' && req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'ok',
          timestamp: new Date().toISOString(),
          mode: 'webhook'
        }));
        return;
      }

      // Webhook endpoint
      if (req.method === 'POST' && req.url === '/webhook') {
        let body = '';
        req.on('data', chunk => {
          body += chunk.toString();
        });
        req.on('end', () => {
          try {
            const update = JSON.parse(body);
            this.bot.processUpdate(update);
            res.writeHead(200);
            res.end('OK');
          } catch (error) {
            console.error('Errore nel processare webhook:', error);
            res.writeHead(400);
            res.end('Bad Request');
          }
        });
        return;
      }

      // 404 per altre rotte
      res.writeHead(404);
      res.end('Not Found');
    });

    server.listen(PORT, () => {
      console.log(`🌐 Server webhook in ascolto sulla porta ${PORT}`);
      console.log(`🔗 Health check: http://localhost:${PORT}/health`);
      console.log(`🪝 Webhook URL: ${this.webhookUrl}`);
    });
  }

  setupScheduler() {
    // Configura lo scheduler per controllare i giochi gratuiti
    cron.schedule(this.checkSchedule, () => {
      this.checkAndNotifyFreeGames();
    });

    // Esegui un controllo immediato all'avvio
    setTimeout(() => {
      this.checkAndNotifyFreeGames();
    }, 5000);

    console.log(`⏰ Scheduler configurato con orario: ${this.checkSchedule}`);
  }

  async checkAndNotifyFreeGames() {
    console.log('🔍 Controllo giornaliero dei giochi gratuiti...');

    try {
      const freeGames = await this.epicGamesService.getFreeGames();
      const newFreeGames = [];

      for (const game of freeGames) {
        const wasNotified = await this.databaseManager.wasNotified(game.id);
        if (!wasNotified) {
          newFreeGames.push(game);
          await this.databaseManager.markAsNotified(game);
        }
      }

      if (newFreeGames.length > 0) {
        console.log(`🎉 Trovati ${newFreeGames.length} nuovi giochi gratuiti!`);
        await this.notifyAllUsers(newFreeGames);
      } else {
        console.log('ℹ️ Nessun nuovo gioco gratuito trovato.');
      }
    } catch (error) {
      console.error('❌ Errore durante il controllo dei giochi gratuiti:', error);
    }
  }

  async notifyAllUsers(freeGames) {
    const users = await this.databaseManager.getSubscribedUsers();

    for (const user of users) {
      try {
        await this.commandHandler.sendFreeGamesMessage(user.chat_id, freeGames);
        console.log(`✅ Notifica inviata a ${user.username || user.first_name} (ID: ${user.id})`);

        // Piccolo delay tra le notifiche per evitare rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`❌ Errore nell'inviare notifica a ${user.id}:`, error);
      }
    }
  }

  start() {
    console.log('🚀 Bot Epic Games avviato e in ascolto...');
  }

  async stop() {
    console.log('🛑 Arresto del bot...');
    await this.databaseManager.close();
    if (this.bot && this.bot.polling) {
      this.bot.stopPolling();
    }
    console.log('✅ Bot arrestato correttamente');
  }
}

// Gestione graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Ricevuto segnale SIGINT, arresto in corso...');
  if (bot) {
    await bot.stop();
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Ricevuto segnale SIGTERM, arresto in corso...');
  if (bot) {
    await bot.stop();
  }
  process.exit(0);
});

// Avvia il bot
let bot;
try {
  bot = new EpicGamesBot();
  bot.start();
} catch (error) {
  console.error('❌ Errore fatale nell\'avvio del bot:', error);
  process.exit(1);
}

module.exports = EpicGamesBot;