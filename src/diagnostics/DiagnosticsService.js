/**
 * Servizio di diagnostica per il bot
 * Responsabile della generazione di report e statistiche
 */

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
          tables: ['users', 'notified_games']
        }
      };
    } catch (error) {
      console.error('Errore nel ottenere le diagnostiche:', error);
      throw error;
    }
  }

  /**
   * Formatta e invia il messaggio di diagnostica su Telegram
   */
  async sendDiagnosticsMessage(bot, chatId, diagnostics) {
    const { users, games, database } = diagnostics;

    // Pulisci e sanitizza il testo per evitare errori di parsing
    const sanitizeText = (text) => {
      return text
        .replace(/[^\x00-\x7F]/g, '') // Rimuovi caratteri non-ASCII
        //.replace(/[\u{1F600}-\u{1F64F}]/g, '') // Rimuovi emoji problematiche
        .replace(/[\u{1F300}-\u{1F5FF}]/gu, '') // Rimuovi simboli problematici
        .replace(/[\u{1F680}-\u{1F6FF}]/gu, '') // Rimuovi simboli tecnici problematici
        .replace(/[\u{2600}-\u{26FF}]/gu, '') // Rimuovi simboli misc problematici
        .replace(/[\u{2700}-\u{27BF}]/gu, '') // Rimuovi simboli dingbats problematici
        .trim();
    };

    // Messaggio introduttivo
    let introMessage = `🔧 *Report Diagnostica Bot Epic Games*\n\n`;
    introMessage += `📊 *Statistiche Generali:*\n`;
    introMessage += `👥 Utenti totali: ${users.total}\n`;
    introMessage += `✅ Utenti iscritti: ${users.subscribed}\n`;
    introMessage += `❌ Utenti disiscritti: ${users.unsubscribed}\n`;
    introMessage += `🎮 Giochi notificati: ${games.notified}\n`;
    introMessage += `🆓 Giochi gratuiti attuali: ${games.currentlyFree}\n`;

    console.log(introMessage);
    await bot.sendMessage(chatId, sanitizeText(introMessage), {
      parse_mode: 'markdown'
    });

    // Lista utenti iscritti
    if (users.subscribed > 0) {
      let usersMessage = `👥 *Utenti Iscritti (${users.subscribed}):*\n\n`;

      users.list
        .filter(user => user.subscribed === 1)
        .slice(0, 10) // Limita a 10 per evitare messaggi troppo lunghi
        .forEach((user, index) => {
          const displayName = user.username || user.first_name || `Utente ${user.id}`;
          const joinDate = new Date(user.created_at).toLocaleDateString('it-IT');
          usersMessage += `${index + 1}. ${displayName} (ID: ${user.chat_id})\n`;
          usersMessage += `   📅 Iscritto il: ${joinDate}\n\n`;
        });

      if (users.subscribed > 10) {
        usersMessage += `... e altri ${users.subscribed - 10} utenti`;
      }

      console.log(usersMessage);
      await bot.sendMessage(chatId, sanitizeText(usersMessage), {
        parse_mode: 'markdown'
      });
    }

    // Lista giochi notificati
    if (games.notified > 0) {
      let gamesMessage = `🎮 *Giochi Notificati (${games.notified}):*\n\n`;

      games.notifiedList
        .slice(0, 10) // Limita a 10 per evitare messaggi troppo lunghi
        .forEach((game, index) => {
          const notifiedDate = new Date(game.notified_at).toLocaleDateString('it-IT');
          gamesMessage += `${index + 1}. *${game.title}*\n`;
          gamesMessage += `   📅 Notificato il: ${notifiedDate}\n`;
          if (game.end_date) {
            gamesMessage += `   ⏰ Scadeva il: ${new Date(game.end_date).toLocaleDateString('it-IT')}\n`;
          }
          gamesMessage += `   🆔 ID: ${game.id}\n\n`;
        });

      if (games.notified > 10) {
        gamesMessage += `... e altri ${games.notified - 10} giochi`;
      }

      console.log(gamesMessage);
      await bot.sendMessage(chatId, sanitizeText(gamesMessage), {
        parse_mode: 'markdown'
      });
    }

    // Informazioni database
    let dbMessage = `💾 *Informazioni Database:*\n\n`;
    dbMessage += `📁 Percorso: ${database.path}\n`;
    dbMessage += `🗃️ Tabelle: ${database.tables.join(', ')}\n`;
    dbMessage += `📊 Ultimo aggiornamento: ${new Date().toLocaleString('it-IT')}`;

    console.log(dbMessage);
    await bot.sendMessage(chatId, sanitizeText(dbMessage), {
      parse_mode: 'markdown'
    });

    // Giochi gratuiti attuali
    if (games.currentlyFree > 0) {
      let currentGamesMessage = `🆓 *Giochi Gratuiti Attuali (${games.currentlyFree}):*\n\n`;

      games.currentFreeList.forEach((game, index) => {
        currentGamesMessage += `${index + 1}. *${game.title}*\n`;
        const endDate = this.epicGames.getPromotionEndDate(game);
        if (endDate) {
          currentGamesMessage += `   ⏰ Disponibile fino al: ${new Date(endDate).toLocaleDateString('it-IT')}\n`;
        }
        currentGamesMessage += `   🆔 ID: ${game.id}\n\n`;
      });

      await bot.sendMessage(chatId, sanitizeText(currentGamesMessage), {
        parse_mode: 'HTML'
      });
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
    console.log(`👥 Utenti totali: ${users.total}`);
    console.log(`✅ Utenti iscritti: ${users.subscribed}`);
    console.log(`❌ Utenti disiscritti: ${users.unsubscribed}`);
    console.log(`🎮 Giochi notificati: ${games.notified}`);

    console.log('\n💾 INFORMAZIONI DATABASE:');
    console.log(`📁 Percorso: ${database.path}`);
    console.log(`🗃️ Tabelle: ${database.tables.join(', ')}`);
    console.log(`📊 Ultimo aggiornamento: ${new Date().toLocaleString('it-IT')}`);

    if (users.subscribed > 0) {
      console.log('\n👥 UTENTI ISCRITTI:');
      users.list
        .filter(user => user.subscribed === 1)
        .forEach((user, index) => {
          const displayName = user.username || user.first_name || `Utente ${user.id}`;
          const joinDate = new Date(user.created_at).toLocaleDateString('it-IT');
          console.log(`${index + 1}. ${displayName} (ID: ${user.chat_id})`);
          console.log(`   📅 Iscritto il: ${joinDate}`);
        });
    }

    if (games.notified > 0) {
      console.log('\n🎮 GIOCHI NOTIFICATI:');
      games.notifiedList.forEach((game, index) => {
        const notifiedDate = new Date(game.notified_at).toLocaleDateString('it-IT');
        console.log(`${index + 1}. ${game.title}`);
        console.log(`   📅 Notificato il: ${notifiedDate}`);
        if (game.end_date) {
          console.log(`   ⏰ Scadeva il: ${new Date(game.end_date).toLocaleDateString('it-IT')}`);
        }
        console.log(`   🆔 ID: ${game.id}`);
      });
    }

    console.log('\n' + '='.repeat(50));
  }
}

module.exports = DiagnosticsService;