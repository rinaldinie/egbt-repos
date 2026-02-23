/**
 * Internationalization (i18n) module
 * Loads translations from JSON files based on configured language
 */

const path = require('path');
const fs = require('fs');

// Load translations from JSON files
const translations = {
    en: require('./en.json'),
    it: require('./it.json')
};

// Default language
let currentLang = process.env.BOT_LANGUAGE || 'it';

/**
 * Get current language
 */
function getLang() {
    return currentLang;
}

/**
 * Set current language
 */
function setLang(lang) {
    if (translations[lang]) {
        currentLang = lang;
    }
}

/**
 * Get translation object for current language
 */
function getTranslations() {
    return translations[currentLang] || translations['it'];
}

/**
 * Get a translation by key path
 * Supports dot notation: 'welcome.title', 'diagnostics.subscribedUsers'
 * Supports placeholder replacement: {count}, {sent}, {failed}, etc.
 */
function t(key, replacements = {}) {
    const keys = key.split('.');
    let value = getTranslations();

    // Navigate through nested object
    for (const k of keys) {
        if (value && typeof value === 'object' && k in value) {
            value = value[k];
        } else {
            // Key not found, try fallback to Italian
            value = translations['it'];
            for (const fallbackKey of keys) {
                if (value && typeof value === 'object' && fallbackKey in value) {
                    value = value[fallbackKey];
                } else {
                    return key; // Return key as fallback
                }
            }
            break;
        }
    }

    if (typeof value !== 'string') {
        return key;
    }

    // Replace placeholders
    return value.replace(/\{(\w+)\}/g, (match, placeholder) => {
        return replacements[placeholder] !== undefined ? replacements[placeholder] : match;
    });
}

/**
 * Get welcome message
 */
function welcome() {
    const trans = getTranslations().welcome;
    return `${trans.title}\n\n${trans.description}\n\n${trans.commands}`;
}

/**
 * Get help message
 */
function help() {
    const trans = getTranslations().help;
    return `${trans.title}\n\n${trans.commands}\n\n${trans.schedule}\n\n${trans.info}`;
}

/**
 * Get admin user notification message
 */
function adminUserNotified(name, id, isSubscribing, isGroup) {
    const action = isSubscribing ? 'iscritto' : 'disiscritto';
    const emoji = isSubscribing ? '✅' : '❌';
    const type = isGroup ? 'Gruppo' : 'Utente';

    return `${emoji} *${type} ${action}*\n\n👤 *Nome:* ${name}\n🆔 *ID:* ${id}\n📅 *Data:* ${new Date().toLocaleString(getLang() === 'it' ? 'it-IT' : 'en-US')}`;
}

/**
 * Get diagnostics user subscribed count message
 */
function diagnosticsSubscribedUsers(count) {
    return t('diagnostics.subscribedUsers', { count });
}

/**
 * Get diagnostics notified games count message
 */
function diagnosticsNotifiedGames(count) {
    return t('diagnostics.notifiedGames', { count });
}

/**
 * Get diagnostics current free games count message
 */
function diagnosticsCurrentFree(count) {
    return t('diagnostics.currentFree', { count });
}

/**
 * Get announce sent message
 */
function announceSent(sent, failed) {
    return t('announceSent', { sent, failed });
}

/**
 * Get announce sending message
 */
function announceSending(count) {
    return t('announceSending', { count });
}

/**
 * Get check result message
 */
function checkResult(message, timestamp) {
    return `${message}\n\n${t('checkStarted')}\n\nOrario: ${timestamp}`;
}

module.exports = {
    getLang,
    setLang,
    getTranslations,
    t,
    welcome,
    help,
    adminUserNotified,
    diagnosticsSubscribedUsers,
    diagnosticsNotifiedGames,
    diagnosticsCurrentFree,
    announceSent,
    announceSending,
    checkResult
};
