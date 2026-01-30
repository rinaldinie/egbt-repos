/**
 * Servizio per la gestione degli annunci di versione
 * Legge il file announcements.md con YAML frontmatter e restituisce l'ultima versione
 */

const fs = require('fs');
const path = require('path');

class AnnouncementsService {
    constructor() {
        this.announcementsPath = path.join(process.cwd(), 'announcements.md');
    }

    /**
     * Parsa il contenuto YAML frontmatter da un blocco
     * @param {string} frontmatter - Il contenuto tra i separatori ---
     * @returns {Object} - Oggetto con i metadati
     */
    parseFrontmatter(frontmatter) {
        const metadata = {};
        const lines = frontmatter.trim().split('\n');

        for (const line of lines) {
            const match = line.match(/^(\w+):\s*["']?(.+?)["']?$/);
            if (match) {
                const [, key, value] = match;
                metadata[key] = value.replace(/^["']|["']$/g, '');
            }
        }

        return metadata;
    }

    /**
     * Legge e parsa tutti gli annunci dal file
     * @returns {Array} - Array di annunci ordinati per versione (più recente prima)
     */
    parseAnnouncements() {
        try {
            const content = fs.readFileSync(this.announcementsPath, 'utf8');
            const announcements = [];

            // Regex per trovare i blocchi con YAML frontmatter
            const blockRegex = /---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*?)(?=\n---|$)/g;
            let match;

            while ((match = blockRegex.exec(content)) !== null) {
                const frontmatter = match[1];
                const markdownContent = match[2].trim();

                const metadata = this.parseFrontmatter(frontmatter);

                if (metadata.version) {
                    announcements.push({
                        version: metadata.version,
                        date: metadata.date || null,
                        content: markdownContent
                    });
                }
            }

            // Ordina per versione (semplice confronto stringhe, formato semver)
            return announcements.sort((a, b) => {
                return this.compareVersions(b.version, a.version);
            });

        } catch (error) {
            console.error('❌ Errore nel leggere gli annunci:', error.message);
            return [];
        }
    }

    /**
     * Confronta due versioni semver
     * @param {string} v1 - Prima versione
     * @param {string} v2 - Seconda versione
     * @returns {number} - Positivo se v1 > v2, negativo se v1 < v2, 0 se uguali
     */
    compareVersions(v1, v2) {
        const parts1 = v1.split('.').map(Number);
        const parts2 = v2.split('.').map(Number);

        for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
            const p1 = parts1[i] || 0;
            const p2 = parts2[i] || 0;

            if (p1 > p2) return 1;
            if (p1 < p2) return -1;
        }

        return 0;
    }

    /**
     * Ottiene l'ultimo annuncio (versione più recente)
     * @returns {Object|null} - Ultimo annuncio o null
     */
    getLatestAnnouncement() {
        const announcements = this.parseAnnouncements();
        return announcements.length > 0 ? announcements[0] : null;
    }

    /**
     * Ottiene tutti gli annunci
     * @returns {Array} - Tutti gli annunci ordinati
     */
    getAllAnnouncements() {
        return this.parseAnnouncements();
    }

    /**
     * Ottiene gli annunci più recenti di una versione specifica
     * @param {string} sinceVersion - Versione di riferimento
     * @returns {Array} - Annunci più recenti della versione specificata
     */
    getAnnouncementsSince(sinceVersion) {
        const announcements = this.parseAnnouncements();
        return announcements.filter(a => this.compareVersions(a.version, sinceVersion) > 0);
    }

    /**
     * Converte il markdown in formato adatto per i messaggi Telegram
     * @param {string} markdown - Contenuto markdown
     * @returns {string} - Testo formattato per Telegram
     */
    formatForTelegram(markdown) {
        // Rimuovi il titolo principale (h1) perché lo gestiamo separatamente
        let text = markdown.replace(/^# .+\n+/m, '');

        // Converti gli header in bold
        text = text.replace(/^## (.+)$/gm, '*$1*');
        text = text.replace(/^### (.+)$/gm, '*$1*');

        // Converti il bold markdown (**testo**) in bold Telegram
        text = text.replace(/\*\*(.+?)\*\*/g, '*$1*');

        // Converti il corsivo markdown (*testo*) in corsivo Telegram
        text = text.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '_$1_');

        // Converti le liste puntate
        text = text.replace(/^- (.+)$/gm, '• $1');

        // Rimuovi i separatori orizzontali
        text = text.replace(/\n---\n/g, '\n');

        // Rimuovi linee vuote multiple
        text = text.replace(/\n{3,}/g, '\n\n');

        return text.trim();
    }

    /**
     * Ottiene l'ultimo annuncio formattato per Telegram
     * @returns {Object|null} - Annuncio formattato
     */
    getLatestAnnouncementForTelegram() {
        const announcement = this.getLatestAnnouncement();

        if (!announcement) return null;

        return {
            version: announcement.version,
            date: announcement.date,
            title: `🎮 Aggiornamento v${announcement.version}`,
            content: this.formatForTelegram(announcement.content)
        };
    }

    /**
     * Formatta un annuncio completo con titolo per l'invio
     * @param {Object} announcement - Annuncio da formattare
     * @returns {string} - Messaggio completo pronto per l'invio
     */
    buildAnnouncementMessage(announcement) {
        const parts = [
            `🎮 *Aggiornamento Bot Epic Games v${announcement.version}*`,
            ''
        ];

        if (announcement.date) {
            parts.push(`📅 ${announcement.date}`);
            parts.push('');
        }

        parts.push(this.formatForTelegram(announcement.content));

        return parts.join('\n');
    }
}

module.exports = AnnouncementsService;
