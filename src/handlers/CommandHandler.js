/**
 * Handler per i comandi del bot
 * Gestisce tutti i comandi Telegram e le relative risposte
 */

class CommandHandler {
  constructor(bot, databaseManager, epicGamesService, diagnosticsService, adminId) {
    this.bot = bot;
    this.db = databaseManager;
    this.epicGames = epicGamesService;
    this.diagnostics = diagnosticsService;
    this.adminId = adminId;
    this.setupHandlers();
  }

  /**
   * Configura tutti gli handler dei comandi
   */
  setupHandlers() {
    this.setupStartHandler();
    this.setupHelpHandler();
    this.setupSubscribeHandler();
    this.setupUnsubscribeHandler();
    this.setupCheckHandler();
    this.setupAdminHandler();
    this.setupAnnounceHandler();

    console.log('✅ Handler dei comandi configurati');
  }

  /**
   * Handler per il comando /start
   */
  setupStartHandler() {
    this.bot.onText(/\/start/, async (msg) => {
      const chatId = msg.chat.id;
      const user = msg.from;

      if (!user) return;

      try {
        await this.db.saveUser(user);

        const welcomeMessage = `🎮 *Benvenuto nel Bot Epic Games Free!*

Ti notificherò quando ci sono nuovi giochi gratuiti sull'Epic Games Store.

📋 *Comandi disponibili:*
/start - Mostra questo messaggio
/subscribe - Iscriviti alle notifiche
/unsubscribe - Disiscriviti dalle notifiche
/check - Controlla subito i giochi gratuiti
/help - Mostra l'aiuto`;

        await this.bot.sendMessage(chatId, welcomeMessage, {
          parse_mode: 'Markdown'
        });
      } catch (error) {
        console.error('Errore nel comando /start:', error);
        await this.bot.sendMessage(chatId, '❌ Si è verificato un errore. Riprova più tardi.');
      }
    });
  }

