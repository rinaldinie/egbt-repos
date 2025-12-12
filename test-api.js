#!/usr/bin/env node

const axios = require('axios');

/**
 * Script di test per verificare il parsing dell'API di Epic Games
 * e la logica di identificazione dei giochi gratuiti
 */

class EpicGamesParser {
  constructor() {
    // Endpoint parametrizzato per l'Italia
    this.apiUrl = 'https://store-site-backend-static.ak.epicgames.com/freeGamesPromotions?locale=it-IT&country=IT&allowCountries=IT';
  }

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
            this.logPromotionDetails(game);
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

      // Dettagli giochi gratuiti
      if (freeGames.length > 0) {
        console.log('\n🎮 DETTAGLI GIOCHI GRATUITI:');
        freeGames.forEach((game, index) => {
          const endDate = this.getPromotionEndDate(game);
          console.log(`\n${index + 1}. ${game.title}`);
          console.log(`   📅 Fine promozione: ${endDate ? new Date(endDate).toLocaleDateString('it-IT') : 'N/D'}`);
          console.log(`   🔗 Link: ${game.url}`);
          console.log(`   📝 Descrizione: ${game.description?.substring(0, 100)}...`);
        });
      }

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

  getPromotionEndDate(game) {
    // Estrae la data di fine promozione dalla struttura corretta
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

  logPromotionDetails(game) {
    if (!game.promotions?.promotionalOffers) return;

    for (let i = 0; i < game.promotions.promotionalOffers.length; i++) {
      const promotion = game.promotions.promotionalOffers[i];
      console.log(`   📦 Promozione ${i + 1}:`);

      if (!promotion.promotionalOffers) {
        console.log('      ❌ Nessuna offerta');
        continue;
      }

      for (let j = 0; j < promotion.promotionalOffers.length; j++) {
        const offer = promotion.promotionalOffers[j];
        console.log(`      🎯 Offerta ${j + 1}:`);
        console.log(`         💰 Sconto: ${offer.discountSetting?.discountPercentage}%`);
        console.log(`         📅 Inizio: ${offer.startDate}`);
        console.log(`         📅 Fine: ${offer.endDate}`);
        console.log(`         💵 Prezzo: ${game.price?.totalPrice?.discountPrice} ${game.price?.totalPrice?.currencyCode}`);
      }
    }
  }
}

// Esegui il test
async function main() {
  const parser = new EpicGamesParser();
  const result = await parser.testApi();

  if (result && result.freeGames > 0) {
    console.log('\n🎉 SUCCESSO: La logica di parsing funziona correttamente!');
    console.log(`✅ Rilevati ${result.freeGames} giochi gratuiti su ${result.totalGames} totali`);
  } else if (result) {
    console.log('\n⚠️  ATTENZIONE: Nessun gioco gratuito trovato al momento');
    console.log('Questo potrebbe essere normale se non ci sono promozioni attive');
  } else {
    console.log('\n❌ ERRORE: Impossibile testare l\'API');
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = EpicGamesParser;