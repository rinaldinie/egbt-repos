/**
 * Servizio per la generazione della dashboard web
 */

const fs = require('fs');
const path = require('path');

class DashboardService {
  constructor(databaseManager, epicGamesService, diagnosticsService) {
    this.db = databaseManager;
    this.epicGames = epicGamesService;
    this.diagnostics = diagnosticsService;
    this.templatePath = path.join(__dirname, 'dashboard.template.html');
  }

  /**
   * Genera la dashboard HTML completa
   */
  async generateDashboard() {
    try {
      const diagnostics = await this.diagnostics.getDiagnostics();
      return this.generateDashboardHtml(diagnostics);
    } catch (error) {
      console.error('Errore nella generazione della dashboard:', error);
      return this.generateErrorHtml(error.message);
    }
  }

  /**
   * Genera l'HTML della dashboard leggendo il template da file
   */
  generateDashboardHtml(diagnostics) {
    const { users, games, database } = diagnostics;
    const now = new Date().toLocaleString('it-IT');

    // Leggi il template
    let template = fs.readFileSync(this.templatePath, 'utf8');

    // Genera la lista utenti HTML
    const usersListHtml = users.list.slice(0, 10).map(u => {
      const badgeClass = u.subscribed ? 'badge-subscribed' : 'badge-unsubscribed';
      const badgeText = u.subscribed ? '✓' : '✗';
      const groupBadge = u.isGroup ? '<span class="badge badge-group">GRUPPO</span>' : '';
      const name = u.firstName || u.username || `Utente ${u.id}`;
      return `<div class="user-item">${name} ${groupBadge}<span class="badge ${badgeClass}">${badgeText}</span><br><span>ID: ${u.telegramId}</span></div>`;
    }).join('');

    // Genera la lista giochi HTML
    const gamesListHtml = games.notifiedList.slice(0, 10).map(g => {
      const date = new Date(g.notifiedAt).toLocaleDateString('it-IT');
      const urlLink = g.url ? `<br><a href="${g.url}" target="_blank" style="color: #4299e1; font-size: 0.8em; text-decoration: none;">🔗 Vedi su Epic</a>` : '';
      return `<div class="game-item"><strong>${g.title}</strong>${urlLink}<br><span>Notificato: ${date}</span></div>`;
    }).join('');

    // Sostituisci i placeholder
    template = template
      .replace(/{{USERS_TOTAL}}/g, users.total)
      .replace(/{{USERS_SUBSCRIBED}}/g, users.subscribed)
      .replace(/{{USERS_UNSUBSCRIBED}}/g, users.unsubscribed)
      .replace(/{{GAMES_NOTIFIED}}/g, games.notified)
      .replace(/{{GAMES_CURRENT}}/g, games.currentlyFree)
      .replace(/{{DB_TYPE}}/g, database.path)
      .replace(/{{DB_TABLES}}/g, database.tables.join(', '))
      .replace(/{{USERS_LIST}}/g, usersListHtml)
      .replace(/{{GAMES_LIST}}/g, gamesListHtml)
      .replace(/{{TIMESTAMP}}/g, now);

    return template;
  }

  /**
   * Genera HTML di errore
   */
  generateErrorHtml(errorMessage) {
    return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <title>Errore Dashboard</title>
  <style>
    body { 
      font-family: sans-serif; 
      background: #1a1a2e; 
      color: #fff; 
      display: flex; 
      justify-content: center; 
      align-items: center; 
      height: 100vh; 
      margin: 0;
    }
    .error { 
      background: #e94560; 
      padding: 30px; 
      border-radius: 12px;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="error">
    <h1>❌ Errore Dashboard</h1>
    <p>${errorMessage}</p>
  </div>
</body>
</html>`;
  }
}

module.exports = DashboardService;
