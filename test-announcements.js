#!/usr/bin/env node

/**
 * Script di test per il servizio annunci
 */

const AnnouncementsService = require('./src/services/AnnouncementsService');

const service = new AnnouncementsService();

console.log('🧪 Test AnnouncementsService\n');
console.log('='.repeat(50));

// Test 1: Ottieni tutti gli annunci
console.log('\n📋 Tutti gli annunci:');
const all = service.getAllAnnouncements();
all.forEach(a => {
    console.log(`  - v${a.version} (${a.date})`);
});

// Test 2: Ottieni l'ultimo annuncio
console.log('\n🆕 Ultimo annuncio:');
const latest = service.getLatestAnnouncement();
if (latest) {
    console.log(`  Versione: ${latest.version}`);
    console.log(`  Data: ${latest.date}`);
    console.log(`  Contenuto preview: ${latest.content.substring(0, 100)}...`);
}

// Test 3: Formattazione per Telegram
console.log('\n📱 Formattato per Telegram:');
const telegramVersion = service.getLatestAnnouncementForTelegram();
if (telegramVersion) {
    console.log(`  Titolo: ${telegramVersion.title}`);
    console.log('\n  Contenuto:');
    console.log(telegramVersion.content);
}

// Test 4: Messaggio completo
console.log('\n📤 Messaggio completo:');
if (latest) {
    const message = service.buildAnnouncementMessage(latest);
    console.log(message);
}

// Test 5: Annunci dalla versione 1.0.0
console.log('\n📈 Annunci dalla v1.0.0:');
const since = service.getAnnouncementsSince('1.0.0');
since.forEach(a => {
    console.log(`  - v${a.version}`);
});

console.log('\n✅ Test completati!');