  /**
   * Handler per il comando /help
   */
  setupHelpHandler() {
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
Il bot controlla automaticamente i nuovi giochi gratuiti ogni giorno alle 18:00.

ℹ️ *Informazioni:*
- Il bot monitora l'Epic Games Store
- Riceverai notifiche solo per nuovi giochi gratuiti
- Puoi disiscriverti in qualsiasi momento con /unsubscribe

Per domande o problemi, contatta l'amministratore del bot.`;

      await this.bot.sendMessage(chatId, helpMessage, {
        parse_mode: 'Markdown'
      });
    });
  }

  /**
   * Handler per il comando /subscribe
   */
  setupSubscribeHandler() {
    this.bot.onText(/\/subscribe/, async (msg) => {
      const chatId = msg.chat.id;
      const user = msg.from;

      if (!user) return;

      try {
        // Verifica se è una chat di gruppo
        const isGroup = msg.chat.type === 'group' || msg.chat.type === 'supergroup';

        if (isGroup) {
          // Salva il gruppo
          await this.db.saveGroup(msg.chat, user.username);
          await this.db.updateSubscription(chatId, true);
          await this.bot.sendMessage(chatId, `✅ Il gruppo "${msg.chat.title}" è ora iscritto alle notifiche!`);

          // Notifica admin
          await this.notifyAdminSubscription(msg.chat.title || 'Gruppo sconosciuto', chatId, true, true);
        } else {
          // Salva l'utente privato
          await this.db.saveUser(user);
          await this.db.updateSubscription(user.id, true);
          await this.bot.sendMessage(chatId, '✅ Sei ora iscritto alle notifiche dei giochi gratuiti!');

          // Notifica admin
          const displayName = user.username ? `@${user.username}` : `${user.first_name} ${user.last_name || ''}`.trim();
          await this.notifyAdminSubscription(displayName, user.id, true, false);
        }
      } catch (error) {
        console.error('Errore nel comando /subscribe:', error);
        await this.bot.sendMessage(chatId, '❌ Si è verificato un errore. Riprova più tardi.');
      }
    });
  }

  /**
   * Handler per il comando /unsubscribe
   */
  setupUnsubscribeHandler() {
    this.bot.onText(/\/unsubscribe/, async (msg) => {
      const chatId = msg.chat.id;
      const user = msg.from;

      if (!user) return;

      try {
        // Verifica se è una chat di gruppo
        const isGroup = msg.chat.type === 'group' || msg.chat.type === 'supergroup';

        if (isGroup) {
          await this.db.updateSubscription(chatId, false);
          await this.bot.sendMessage(chatId, `❌ Il gruppo "${msg.chat.title}" è stato disiscritto dalle notifiche.`);

          // Notifica admin
          await this.notifyAdminSubscription(msg.chat.title || 'Gruppo sconosciuto', chatId, false, true);
        } else {
          await this.db.updateSubscription(user.id, false);
          await this.bot.sendMessage(chatId, '❌ Ti sei disiscritto dalle notifiche. Non riceverai più avvisi sui giochi gratuiti. Usa /subscribe per riattivare le notifiche.');

          // Notifica admin
          const displayName = user.username ? `@${user.username}` : `${user.first_name} ${user.last_name || ''}`.trim();
          await this.notifyAdminSubscription(displayName, user.id, false, false);
        }
      } catch (error) {
        console.error('Errore nel comando /unsubscribe:', error);
        await this.bot.sendMessage(chatId, '❌ Si è verificato un errore. Riprova più tardi.');
      }
    });
  }

  /**
   * Handler per il comando /check
   */
  setupCheckHandler() {
    this.bot.onText(/\/check/, async (msg) => {

      const chatId = msg.chat.id;

      try {
        const freeGames = await this.epicGames.getFreeGames();
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
  }

  /**
   * Handler per il comando /admin (solo admin)
   */
  setupAdminHandler() {
    this.bot.onText(/\/admin/, async (msg) => {
      const chatId = msg.chat.id;
      const user = msg.from;

      if (!user) return;

      // Verifica se l'utente è l'amministratore
      if (!this.isAdmin(user.id)) {
        console.log(`🚫 Tentativo accesso admin non autorizzato da utente ${user.id} (${user.username || user.first_name})`);

        // Non rispondere per non rivelare l'esistenza del comando
        return;
      }

      console.log(`🔑 Accesso admin autorizzato per utente ${user.id} (${user.username || user.first_name})`);
      await this.bot.sendMessage(chatId, '🔧 Sto generando il report di diagnostica...');

      try {
        const diagnostics = await this.diagnostics.getDiagnostics();
        await this.diagnostics.sendDiagnosticsMessage(this.bot, chatId, diagnostics);
      } catch (error) {
        console.error('Errore nel comando /admin:', error);
        await this.bot.sendMessage(chatId, '❌ Non sono riuscito a generare la diagnostica. Riprova più tardi.');
      }
    });
  }

  /**
   * Invia il messaggio con i giochi gratuiti
   */
  async sendFreeGamesMessage(chatId, games) {
    // Invia un messaggio introduttivo
    let introMessage = '';

    if (games.length === 1) {
      introMessage += `*🎮C'è un gioco gratuito disponibile:*`;
    } else {
      introMessage += `*🎮Ecco i giochi gratuiti disponibili:*`;
    }

    await this.bot.sendMessage(chatId, introMessage, {
      parse_mode: 'Markdown'
    });

    // Invia ogni gioco come un messaggio separato per l'anteprima
    for (let i = 0; i < games.length; i++) {
      const game = games[i];
      const promotionEndDate = this.epicGames.getPromotionEndDate(game);
      const endDate = promotionEndDate ? new Date(promotionEndDate).toLocaleDateString('it-IT') : 'Data non disponibile';

      // Costruisci il link diretto al gioco
      const gameUrl = this.epicGames.buildGameUrl(game);

      // Crea un messaggio con il link diretto per l'anteprima
      let message = `🎯 *${game.title}*\n\n`;
      message += `⏰ *Disponibile fino al:* ${endDate}\n\n`;
      message += `${gameUrl}`;

      await this.bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        disable_web_page_preview: false
      });

      // Piccolo delay tra i messaggi per evitare rate limiting
      if (i < games.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  }

  /**
   * Verifica se l'utente è l'amministratore
   */
  isAdmin(userId) {
    if (!this.adminId) {
      console.warn('⚠️ ADMIN_ID non configurato. Il comando /admin sarà disabilitato.');
      return false;
    }
    return userId === this.adminId;
  }

  /**
   * Handler per il comando /announce (solo admin)
   * Legge il file announcements.md e invia il contenuto a tutti gli utenti iscritti
   */
  setupAnnounceHandler() {
    this.bot.onText(/\/announce/, async (msg) => {
      const chatId = msg.chat.id;
      const user = msg.from;

      if (!user) return;

      // Verifica se l'utente è l'amministratore
      if (!this.isAdmin(user.id)) {
        console.log(`🚫 Tentativo announce non autorizzato da utente ${user.id}`);
        return;
      }

      console.log(`📢 Richiesta announce da utente ${user.id}`);

      try {
        const fs = require('fs');
        const path = require('path');

        // Leggi il file announcements.md
        const announcementsPath = path.join(process.cwd(), 'announcements.md');

        if (!fs.existsSync(announcementsPath)) {
          await this.bot.sendMessage(chatId, '❌ File announcements.md non trovato.');
          return;
        }

        const content = fs.readFileSync(announcementsPath, 'utf8');

        if (!content.trim()) {
          await this.bot.sendMessage(chatId, '❌ Il file announcements.md è vuoto.');
          return;
        }

        // Ottieni tutti gli utenti iscritti
        const users = await this.db.getSubscribedUsers();

        if (users.length === 0) {
          await this.bot.sendMessage(chatId, '⚠️ Nessun utente iscritto da notificare.');
          return;
        }

        await this.bot.sendMessage(chatId, `📢 Invio annuncio a ${users.length} utenti/gruppi...`);

        let sent = 0;
        let failed = 0;

        // Invia a tutti gli utenti iscritti
        for (const user of users) {
          try {
            await this.bot.sendMessage(user.chatId, content, { parse_mode: 'Markdown' });
            sent++;
            // Piccolo delay per evitare rate limiting
            await new Promise(resolve => setTimeout(resolve, 100));
          } catch (error) {
            console.error(`❌ Errore invio a ${user.chatId}:`, error.message);
            failed++;
          }
        }

        await this.bot.sendMessage(chatId,
          `✅ Annuncio inviato!\n\n📤 Inviati: ${sent}\n❌ Falliti: ${failed}`);
        console.log(`✅ Announce completato: ${sent} inviati, ${failed} falliti`);

      } catch (error) {
        console.error('Errore nel comando /announce:', error);
        await this.bot.sendMessage(chatId, '❌ Errore nell\'invio dell\'annuncio: ' + error.message);
      }
    });
  }

  /**
   * Invia una notifica all'admin quando un utente si iscrive o disiscrive
   * @param {string} name - Nome/username dell'utente o gruppo
   * @param {number} id - ID Telegram dell'utente o gruppo
   * @param {boolean} isSubscribing - true se si sta iscrivendo, false se disiscrive
   * @param {boolean} isGroup - true se è un gruppo, false se è un utente privato
   */
  async notifyAdminSubscription(name, id, isSubscribing, isGroup) {
    if (!this.adminId) return;

    try {
      const action = isSubscribing ? 'iscritto' : 'disiscritto';
      const emoji = isSubscribing ? '✅' : '❌';
      const type = isGroup ? 'Gruppo' : 'Utente';

      const message = `${emoji} *${type} ${action}*

👤 *Nome:* ${name}
🆔 *ID:* ${id}
📅 *Data:* ${new Date().toLocaleString('it-IT')}`;

      await this.bot.sendMessage(this.adminId, message, {
        parse_mode: 'Markdown'
      });

      console.log(`📢 Notifica admin inviata: ${type} ${name} ${action}`);
    } catch (error) {
      console.error('❌ Errore nell\'inviare notifica all\'admin:', error);
    }
  }

  /**
   * Verifica se un utente è l'amministratore
   */
  isAdmin(userId) {
    return this.adminId && userId === this.adminId;
  }
}

module.exports = CommandHandler;