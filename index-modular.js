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
const DashboardService = require('./src/dashboard/DashboardService');

// Carica le variabili d'ambiente
dotenv.config();

class EpicGamesBot {
  constructor() {
    this.botToken = process.env.TELEGRAM_BOT_TOKEN || '';
    this.checkSchedule = process.env.CHECK_SCHEDULE || '0 17 * * *';
    this.webhookUrl = process.env.WEBHOOK_URL || '';
    this.useWebhook = process.env.USE_WEBHOOK === 'true';

    // ID dell'amministratore (da impostare nelle variabili d'ambiente)
    this.adminId = process.env.ADMIN_ID ? parseInt(process.env.ADMIN_ID) : null;

    if (!this.botToken) {
      throw new Error('TELEGRAM_BOT_TOKEN is required');
    }

    // Inizializza i servizi
    this.databaseManager = new DatabaseManager();
    this.epicGamesService = new EpicGamesService();
    this.diagnosticsService = new DiagnosticsService(this.databaseManager, this.epicGamesService);
    this.dashboardService = new DashboardService(this.databaseManager, this.epicGamesService, this.diagnosticsService);

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
    const BACKUP_KEY = process.env.BACKUP_KEY || 'change-me-in-production';

    const server = http.createServer(async (req, res) => {
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

      // Backup database endpoint (protetto da chiave)
      // Per PostgreSQL: esporta i dati in formato JSON
      if (req.method === 'GET' && req.url.startsWith('/backup/db')) {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const key = url.searchParams.get('key');

        if (key === BACKUP_KEY) {
          try {
            const users = await this.databaseManager.getAllUsers();
            const games = await this.databaseManager.getNotifiedGames();
            const backupData = {
              timestamp: new Date().toISOString(),
              users: users,
              notifiedGames: games
            };
            const json = JSON.stringify(backupData, null, 2);
            const fileName = `bot-backup-${Date.now()}.json`;

            res.writeHead(200, {
              'Content-Type': 'application/json',
              'Content-Disposition': `attachment; filename="${fileName}"`,
              'Content-Length': Buffer.byteLength(json)
            });

            res.end(json);
            console.log(`📦 Database esportato: ${fileName}`);
          } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Backup failed', details: error.message }));
          }
        } else {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Unauthorized' }));
        }
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

      // Dashboard endpoint
      if (req.method === 'GET' && req.url === '/dashboard') {
        try {
          const html = await this.dashboardService.generateDashboard();
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(html);
        } catch (error) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Dashboard error', details: error.message }));
        }
        return;
      }

      // API endpoint per aggiungere utenti
      if (req.method === 'POST' && req.url === '/api/users') {
        let body = '';
        req.on('data', chunk => {
          body += chunk.toString();
        });
        req.on('end', async () => {
          try {
            const data = JSON.parse(body);
            await this.databaseManager.saveUserFromDashboard(data);
            res.writeHead(201, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ message: 'Utente aggiunto con successo' }));
          } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
          }
        });
        return;
      }

      // API endpoint per aggiungere giochi notificati (supporta array di giochi)
      if (req.method === 'POST' && req.url === '/api/games') {
        let body = '';
        req.on('data', chunk => {
          body += chunk.toString();
        });
        req.on('end', async () => {
          try {
            const data = JSON.parse(body);

            // Supporta sia un singolo gioco che un array di giochi
            const games = data.games || [data];
            const results = { success: [], errors: [] };

            for (const game of games) {
              try {
                await this.databaseManager.saveNotifiedGameFromDashboard(game);
                results.success.push(game.title || game.id);
              } catch (gameError) {
                results.errors.push({ game: game.title || game.id, error: gameError.message });
              }
            }

            const totalProcessed = results.success.length + results.errors.length;
            let message;

            if (results.errors.length === 0) {
              message = `${results.success.length} gioco/i importato/i con successo`;
            } else if (results.success.length === 0) {
              message = `Nessun gioco importato. Errori: ${results.errors.map(e => e.error).join(', ')}`;
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: message, details: results.errors }));
              return;
            } else {
              message = `${results.success.length} gioco/i importato/i, ${results.errors.length} errori`;
            }

            res.writeHead(201, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ message, results }));
          } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
          }
        });
        return;
      }

      // API endpoint per eseguire printDiagnostics
      if (req.method === 'GET' && req.url === '/api/diagnostics/print') {
        try {
          const diagnostics = await this.diagnosticsService.getDiagnostics();
          this.diagnosticsService.printDiagnostics(diagnostics);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ message: 'Diagnostica stampata nella console' }));
        } catch (error) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: error.message }));
        }
        return;
      }

      // API endpoint per forzare il controllo giornaliero dei giochi gratuiti
      if (req.method === 'POST' && req.url === '/api/check-games') {
        try {
          console.log('🔄 Controllo manuale dei giochi gratuiti richiesto dalla dashboard...');
          // Esegui il controllo in modo asincrono
          this.checkAndNotifyFreeGames();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            message: 'Controllo giochi gratuiti avviato! Controlla i log per i dettagli.',
            timestamp: new Date().toLocaleString('it-IT', { timeZone: process.env.TIMEZONE || 'Europe/Rome' })
          }));
        } catch (error) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: error.message }));
        }
        return;
      }

      // API endpoint per rinotificare i giochi di oggi
      if (req.method === 'POST' && req.url === '/api/notify-recent') {
        try {
          console.log('🔔 Rinotifica dei giochi di oggi richiesta dalla dashboard...');

          // Elimina tutti i giochi notificati oggi (stessa data)
          const deleted = await this.databaseManager.deleteTodayNotifiedGames();

          if (deleted === 0) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              message: 'Nessun gioco notificato oggi da rinotificare',
              timestamp: new Date().toISOString()
            }));
            return;
          }

          // Esegui il controllo e notifica
          await this.checkAndNotifyFreeGames();

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            message: `Eliminati ${deleted} giochi di oggi e avviata la notifica`,
            timestamp: new Date().toISOString()
          }));
        } catch (error) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: error.message }));
        }
        return;
      }

      // API endpoint per esportare i giochi notificati in JSON
      if (req.method === 'GET' && req.url === '/api/games/export') {
        try {
          const games = await this.databaseManager.getNotifiedGames();
          const exportData = {
            timestamp: new Date().toISOString(),
            totalGames: games.length,
            games: games
          };
          const json = JSON.stringify(exportData, null, 2);
          const fileName = `notified-games-${Date.now()}.json`;

          res.writeHead(200, {
            'Content-Type': 'application/json',
            'Content-Disposition': `attachment; filename="${fileName}"`,
            'Content-Length': Buffer.byteLength(json)
          });

          res.end(json);
          console.log(`📦 Giochi notificati esportati: ${games.length} giochi`);
        } catch (error) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Export failed', details: error.message }));
        }
        return;
      }

      // API endpoint per esportare gli utenti in JSON
      if (req.method === 'GET' && req.url === '/api/users/export') {
        try {
          const users = await this.databaseManager.getAllUsers();
          const exportData = {
            timestamp: new Date().toISOString(),
            totalUsers: users.length,
            users: users
          };
          const json = JSON.stringify(exportData, null, 2);
          const fileName = `users-export-${Date.now()}.json`;

          res.writeHead(200, {
            'Content-Type': 'application/json',
            'Content-Disposition': `attachment; filename="${fileName}"`,
            'Content-Length': Buffer.byteLength(json)
          });

          res.end(json);
          console.log(`📦 Utenti esportati: ${users.length} utenti`);
        } catch (error) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Export failed', details: error.message }));
        }
        return;
      }

      // 404 per altre rotte
      res.writeHead(404);
      res.end('Not Found');
    });

    server.listen(PORT, () => {
      console.log(`🌐 Server webhook in ascolto sulla porta ${PORT}`);
      console.log(`🔗 Health check: http://localhost:${PORT}/health`);
      console.log(`📊 Dashboard: http://localhost:${PORT}/dashboard`);
      console.log(`🪝 Webhook URL: ${this.webhookUrl}`);
    });
  }

  setupScheduler() {
    // Configura lo scheduler per controllare i giochi gratuiti
    // Usa il timezone Europe/Rome (CET/CEST) per l'orario italiano
    cron.schedule(this.checkSchedule, () => {
      this.checkAndNotifyFreeGames();
    }, {
      timezone: process.env.TIMEZONE || 'Europe/Rome'
    });

    // Esegui un controllo immediato all'avvio
    setTimeout(() => {
      this.checkAndNotifyFreeGames();
    }, 5000);

    const timezone = process.env.TIMEZONE || 'Europe/Rome';
    console.log(`⏰ Scheduler configurato con orario: ${this.checkSchedule} (timezone: ${timezone})`);
  }

  async checkAndNotifyFreeGames() {
    const now = new Date();
    const timestamp = now.toLocaleString('it-IT', { timeZone: process.env.TIMEZONE || 'Europe/Rome' });
    console.log(`🔍 [${timestamp}] Controllo giornaliero dei giochi gratuiti avviato...`);

    try {
      const freeGames = await this.epicGamesService.getFreeGames();
      console.log(`📊 [${timestamp}] Giochi gratuiti trovati dall'API: ${freeGames.length}`);

      const newFreeGames = [];

      for (const game of freeGames) {
        const wasNotified = await this.databaseManager.wasNotified(game.id);
        console.log(`   - "${game.title}" (ID: ${game.id}) - Già notificato: ${wasNotified ? 'Sì' : 'No'}`);
        if (!wasNotified) {
          newFreeGames.push(game);
          await this.databaseManager.markAsNotified(game);
        }
      }

      if (newFreeGames.length > 0) {
        console.log(`🎉 [${timestamp}] Trovati ${newFreeGames.length} nuovi giochi gratuiti da notificare!`);
        await this.notifyAllUsers(newFreeGames);
      } else {
        console.log(`ℹ️ [${timestamp}] Nessun nuovo gioco gratuito da notificare (tutti già notificati).`);
      }

      console.log(`✅ [${timestamp}] Controllo giochi gratuiti completato.`);
    } catch (error) {
      console.error(`❌ [${timestamp}] Errore durante il controllo dei giochi gratuiti:`, error);
    }
  }

  async notifyAllUsers(freeGames) {
    const users = await this.databaseManager.getSubscribedUsers();

    for (const user of users) {
      try {
        await this.commandHandler.sendFreeGamesMessage(user.chatId, freeGames);
        console.log(`✅ Notifica inviata a ${user.username || user.first_name} (ID: ${user.id})`);

        // Piccolo delay tra le notifiche per evitare rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        // Se l'utente ha bloccato il bot o cancellato la chat, disiscrivilo automaticamente
        if (this.isUserBlockedError(error)) {
          console.log(`🚫 Utente ${user.id} ha bloccato il bot o cancellato la chat. Disiscrizione automatica...`);
          try {
            await this.databaseManager.updateSubscription(user.telegramId, false);
            console.log(`✅ Utente ${user.id} disiscritto automaticamente`);
          } catch (unsubError) {
            console.error(`❌ Errore nella disiscrizione automatica di ${user.id}:`, unsubError);
          }
        } else {
          console.error(`❌ Errore nell'inviare notifica a ${user.id}:`, error);
        }
      }
    }
  }

  /**
   * Verifica se l'errore è dovuto al fatto che l'utente ha bloccato il bot
   */
  isUserBlockedError(error) {
    if (!error) return false;

    const errorMessage = error.message || error.description || String(error);
    const errorCode = error.code || error.statusCode;

    // Codici e messaggi che indicano che l'utente ha bloccato il bot o cancellato la chat
    const blockedCodes = [403, 400];
    const blockedMessages = [
      'bot was blocked by the user',
      'user is deactivated',
      'chat not found',
      'bot was kicked',
      'user not found',
      'have no rights to send a message',
      'not enough rights',
      'chat not found',
      'bot was blocked',
      'blocked',
      'kicked',
      'deactivated'
    ];

    // Verifica il codice errore
    if (blockedCodes.includes(errorCode)) {
      return true;
    }

    // Verifica il messaggio errore (case insensitive)
    const lowerErrorMessage = errorMessage.toLowerCase();
    return blockedMessages.some(msg => lowerErrorMessage.includes(msg));
  }

  start() {
    console.log('🚀 Bot Epic Games avviato e in ascolto...');
    this.setupConsoleCommands();
  }

  setupConsoleCommands() {
    console.log('💻 Console comandi attiva. Digita "help" per la lista dei comandi.');

    process.stdin.setEncoding('utf8');
    process.stdin.on('data', async (data) => {
      const command = data.toString().trim().toLowerCase();

      switch (command) {
        case 'help':
          console.log(`
📋 Comandi disponibili:
  help      - Mostra questa lista
  status    - Stato del bot e statistiche
  users     - Lista degli utenti iscritti
  games     - Lista dei giochi notificati
  check     - Esegui controllo immediato dei giochi
  notify    - Invia notifica di test agli utenti
  diag      - Esegui diagnostica
  stop      - Arresta il bot
          `);
          break;

        case 'status':
          console.log('📊 Stato del bot:');
          console.log(`  - Modalità: ${this.useWebhook ? 'Webhook' : 'Polling'}`);
          console.log(`  - Scheduler: ${this.checkSchedule}`);
          try {
            const users = await this.databaseManager.getAllUsers();
            const subscribed = users.filter(u => u.subscribed).length;
            console.log(`  - Utenti totali: ${users.length}`);
            console.log(`  - Utenti iscritti: ${subscribed}`);
          } catch (e) {
            console.log('  - Errore nel recupero utenti:', e.message);
          }
          break;

        case 'users':
          try {
            const users = await this.databaseManager.getAllUsers();
            console.log(`\n👥 Utenti registrati (${users.length}):`);
            users.forEach(u => {
              console.log(`  - ${u.firstName || u.username || 'Unknown'} (ID: ${u.telegramId}, Iscritto: ${u.subscribed})`);
            });
          } catch (e) {
            console.error('❌ Errore:', e.message);
          }
          break;

        case 'games':
          try {
            const games = await this.databaseManager.getNotifiedGames();
            console.log(`\n🎮 Giochi notificati (${games.length}):`);
            games.forEach(g => {
              console.log(`  - ${g.title} (ID: ${g.id})`);
            });
          } catch (e) {
            console.error('❌ Errore:', e.message);
          }
          break;

        case 'check':
          console.log('🔍 Avvio controllo manuale...');
          await this.checkAndNotifyFreeGames();
          break;

        case 'notify':
          console.log('📧 Invio notifica di test...');
          try {
            const testGames = [{
              id: 'test-game',
              title: '🧪 Gioco di Test',
              description: 'Questa è una notifica di prova',
              url: 'https://store.epicgames.com'
            }];
            await this.notifyAllUsers(testGames);
          } catch (e) {
            console.error('❌ Errore:', e.message);
          }
          break;

        case 'diag':
          console.log('🔧 Esecuzione diagnostica...');
          try {
            const report = await this.diagnosticsService.runDiagnostics();
            console.log('\n📊 Report Diagnostica:');
            console.log(`  Database: ${report.database.status}`);
            console.log(`  Epic Games API: ${report.epicGames.status}`);
            console.log(`  Timestamp: ${report.timestamp}`);
          } catch (e) {
            console.error('❌ Errore:', e.message);
          }
          break;

        case 'stop':
          console.log('🛑 Arresto del bot...');
          await this.stop();
          process.exit(0);
          break;

        case '':
          break;

        default:
          console.log(`❓ Comando sconosciuto: "${command}". Digita "help" per la lista.`);
      }

      process.stdout.write('> ');
    });

    process.stdout.write('> ');
  }

  async stop() {
    console.log('� Arresto del bot...');
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