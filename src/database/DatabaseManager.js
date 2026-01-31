/**
 * PostgreSQL database management with Prisma
 * Handles all CRUD operations on users and notified games
 */

const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

class DatabaseManager {
  constructor() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const adapter = new PrismaPg(pool);
    this.prisma = new PrismaClient({ adapter });
    this.dbPath = 'PostgreSQL';
  }

  /**
   * Inizializza la connessione al database e crea le tabelle se non esistono
   */
  async init() {
    try {
      await this.prisma.$connect();
      console.log('✅ PostgreSQL connesso');

      // Verifica e crea tabelle se necessario
      await this.createTablesIfNotExist();
    } catch (error) {
      console.error('❌ Errore nella connessione al database:', error);
      throw error;
    }
  }

  /**
   * Crea le tabelle del database se non esistono
   */
  async createTablesIfNotExist() {
    try {
      // Verifica se la tabella users esiste
      await this.prisma.$queryRaw`SELECT 1 FROM users LIMIT 1`;
      console.log('✅ Tabelle database verificate');

      // Verifica e aggiungi colonna url se mancante
      await this.addUrlColumnIfNotExists();
    } catch (error) {
      console.log('🔄 Tabelle non trovate, creazione in corso...');

      try {
        // Crea la tabella users
        await this.prisma.$executeRaw`
          CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            telegramId INTEGER UNIQUE NOT NULL,
            username VARCHAR(255),
            firstName VARCHAR(255),
            chatId INTEGER UNIQUE NOT NULL,
            subscribed BOOLEAN DEFAULT true,
            createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            isGroup BOOLEAN DEFAULT false
          )
        `;

        // Crea la tabella notified_games
        await this.prisma.$executeRaw`
          CREATE TABLE IF NOT EXISTS notified_games (
            id VARCHAR(255) PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            notifiedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            endDate VARCHAR(255),
            url VARCHAR(500)
          )
        `;

        console.log('✅ Tabelle create con successo');
      } catch (createError) {
        console.error('❌ Errore nella creazione delle tabelle:', createError);
        throw createError;
      }
    }
  }

  /**
   * Aggiunge la colonna url alla tabella notified_games se non esiste
   */
  async addUrlColumnIfNotExists() {
    try {
      // Verifica se la colonna url esiste
      await this.prisma.$queryRaw`SELECT url FROM notified_games LIMIT 1`;
    } catch (error) {
      console.log('🔄 Colonna url non trovata, aggiunta in corso...');
      try {
        await this.prisma.$executeRaw`
          ALTER TABLE notified_games ADD COLUMN url VARCHAR(500)
        `;
        console.log('✅ Colonna url aggiunta con successo');
      } catch (alterError) {
        console.error('❌ Errore nell\'aggiungere la colonna url:', alterError);
        throw alterError;
      }
    }
  }

  /**
   * Salva o aggiorna un utente nel database
   */
  async saveUser(user) {
    await this.prisma.user.upsert({
      where: { telegramId: user.id },
      update: {
        username: user.username,
        firstName: user.first_name
      },
      create: {
        telegramId: user.id,
        chatId: user.id,
        username: user.username,
        firstName: user.first_name,
        isGroup: false
      }
    });
  }

  /**
   * Salva o aggiorna una chat di gruppo nel database
   */
  async saveGroup(chat, username = null) {
    await this.prisma.user.upsert({
      where: { telegramId: chat.id },
      update: {
        firstName: chat.title,
        username: username
      },
      create: {
        telegramId: chat.id,
        chatId: chat.id,
        username: username,
        firstName: chat.title,
        isGroup: true
      }
    });
  }

  /**
   * Salva un utente dalla dashboard
   */
  async saveUserFromDashboard(data) {
    await this.prisma.user.upsert({
      where: { telegramId: data.telegramId },
      update: {
        chatId: data.chatId,
        username: data.username,
        firstName: data.firstName,
        isGroup: data.isGroup,
        subscribed: true
      },
      create: {
        telegramId: data.telegramId,
        chatId: data.chatId,
        username: data.username,
        firstName: data.firstName,
        isGroup: data.isGroup,
        subscribed: true
      }
    });
  }

  /**
   * Aggiorna lo stato di sottoscrizione di un utente
   */
  async updateSubscription(userId, subscribed) {
    await this.prisma.user.update({
      where: { telegramId: userId },
      data: { subscribed }
    });
  }

  /**
   * Ottiene tutti gli utenti iscritti alle notifiche
   */
  async getSubscribedUsers() {
    return await this.prisma.user.findMany({
      where: { subscribed: true }
    });
  }

  /**
   * Ottiene tutti gli utenti (per diagnostica)
   */
  async getAllUsers() {
    return await this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Verifica se un gioco è già stato notificato
   */
  async wasNotified(gameId) {
    const game = await this.prisma.notifiedGame.findUnique({
      where: { id: gameId }
    });
    return !!game;
  }

  /**
   * Segna un gioco come notificato
   */
  async markAsNotified(game) {
    const endDate = this.getPromotionEndDate(game);
    const url = this.getGameUrl(game);

    await this.prisma.notifiedGame.upsert({
      where: { id: game.id },
      update: { title: game.title, endDate, url },
      create: { id: game.id, title: game.title, endDate, url }
    });
  }

  /**
   * Ottiene tutti i giochi notificati (per diagnostica)
   */
  async getNotifiedGames() {
    return await this.prisma.notifiedGame.findMany({
      orderBy: { notifiedAt: 'desc' }
    });
  }

  /**
   * Salva un gioco notificato dalla dashboard
   * @param {Object} data - Dati del gioco { id, title, endDate, notifiedAt, url }
   */
  async saveNotifiedGameFromDashboard(data) {
    // Parsing della data di notifica (supporta formato italiano DD/MM/YYYY)
    let notifiedAt;
    if (data.notifiedAt) {
      // Prova a parsare formato italiano DD/MM/YYYY
      const italianDateMatch = data.notifiedAt.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (italianDateMatch) {
        const [, day, month, year] = italianDateMatch;
        notifiedAt = new Date(`${year}-${month}-${day}T00:00:00`);
      } else {
        // Prova come data ISO o altri formati
        notifiedAt = new Date(data.notifiedAt);
      }
    } else {
      notifiedAt = new Date();
    }

    // Parsing della data di fine (supporta formato italiano DD/MM/YYYY)
    let endDate = data.endDate || null;
    if (endDate) {
      const italianDateMatch = endDate.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (italianDateMatch) {
        const [, day, month, year] = italianDateMatch;
        endDate = `${year}-${month}-${day}T00:00:00`;
      }
    }

    await this.prisma.notifiedGame.upsert({
      where: { id: data.id },
      update: {
        title: data.title,
        endDate: endDate,
        notifiedAt: notifiedAt,
        url: data.url || null
      },
      create: {
        id: data.id,
        title: data.title,
        endDate: endDate,
        notifiedAt: notifiedAt,
        url: data.url || null
      }
    });
  }

  /**
   * Estrae la data di fine promozione da un gioco
   */
  getPromotionEndDate(game) {
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

  /**
   * Estrae l'URL del gioco dall'oggetto gioco
   */
  getGameUrl(game) {
    // Se l'URL è già presente nell'oggetto (dal JSON importato)
    if (game.url) {
      return game.url;
    }

    // Costruisci l'URL dal productSlug o catalogNs
    if (game.productSlug) {
      return `https://www.epicgames.com/store/it-IT/p/${game.productSlug}`;
    }

    if (game.catalogNs?.mappings && game.catalogNs.mappings.length > 0) {
      const mapping = game.catalogNs.mappings[0];
      if (mapping.pageSlug) {
        return `https://www.epicgames.com/store/it-IT/p/${mapping.pageSlug}`;
      }
    }

    return null;
  }

  /**
   * Chiude la connessione al database
   */
  async close() {
    await this.prisma.$disconnect();
    console.log('✅ Database disconnesso');
  }
}

module.exports = DatabaseManager;
