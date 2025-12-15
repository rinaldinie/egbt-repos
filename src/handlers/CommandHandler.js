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
        await this.db.saveUser(user);
        await this.db.updateSubscription(user.id, true);
        
        await this.bot.sendMessage(chatId, '✅ Sei ora iscritto alle notifiche dei giochi gratuiti! Riceverai un avviso ogni volta che ci sono nuovi giochi gratuiti sull\'Epic Games Store.');
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
        await this.db.updateSubscription(user.id, false);
        await this.bot.sendMessage(chatId, '❌ Ti sei disiscritto dalle notifiche. Non riceverai più avvisi sui giochi gratuiti. Usa /subscribe per riattivare le notifiche.');
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
      
      await this.bot.sendMessage(chatId, '🔍 Sto controllando i giochi gratuiti attuali...');
      
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
      const promotionEndDate = this.epicGames.getPromotionEndDate(game);
      const endDate = promotionEndDate ? new Date(promotionEndDate).toLocaleDateString('it-IT') : 'Data non disponibile';
      
      // Costruisci il link diretto al gioco
      const gameUrl = this.epicGames.buildGameUrl(game);
      
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
    const finalMessage = `💡 *Consiglio:* Collega il tuo account Epic Games per ricevere questi giochi permanentemente nella tua libreria!`;

    await this.bot.sendMessage(chatId, finalMessage, {
      parse_mode: 'Markdown'
    });
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
}

module.exports = CommandHandler;