const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const cron = require('node-cron');
const DatabaseManager = require('./src/database/DatabaseManager');
const dotenv = require('dotenv');
const http = require('http');

// Carica le variabili d'ambiente
dotenv.config();

class EpicGamesBot {
  constructor() {
    this.botToken = process.env.TELEGRAM_BOT_TOKEN || '';
    this.checkSchedule = process.env.CHECK_SCHEDULE || '0 9 * * *';
    this.webhookUrl = process.env.WEBHOOK_URL || '';
    this.useWebhook = process.env.USE_WEBHOOK === 'true';
    this.databaseManager = new DatabaseManager();

    if (!this.botToken) {
      throw new Error('TELEGRAM_BOT_TOKEN is required');
    }

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
      this.setupBotHandlers();
      this.setupScheduler();

      if (this.useWebhook) {
        this.setupWebhookServer();
      }

      console.log('✅ Bot Epic Games inizializzato con successo!');
      console.log(`🔧 Modalità: ${this.useWebhook ? 'Webhook' : 'Polling'}`);
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

  setupBotHandlers() {
    // Comando /start
    this.bot.onText(/\/start/, async (msg) => {
      const chatId = msg.chat.id;
      const user = msg.from;

      if (!user) return;

      try {
        await this.saveUser(user);

        const welcomeMessage = `🎮 *Benvenuto nel Bot Epic Games Free!*

Ti notificherò quando ci sono nuovi giochi gratuiti sull'Epic Games Store.

📋 *Comandi disponibili:*
/start - Mostra questo messaggio
/subscribe - Iscriviti alle notifiche
/unsubscribe - Disiscriviti dalle notifiche
/check - Controlla subito i giochi gratuiti
/help - Mostra l'aiuto

Sei già iscritto alle notifiche! 🎉`;

        await this.bot.sendMessage(chatId, welcomeMessage, {
          parse_mode: 'Markdown'
        });
      } catch (error) {
        console.error('Errore nel comando /start:', error);
        await this.bot.sendMessage(chatId, '❌ Si è verificato un errore. Riprova più tardi.');
      }
    });

    // Comando /help
    this.bot.onText(/\/help/, async (msg) => {
      const chatId = msg.chat.id;

      const helpMessage = `🤖 *Aiuto - Bot Epic Games Free*

📋 *Comandi disponibili:*
• /start - Avvia il bot e mostra il benvenuto
• /subscribe - Iscriviti alle notifiche dei giochi gratuiti
• /unsubscribe - Disiscriviti dalle notifiche
• /check - Controlla immediatamente i giochi gratuiti
• /help - Mostra questo messaggio di aiuto

⏰ *Quando riceverai le notifiche:*
Il bot controlla automaticamente i nuovi giochi gratuiti ogni giorno alle 9:00.

ℹ️ *Informazioni:*
- Il bot monitora l'Epic Games Store
- Riceverai notifiche solo per nuovi giochi gratuiti
- Puoi disiscriverti in qualsiasi momento con /unsubscribe

Per domande o problemi, contatta l'amministratore del bot.`;

      await this.bot.sendMessage(chatId, helpMessage, {
        parse_mode: 'Markdown'
      });
    });

    // Comando /subscribe
    this.bot.onText(/\/subscribe/, async (msg) => {
      const chatId = msg.chat.id;
      const user = msg.from;

      if (!user) return;

      try {
        await this.saveUser(user);
        await this.updateSubscription(user.id, true);

        await this.bot.sendMessage(chatId, '✅ Sei ora iscritto alle notifiche dei giochi gratuiti! Riceverai un avviso ogni volta che ci sono nuovi giochi gratuiti sull\'Epic Games Store.');
      } catch (error) {
        console.error('Errore nel comando /subscribe:', error);
        await this.bot.sendMessage(chatId, '❌ Si è verificato un errore. Riprova più tardi.');
      }
    });

    // Comando /unsubscribe
    this.bot.onText(/\/unsubscribe/, async (msg) => {
      const chatId = msg.chat.id;
      const user = msg.from;

      if (!user) return;

      try {
        await this.updateSubscription(user.id, false);
        await this.bot.sendMessage(chatId, '❌ Ti sei disiscritto dalle notifiche. Non riceverai più avvisi sui giochi gratuiti. Usa /subscribe per riattivare le notifiche.');
      } catch (error) {
        console.error('Errore nel comando /unsubscribe:', error);
        await this.bot.sendMessage(chatId, '❌ Si è verificato un errore. Riprova più tardi.');
      }
    });

    // Comando /check
    this.bot.onText(/\/check/, async (msg) => {
      const chatId = msg.chat.id;

      await this.bot.sendMessage(chatId, '🔍 Sto controllando i giochi gratuiti attuali...');

      try {
        const freeGames = await this.getFreeGames();
        if (freeGames.length > 0) {
          await this.sendFreeGamesMessage(chatId, freeGames);
        } else {
          await this.bot.sendMessage(chatId, '😔 Non ci sono giochi gratuiti disponibili in questo momento sull\'Epic Games Store.');
        }
      } catch (error) {
        console.error('Errore nel comando /check:', error);
        await this.bot.sendMessage(chatId, '❌ Non sono riuscito a controllare i giochi gratuiti. Riprova più tardi.');
      }
    });

    console.log('✅ Handler dei comandi configurati');
  }

  saveUser(user) {
    return this.databaseManager.saveUser(user);
  }

  updateSubscription(userId, subscribed) {
    return this.databaseManager.updateSubscription(userId, subscribed);
  }

  getSubscribedUsers() {
    return this.databaseManager.getSubscribedUsers();
  }

  wasNotified(gameId) {
    return this.databaseManager.wasNotified(gameId);
  }

  markAsNotified(game) {
    return this.databaseManager.markAsNotified(game);
  }

  async getFreeGames() {
    try {
      // Endpoint parametrizzato per l'Italia
      const apiUrl = 'https://store-site-backend-static.ak.epicgames.com/freeGamesPromotions?locale=it-IT&country=IT&allowCountries=IT';

      const response = await axios.get(apiUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept-Language': 'it-IT,it;q=0.9,en;q=0.8'
        }
      });

      const games = [];
      const data = response.data.data.Catalog.searchStore.elements;

      for (const game of data) {
        // Logica aggiornata per identificare i giochi gratuiti
        if (this.isGameFree(game)) {
          games.push(game);
        }
      }

      console.log(`🎮 Trovati ${games.length} giochi gratuiti per l'Italia:`, games.map(g => g.title));
      return games;
    } catch (error) {
      console.error('Errore nel recupero dei giochi gratuiti:', error);
      return [];
    }
  }

  isGameFree(game) {
    // Se non ci sono promozioni, il gioco non è gratuito
    if (!game.promotions) {
      return false;
    }

    // Controlla le offerte promozionali
    const promotionalOffers = game.promotions.promotionalOffers;
    if (!promotionalOffers || promotionalOffers.length === 0) {
      return false;
    }

    // Cerca offerte con sconto al 100% (gratuito)
    for (const promotion of promotionalOffers) {
      if (!promotion.promotionalOffers || promotion.promotionalOffers.length === 0) {
        continue;
      }

      for (const offer of promotion.promotionalOffers) {
        // Controlla se lo sconto è 100% (gratuito)
        if (offer.discountSetting?.discountPercentage === 0) {
          return true;
        }

        // Controlla anche il prezzo finale come fallback
        if (game.price?.totalPrice?.discountPrice === 0) {
          return true;
        }
      }
    }

    return false;
  }

  async sendFreeGamesMessage(chatId, games) {
    // Invia un messaggio introduttivo
    let introMessage = `🎮 *Ci sono ${games.length} giochi gratuiti sull'Epic Games Store!*\n\n`;

    if (games.length === 1) {
      introMessage += `Ecco il gioco gratuito disponibile:`;
    } else {
      introMessage += `Ecco i giochi gratuiti disponibili:`;
    }

    await this.bot.sendMessage(chatId, introMessage, {
      parse_mode: 'Markdown'
    });

    // Invia ogni gioco come un messaggio separato per l'anteprima
    for (let i = 0; i < games.length; i++) {
      const game = games[i];
      const promotionEndDate = this.getPromotionEndDate(game);
      const endDate = promotionEndDate ? new Date(promotionEndDate).toLocaleDateString('it-IT') : 'Data non disponibile';

      // Costruisci il link diretto al gioco
      const gameUrl = this.buildGameUrl(game);

      // Crea un messaggio con il link diretto per l'anteprima
      let gameMessage = `🎯 *${game.title}*\n\n`;
      gameMessage += `⏰ *Disponibile fino al:* ${endDate}\n\n`;
      gameMessage += `${gameUrl}`;

      await this.bot.sendMessage(chatId, gameMessage, {
        parse_mode: 'Markdown',
        disable_web_page_preview: false
      });

      // Piccolo delay tra i messaggi per evitare rate limiting
      if (i < games.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // Invia un messaggio finale con il consiglio
    // const finalMessage = `💡 *Consiglio:* Collega il tuo account Epic Games per ricevere questi giochi permanentemente nella tua libreria!`;

    // await this.bot.sendMessage(chatId, finalMessage, {
    //   parse_mode: 'Markdown'
    // });
  }

  buildGameUrl(game) {
    // Metodi per costruire il link del gioco in ordine di priorità
    if (game.url) {
      return game.url;
    }

    if (game.productSlug) {
      return `https://store.epicgames.com/it/p/${game.productSlug}`;
    }

    if (game.offerMappings && game.offerMappings.length > 0) {
      const mapping = game.offerMappings[0];
      if (mapping.pageSlug) {
        return `https://store.epicgames.com/it/p/${mapping.pageSlug}`;
      }
    }

    // Fallback: usa l'ID del gioco
    if (game.id) {
      return `https://store.epicgames.com/it/p/${game.id}`;
    }

    // Fallback finale: link alla ricerca
    return `https://store.epicgames.com/it/browse?q=${encodeURIComponent(game.title)}`;
  }

  getPromotionEndDate(game) {
    // Estrae la data di fine promozione dalla struttura corretta
    if (!game.promotions?.promotionalOffers) {
      return null;
    }

    for (const promotion of game.promotions.promotionalOffers) {
      if (!promotion.promotionalOffers || promotion.promotionalOffers.length === 0) {
        continue;
      }

      for (const offer of promotion.promotionalOffers) {
        if (offer.endDate) {
          return offer.endDate;
        }
      }
    }

    return null;
  }

  async notifyAllUsers(freeGames) {
    const users = await this.getSubscribedUsers();

    for (const user of users) {
      try {
        await this.sendFreeGamesMessage(user.chat_id, freeGames);
        console.log(`✅ Notifica inviata a ${user.username || user.first_name} (ID: ${user.id})`);

        // Piccolo delay tra le notifiche per evitare rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`❌ Errore nell'inviare notifica a ${user.id}:`, error);
      }
    }
  }

  async checkAndNotifyFreeGames() {
    console.log('🔍 Controllo giornaliero dei giochi gratuiti...');

    try {
      const freeGames = await this.getFreeGames();
      const newFreeGames = [];

      for (const game of freeGames) {
        const wasNotified = await this.wasNotified(game.id);
        if (!wasNotified) {
          newFreeGames.push(game);
          await this.markAsNotified(game);
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

  start() {
    console.log('🚀 Bot Epic Games avviato e in ascolto...');
  }
}

// Avvia il bot
try {
  const bot = new EpicGamesBot();
  bot.start();
} catch (error) {
  console.error('❌ Errore fatale nell\'avvio del bot:', error);
  process.exit(1);
}