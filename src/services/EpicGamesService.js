/**
 * Servizio per l'integrazione con l'API di Epic Games
 * Responsabile del recupero e parsing dei giochi gratuiti
 */

const axios = require('axios');

class EpicGamesService {
  constructor() {
    // Endpoint parametrizzato per l'Italia
    this.apiUrl = 'https://store-site-backend-static.ak.epicgames.com/freeGamesPromotions?locale=it-IT&country=IT&allowCountries=IT';
  }

  /**
   * Recupera tutti i giochi gratuiti attuali dall'API di Epic Games
   */
  async getFreeGames() {
    try {
      const response = await axios.get(this.apiUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept-Language': 'it-IT,it;q=0.9,en;q=0.8'
        }
      });

      const games = [];
      const data = response.data.data.Catalog.searchStore.elements;

      for (const game of data) {
        if (this.isGameFree(game)) {
          games.push(game);
        }
      }

      console.log(`🎮 Trovati ${games.length} giochi gratuiti per l'Italia:`, games.map(g => g.title));
      return games;
    } catch (error) {
      console.error('Errore nel recupero dei giochi gratuiti:', error);
      return [];
    }
  }

  /**
   * Verifica se un gioco è gratuito basandosi sulle promozioni attive
   */
  isGameFree(game) {
    // Se non ci sono promozioni, il gioco non è gratuito
    if (!game.promotions) {
      return false;
    }

    // Controlla le offerte promozionali
    const promotionalOffers = game.promotions.promotionalOffers;
    if (!promotionalOffers || promotionalOffers.length === 0) {
      return false;
    }

    // Cerca offerte con sconto al 100% (gratuito)
    for (const promotion of promotionalOffers) {
      if (!promotion.promotionalOffers || promotion.promotionalOffers.length === 0) {
        continue;
      }

      for (const offer of promotion.promotionalOffers) {
        // Controlla se lo sconto è 100% (gratuito)
        if (offer.discountSetting?.discountPercentage === 0) {
          return true;
        }

        // Controlla anche il prezzo finale come fallback
        if (game.price?.totalPrice?.discountPrice === 0) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Costruisce l'URL diretto al gioco su Epic Games Store
   */
  buildGameUrl(game) {
    // Metodi per costruire il link del gioco in ordine di priorità
    if (game.url) {
      return game.url;
    }
    
    if (game.productSlug) {
      return `https://store.epicgames.com/it/p/${game.productSlug}`;
    }
    
    if (game.offerMappings && game.offerMappings.length > 0) {
      const mapping = game.offerMappings[0];
      if (mapping.pageSlug) {
        return `https://store.epicgames.com/it/p/${mapping.pageSlug}`;
      }
    }
    
    // Fallback: usa l'ID del gioco
    if (game.id) {
      return `https://store.epicgames.com/it/p/${game.id}`;
    }
    
    // Fallback finale: link alla ricerca
    return `https://store.epicgames.com/it/browse?q=${encodeURIComponent(game.title)}`;
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
   * Testa la connessione all'API
   */
  async testApi() {
    console.log('🔍 Test dell\'API Epic Games (localizzazione IT)...');
    console.log('=====================================================');

    try {
      const response = await axios.get(this.apiUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept-Language': 'it-IT,it;q=0.9,en;q=0.8'
        }
      });

      console.log('✅ API chiamata con successo');
      console.log(`📊 Status: ${response.status}`);
      console.log(`📦 Dimensione response: ${JSON.stringify(response.data).length} characters`);
      console.log(`🌍 Localizzazione: it-IT`);
      console.log(`🇮🇹 Paese: IT`);

      // Estrai gli elementi
      const elements = response.data.data.Catalog.searchStore.elements;
      console.log(`🎮 Totale giochi trovati: ${elements.length}`);

      // Analizza ogni gioco
      const freeGames = [];
      const paidGames = [];
      const noPromotionGames = [];

      for (let i = 0; i < elements.length; i++) {
        const game = elements[i];
        console.log(`\n--- Analisi gioco ${i + 1}: ${game.title} ---`);

        if (this.isGameFree(game)) {
          freeGames.push(game);
          console.log('✅ GIOCO GRATUITO');
        } else {
          paidGames.push(game);
          console.log('❌ Non gratuito');

          // Analisi dettagliata
          if (!game.promotions) {
            noPromotionGames.push(game);
            console.log('   📝 Nessuna promozione attiva');
          } else {
            console.log('   📝 Promozioni presenti ma non gratuite');
          }
        }
      }

      // Riepilogo finale
      console.log('\n📊 RIEPILOGO FINALE');
      console.log('==================');
      console.log(`✅ Giochi gratuiti trovati: ${freeGames.length}`);
      console.log(`❌ Giochi non gratuiti: ${paidGames.length}`);
      console.log(`📝 Giochi senza promozione: ${noPromotionGames.length}`);
      console.log(`🌍 Risultati per: Italia (IT)`);

      return {
        totalGames: elements.length,
        freeGames: freeGames.length,
        paidGames: paidGames.length,
        noPromotionGames: noPromotionGames.length,
        freeGamesDetails: freeGames,
        country: 'IT',
        locale: 'it-IT'
      };

    } catch (error) {
      console.error('❌ Errore nel test dell\'API:', error.message);
      if (error.response) {
        console.error(`Status: ${error.response.status}`);
        console.error(`Headers: ${JSON.stringify(error.response.headers, null, 2)}`);
      }
      return null;
    }
  }
}

module.exports = EpicGamesService;