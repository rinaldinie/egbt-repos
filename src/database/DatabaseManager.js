/**
 * Gestione del database SQLite
 * Responsabile di tutte le operazioni CRUD su utenti e giochi notificati
 */

const sqlite3 = require('sqlite3');
const path = require('path');

class DatabaseManager {
  constructor(dbPath = './bot.db') {
    this.dbPath = dbPath;
    this.db = null;
  }

  /**
   * Inizializza il database e crea le tabelle se non esistono
   */
  async init() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          console.error('Errore nell\'apertura del database:', err);
          reject(err);
          return;
        }

        const createTables = `
          CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY,
            username TEXT,
            first_name TEXT,
            chat_id INTEGER UNIQUE,
            subscribed BOOLEAN DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          );

          CREATE TABLE IF NOT EXISTS notified_games (
            id TEXT PRIMARY KEY,
            title TEXT,
            notified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            end_date TEXT
          );
        `;

        this.db.exec(createTables, (err) => {
          if (err) {
            console.error('Errore nella creazione delle tabelle:', err);
            reject(err);
          } else {
            console.log('✅ Database inizializzato');
            resolve();
          }
        });
      });
    });
  }

  /**
   * Salva o aggiorna un utente nel database
   */
  async saveUser(user) {
    if (!this.db) return Promise.resolve();

    return new Promise((resolve, reject) => {
      this.db.run(`
        INSERT OR REPLACE INTO users (id, username, first_name, chat_id)
        VALUES (?, ?, ?, ?)
      `, [user.id, user.username, user.first_name, user.id], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * Aggiorna lo stato di sottoscrizione di un utente
   */
  async updateSubscription(userId, subscribed) {
    if (!this.db) return Promise.resolve();

    return new Promise((resolve, reject) => {
      this.db.run(`
        UPDATE users SET subscribed = ? WHERE id = ?
      `, [subscribed ? 1 : 0, userId], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * Ottiene tutti gli utenti iscritti alle notifiche
   */
  async getSubscribedUsers() {
    if (!this.db) return Promise.resolve([]);

    return new Promise((resolve, reject) => {
      this.db.all(`
        SELECT * FROM users WHERE subscribed = 1
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  /**
   * Ottiene tutti gli utenti (per diagnostica)
   */
  async getAllUsers() {
    if (!this.db) return Promise.resolve([]);

    return new Promise((resolve, reject) => {
      this.db.all(`
        SELECT * FROM users ORDER BY created_at DESC
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  /**
   * Verifica se un gioco è già stato notificato
   */
  async wasNotified(gameId) {
    if (!this.db) return Promise.resolve(false);

    return new Promise((resolve, reject) => {
      this.db.get(`
        SELECT id FROM notified_games WHERE id = ?
      `, [gameId], (err, row) => {
        if (err) reject(err);
        else resolve(!!row);
      });
    });
  }

  /**
   * Segna un gioco come notificato
   */
  async markAsNotified(game) {
    if (!this.db) return Promise.resolve();

    return new Promise((resolve, reject) => {
      const endDate = this.getPromotionEndDate(game);
      
      this.db.run(`
        INSERT OR REPLACE INTO notified_games (id, title, end_date)
        VALUES (?, ?, ?)
      `, [game.id, game.title, endDate], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * Ottiene tutti i giochi notificati (per diagnostica)
   */
  async getNotifiedGames() {
    if (!this.db) return Promise.resolve([]);

    return new Promise((resolve, reject) => {
      this.db.all(`
        SELECT * FROM notified_games ORDER BY notified_at DESC
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
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
   * Chiude la connessione al database
   */
  async close() {
    if (this.db) {
      return new Promise((resolve) => {
        this.db.close((err) => {
          if (err) {
            console.error('Errore nel chiudere il database:', err);
          } else {
            console.log('✅ Database chiuso');
          }
          resolve();
        });
      });
    }
  }
}

module.exports = DatabaseManager;