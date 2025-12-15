/**
 * Utilità per trovare il Telegram User ID
 * Script interattivo per ottenere l'ID dell'utente
 */

const TelegramBot = require('node-telegram-bot-api');
const readline = require('readline');

class UserIdFinder {
  constructor() {
    this.botToken = process.env.TELEGRAM_BOT_TOKEN || '';
    
    if (!this.botToken) {
      console.error('❌ Errore: TELEGRAM_BOT_TOKEN non configurato!');
      console.log('💡 Imposta la variabile d\'ambiente o crea un file .env con il tuo token.');
      process.exit(1);
    }
    
    // Crea un bot in modalità polling per catturare i messaggi
    this.bot = new TelegramBot(this.botToken, { polling: true });
    this.setupMessageListener();
  }

  setupMessageListener() {
    console.log('🔍 Ricerca Telegram User ID');
    console.log('='.repeat(40));
    console.log('📋 Istruzioni:');
    console.log('1. Vai su Telegram e trova il tuo bot');
    console.log('2. Invia qualsiasi messaggio al bot');
    console.log('3. Il tuo User ID apparirà qui sotto');
    console.log('4. Premi Ctrl+C per terminare');
    console.log('='.repeat(40));
    console.log('\n⏳ In attesa di messaggi...\n');

    // Ascolta qualsiasi tipo di messaggio
    this.bot.on('message', (msg) => {
      const user = msg.from;
      if (!user) return;

      console.log('🎉 RICEVUTO MESSAGGIO!');
      console.log('─'.repeat(30));
      console.log(`👤 Nome: ${user.first_name} ${user.last_name || ''}`);
      console.log(`🔗 Username: ${user.username || 'N/A'}`);
      console.log(`🆔 User ID: ${user.id}`);
      console.log(`💬 Chat ID: ${msg.chat.id}`);
      console.log(`📝 Messaggio: ${msg.text || msg.caption || '(media)'}`);
      console.log('─'.repeat(30));
      
      console.log('\n✅ CONFIGURAZIONE COMPLETATA!');
      console.log('\n📝 Copia questo valore per ADMIN_ID:');
      console.log(`ADMIN_ID=${user.id}`);
      
      console.log('\n🔧 Aggiungi al tuo file .env:');
      console.log(`ADMIN_ID=${user.id}`);
      
      console.log('\n🌐 Per Render, aggiungi questa variabile d\'ambiente:');
      console.log(`ADMIN_ID: ${user.id}`);
      
      console.log('\n⚠️ Salva questo ID in un posto sicuro!');
    });

    // Gestisci gli errori
    this.bot.on('polling_error', (error) => {
      console.error('❌ Errore di polling:', error.message);
    });

    // Gestisci chiusura
    process.on('SIGINT', () => {
      console.log('\n\n👋 Arrivederci!');
      this.bot.stopPolling();
      process.exit(0);
    });
  }
}

module.exports = UserIdFinder;

// Esegui il finder se il file viene eseguito direttamente
if (require.main === module) {
  const finder = new UserIdFinder();
}