// Importa il modulo filesystem nativo di Node.js per leggere file
import fs from 'fs';

// Importa il client ufficiale PocketBase per comunicare con il server
import PocketBase from 'pocketbase';

// Crea client PocketBase puntando al server locale (porta 8090)
const pb = new PocketBase('http://127.0.0.1:8090');

// Se la collezione "stations" richiede autenticazione admin, scommenta:
// await pb.admins.authWithPassword('tua@email.com', 'password');

async function importData() {
  // Legge il file JSON contenente i dati OpenAQ (sincrono)
  const raw = fs.readFileSync('./openaq.json', 'utf8');
  
  // Converte il JSON in array JavaScript
  const rows = JSON.parse(raw);

  // Mostra quante righe verranno importate
  console.log(`Trovati ${rows.length} record. Inizio importazione...`);

  // Per ogni riga del file JSON...
  for (const row of rows) {
    // Salta record senza coordinate geografiche
    if (!row.coordinates) continue;

    // Mappa i dati dal formato OpenAQ al formato della collezione PocketBase
    const recordData = {
      location: row.location,                    // Nome della stazione
      city: row.city,                           // Città
      country: row.country,                     // Paese
      lat: row.coordinates.lat,                 // Latitudine (da oggetto nidificato)
      lon: row.coordinates.lon,                 // Longitudine
      parameter: row.measurements_parameter || 'pm25',  // Parametro (default PM2.5)
      value: row.measurements_value,            // Valore misurato
      unit: row.measurements_unit,              // Unità di misura (µg/m³)
      lastUpdated: row.measurements_lastupdated // Timestamp ultimo aggiornamento
    };

    try {
      // Crea NUOVO record nella collezione "stations" via API REST
      await pb.collection('stations').create(recordData);
      
      // Stampa un punto per ogni record importato (feedback visivo)
      process.stdout.write('.');
      
    } catch (err) {
      // Se un record fallisce (duplicato, dati invalidi, ecc.), logga errore ma continua
      console.error('\nErrore record:', err.message);
    }
  }
  
  // Messaggio finale quando l'import è completato
  console.log('\nFinito!');
}

// Esegue l'importazione
importData();
