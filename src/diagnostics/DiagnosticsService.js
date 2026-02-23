/**
 * Servizio di diagnostica per il bot
 * Responsabile della generazione di report e statistiche
 */

const i18n = require('../constants/i18n');

class DiagnosticsService {
  constructor(databaseManager, epicGamesService) {
    this.db = databaseManager;
    this.epicGames = epicGamesService;
  }

  /**
   * Genera un report completo di diagnostica
   */
  async getDiagnostics() {
    try {
      const allUsers = await this.db.getAllUsers();
      const subscribedUsers = await this.db.getSubscribedUsers();
      const notifiedGames = await this.db.getNotifiedGames();
      const currentFreeGames = await this.epicGames.getFreeGames();

      return {
        users: {
          total: allUsers.length,
          subscribed: subscribedUsers.length,
          unsubscribed: allUsers.length - subscribedUsers.length,
          list: allUsers
        },
        games: {
          notified: notifiedGames.length,
          currentlyFree: currentFreeGames.length,
          notifiedList: notifiedGames,
          currentFreeList: currentFreeGames
        },
        database: {
          path: this.db.dbPath,
          tables: ['users', 'notified_games'],
          status: 'ok'
        },
        epicGames: {
          status: 'ok'
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Errore nel ottenere le diagnostiche:', error);
      throw error;
    }
  }

  /**
   * Esegui diagnostica e restituisci risultato con status
   */
  async runDiagnostics() {
    const result = {
      database: { status: 'unknown' },
      epicGames: { status: 'unknown' },
      users: {},
      games: {},
      timestamp: new Date().toISOString()
    };

    // Test database
    try {
      const allUsers = await this.db.getAllUsers();
      const subscribedUsers = await this.db.getSubscribedUsers();
      const notifiedGames = await this.db.getNotifiedGames();

      result.database.status = 'ok';
      result.users.total = allUsers.length;
      result.users.subscribed = subscribedUsers.length;
      result.users.unsubscribed = allUsers.length - subscribedUsers.length;
      result.games.notified = notifiedGames.length;
    } catch (error) {
      result.database.status = 'error';
      result.database.error = error.message;
    }

    // Test Epic Games API
    try {
      const currentFreeGames = await this.epicGames.getFreeGames();
      result.epicGames.status = 'ok';
      result.games.currentlyFree = currentFreeGames.length;
    } catch (error) {
      result.epicGames.status = 'error';
      result.epicGames.error = error.message;
    }

    return result;
  }

  /**
   * Formatta e invia il messaggio di diagnostica su Telegram
   */
  async sendDiagnosticsMessage(bot, chatId, diagnostics) {
    const { users, games, database } = diagnostics;
    const trans = i18n.getTranslations();

    // Funzione per eseguire l'escape dei caratteri speciali Markdown
    const escapeMarkdown = (text) => {
      if (!text) return '';
      return text.replace(/[*_[\]()~`>#+\-=|{}.!]/g, '\\$&');
    };

    // Messaggio introduttivo
    let introMessage = trans.diagnostics.title + '\n\n';
    introMessage += trans.diagnostics.stats + '\n';
    introMessage += '👥 ' + (trans.users?.total || 'Utenti totali') + ': ' + users.total + '\n';
    introMessage += '✅ ' + (trans.users?.subscribed || 'Iscritti') + ': ' + users.subscribed + '\n';
    introMessage += '❌ ' + (trans.users?.unsubscribed || 'Disiscritti') + ': ' + users.unsubscribed + '\n';
    introMessage += '🎮 ' + (trans.games?.notified || 'Notificati') + ': ' + games.notified + '\n';
    introMessage += '🆓 ' + (trans.games?.free || 'Gratuiti') + ': ' + games.currentlyFree + '\n';

    console.log(introMessage);
    await bot.sendMessage(chatId, introMessage, { parse_mode: 'Markdown' });

    // Lista utenti iscritti
    if (users.subscribed > 0) {
      let usersMessage = trans.diagnostics.subscribedUsers.replace('{count}', users.subscribed) + '\n\n';

      users.list
        .filter(user => user.subscribed === 1)
        .slice(0, 10)
        .forEach((user, index) => {
          const displayName = user.username || user.firstName || 'Utente ' + user.id;
          const joinDate = new Date(user.createdAt).toLocaleDateString(trans.locale || 'it-IT');
          usersMessage += (index + 1) + '. ' + escapeMarkdown(displayName) + ' (ID: ' + user.chatId + ')\n';
          usersMessage += '   📅 Iscritto il: ' + joinDate + '\n\n';
        });

      if (users.subscribed > 10) {
        usersMessage += trans.diagnostics.andOthers.replace('{count}', users.subscribed - 10);
      }

      console.log(usersMessage);
      await bot.sendMessage(chatId, usersMessage, { parse_mode: 'Markdown' });
    }

    // Lista giochi notificati
    if (games.notified > 0) {
      let gamesMessage = trans.diagnostics.notifiedGames.replace('{count}', games.notified) + '\n\n';

      games.notifiedList
        .slice(0, 10)
        .forEach((game, index) => {
          const notifiedDate = new Date(game.notifiedAt).toLocaleDateString(trans.locale || 'it-IT');
          gamesMessage += (index + 1) + '. ' + escapeMarkdown(game.title) + '\n';
          gamesMessage += '   📅 Notificato il: ' + notifiedDate + '\n';
          if (game.endDate) {
            gamesMessage += '   ⏰ Scadeva il: ' + new Date(game.endDate).toLocaleDateString(trans.locale || 'it-IT') + '\n';
          }
          gamesMessage += '   🆔 ID: ' + game.id + '\n\n';
        });

      if (games.notified > 10) {
        gamesMessage += trans.diagnostics.andOthers.replace('{count}', games.notified - 10);
      }

      console.log(gamesMessage);
      await bot.sendMessage(chatId, gamesMessage, { parse_mode: 'Markdown' });
    }

    // Informazioni database
    let dbMessage = trans.diagnostics.databaseInfo + '\n\n';
    dbMessage += trans.diagnostics.dbPath.replace('{path}', database.path) + '\n';
    dbMessage += trans.diagnostics.dbTables.replace('{tables}', database.tables.join(', ')) + '\n';
    dbMessage += '📊 Ultimo aggiornamento: ' + new Date().toLocaleString(trans.locale || 'it-IT');

    console.log(dbMessage);

    // Giochi gratuiti attuali
    if (games.currentlyFree > 0) {
      let currentGamesMessage = trans.diagnostics.currentFree.replace('{count}', games.currentlyFree) + '\n\n';

      games.currentFreeList.forEach((game, index) => {
        currentGamesMessage += (index + 1) + '. ' + escapeMarkdown(game.title) + '\n';
        const endDate = this.epicGames.getPromotionEndDate(game);
        if (endDate) {
          currentGamesMessage += '   ⏰ Disponibile fino al: ' + new Date(endDate).toLocaleDateString(trans.locale || 'it-IT') + '\n';
        }
        currentGamesMessage += '   🆔 ID: ' + game.id + '\n\n';
      });

      await bot.sendMessage(chatId, currentGamesMessage, { parse_mode: 'Markdown' });
    }
  }

  /**
   * Stampa le diagnostiche su console (per testing)
   */
  printDiagnostics(diagnostics) {
    const { users, games, database } = diagnostics;

    console.log('🔧 DIAGNOSTICA DATABASE BOT EPIC GAMES');
    console.log('='.repeat(50));

    console.log('\n📊 STATISTICHE GENERALI:');
    console.log('👥 Utenti totali: ' + users.total);
    console.log('✅ Utenti iscritti: ' + users.subscribed);
    console.log('❌ Utenti disiscritti: ' + users.unsubscribed);
    console.log('🎮 Giochi notificati: ' + games.notified);

    console.log('\n💾 INFORMAZIONI DATABASE:');
    console.log('📁 Percorso: ' + database.path);
    console.log('🗃️ Tabelle: ' + database.tables.join(', '));
    console.log('📊 Ultimo aggiornamento: ' + new Date().toLocaleString('it-IT'));

    if (users.list && users.list.length > 0) {
      console.log('\n👥 TUTTI GLI UTENTI:');
      users.list.forEach((user, index) => {
        const displayName = user.username || user.firstName || 'Utente ' + user.id;
        const joinDate = new Date(user.createdAt).toLocaleDateString('it-IT');
        const status = user.subscribed ? '✅' : '❌';
        const type = user.isGroup ? '[GRUPPO]' : '[UTENTE]';
        console.log((index + 1) + '. ' + status + ' ' + type + ' ' + displayName + ' (ID: ' + user.telegramId + ')');
        console.log('   📅 Iscritto il: ' + joinDate);
        console.log('   💬 Chat ID: ' + user.chatId);
      });
    } else {
      console.log('\n👥 Nessun utente registrato');
    }

    if (games.notified > 0) {
      console.log('\n🎮 GIOCHI NOTIFICATI:');
      games.notifiedList.forEach((game, index) => {
        const notifiedDate = new Date(game.notified_at).toLocaleDateString('it-IT');
        console.log((index + 1) + '. ' + game.title);
        console.log('   📅 Notificato il: ' + notifiedDate);
        if (game.end_date) {
          console.log('   ⏰ Scadeva il: ' + new Date(game.end_date).toLocaleDateString('it-IT'));
        }
        console.log('   🆔 ID: ' + game.id);
      });
    }

    console.log('\n' + '='.repeat(50));
  }
}

module.exports = DiagnosticsService;
