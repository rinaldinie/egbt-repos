/**
 * Script per inserire un utente o gruppo nel database PostgreSQL
 *
 * Uso: node scripts/insert_user.js <telegramId> <chatId> [username] [firstName] [isGroup]
 *
 * Esempi:
 *   node scripts/insert_user.js 123456789 123456789 mio_username "Mio Nome"
 *   node scripts/insert_user.js 123456789 123456789
 *   node scripts/insert_user.js -123456789 -123456789 null "Nome Gruppo" true
 */

const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('❌ DATABASE_URL non è impostata!');
  console.log('💡 Imposta la variabile d\'ambiente: export DATABASE_URL="postgresql://..."');
  process.exit(1);
}

const pool = new Pool({ connectionString: databaseUrl });

async function insertUser(telegramId, chatId, username = null, firstName = null, isGroup = false) {
  const query = `
    INSERT INTO users (telegramId, chatId, username, firstName, subscribed, createdAt, isGroup)
    VALUES ($1, $2, $3, $4, true, NOW(), $5)
    ON CONFLICT (telegramId) DO UPDATE SET
      chatId = EXCLUDED.chatId,
      username = EXCLUDED.username,
      firstName = EXCLUDED.firstName,
      subscribed = true,
      isGroup = EXCLUDED.isGroup
    RETURNING *;
  `;

  const values = [telegramId, chatId, username, firstName, isGroup];

  try {
    const result = await pool.query(query, values);
    const type = isGroup ? 'Gruppo' : 'Utente';
    console.log(`✅ ${type} inserito/aggiornato con successo:`);
    console.log(result.rows[0]);
    return result.rows[0];
  } catch (error) {
    console.error('❌ Errore nell\'inserimento:', error.message);
    throw error;
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log(`
📋 Uso: node scripts/insert_user.js <telegramId> <chatId> [username] [firstName] [isGroup]

Parametri:
  telegramId  (obbligatorio) - ID Telegram dell'utente o gruppo (negativo per i gruppi)
  chatId      (obbligatorio) - ID della chat (solitamente uguale a telegramId)
  username    (opzionale)    - Username Telegram (@username) - usa "null" per i gruppi
  firstName   (opzionale)    - Nome visualizzato dell'utente o nome del gruppo
  isGroup     (opzionale)    - "true" se è un gruppo, "false" (default) per utenti

Esempi:
  # Inserisci un utente
  node scripts/insert_user.js 123456789 123456789
  node scripts/insert_user.js 123456789 123456789 mio_username
  node scripts/insert_user.js 123456789 123456789 mio_username "Mario Rossi"

  # Inserisci un gruppo (ID negativo)
  node scripts/insert_user.js -123456789 -123456789 null "Il Mio Gruppo" true
    `);
    process.exit(1);
  }

  const telegramId = parseInt(args[0]);
  const chatId = parseInt(args[1]);
  const username = args[2] === 'null' ? null : (args[2] || null);
  const firstName = args[3] || null;
  const isGroup = args[4] === 'true';

  if (isNaN(telegramId) || isNaN(chatId)) {
    console.error('❌ telegramId e chatId devono essere numeri!');
    process.exit(1);
  }

  try {
    console.log('🔌 Connessione al database...');
    await insertUser(telegramId, chatId, username, firstName, isGroup);
    console.log('\n✅ Operazione completata!');
  } catch (error) {
    console.error('\n❌ Errore:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
