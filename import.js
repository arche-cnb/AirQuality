import fs from 'fs';
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

async function importData() {
  const raw = fs.readFileSync('./openaq.json', 'utf8');
  const rows = JSON.parse(raw);

  console.log(`Trovati ${rows.length} record. Inizio importazione...`);

  for (const row of rows) {
    if (!row.coordinates) continue;

    const recordData = {
      location: row.location,
      city: row.city,
      country: row.country,
      lat: row.coordinates.lat,
      lon: row.coordinates.lon,
      parameter: row.measurements_parameter || 'pm25',
      value: row.measurements_value,
      unit: row.measurements_unit,
      lastUpdated: row.measurements_lastupdated
    };

    try {
      await pb.collection('stations').create(recordData);
      process.stdout.write('.'); // feedback visivo
    } catch (err) {
      console.error('\nErrore record:', err.message);
    }
  }
  console.log('\nFinito!');
}

importData();
