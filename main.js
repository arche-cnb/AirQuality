// Aspetta che l'intero documento HTML sia caricato prima di eseguire lo script
document.addEventListener('DOMContentLoaded', () => {

  // Controlla se la libreria Leaflet è stata caricata
  if (typeof L === 'undefined') {
    console.error('Leaflet non trovato');
    return;
  }

  //CONFIGURAZIONE BASE
  const PB_URL = 'http://127.0.0.1:8090';   // URL del server PocketBase locale
  const COLLECTION_NAME = 'stations';       // Nome della collezione da cui leggere i dati
  const REFRESH_INTERVAL_MS = 60 * 1000;    // Intervallo di aggiornamento in millisecondi (60s)

  // CREAZIONE MAPPA
  // Inizializza la mappa e la centra su coordinate generiche (lat: 20, lon: 0)
  const map = L.map('map').setView([20, 0], 2);

  // Aggiunge tile OpenStreetMap alla mappa come sfondo
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors'
  }).addTo(map);

  //FUNZIONE PER DETERMINARE IL COLORE IN BASE AL VALORE PM2.5 
  function getColor(d) {
    return d > 250 ? '#7e0023' :   // viola scura molto inquinato
           d > 150 ? '#800080' :   // viola medio
           d > 55  ? '#ff0000' :   // rosso
           d > 35  ? '#ff7e00' :   // arancione
           d > 12  ? '#ffd700' :   // giallo
                      '#00e400';   // verde aria pulita
  }

  // FUNZIONE PER DIMENSIONARE IL MARKER IN BASE AL VALORE PM2.5
  function getSize(d) {
    if (!d || d <= 0) return 6;           // dimensione minima se nessun valore
    return Math.min(30, 4 + Math.sqrt(d) * 2);  // cresce con il valore, limite 30px
  }

  //GRUPPO MARKER 
  const markers = (typeof L.markerClusterGroup === 'function')
    ? L.markerClusterGroup()
    : L.layerGroup();

  // CONTROLLO INFO IN ALTO A DESTRA
  const info = L.control({ position: 'topright' });
  info.onAdd = function () {
    this._div = L.DomUtil.create('div', 'info');
    this.update();
    return this._div;
  };
  info.update = function (count, isLoading) {
    const status = isLoading ? 'Loading...' : (count ? `<b>${count}</b> stazioni` : 'Nessun dato');
    this._div.innerHTML = `<strong>PocketBase (PM2.5)</strong><br/>${status}`;
  };
  info.updateError = function (msg) {
    this._div.innerHTML = `<strong>PocketBase (PM2.5)</strong><br/>${msg || 'Error'}`;
  };
  info.addTo(map);

  //LEGENDA IN BASSO A DESTRA
  const legend = L.control({ position: 'bottomright' });
  legend.onAdd = function () {
    const div = L.DomUtil.create('div', 'info legend');
    const grades = [0, 12, 35, 55, 150, 250];

    div.innerHTML += '<strong>PM2.5 (µg/m³)</strong><br/>';
    for (let i = 0; i < grades.length; i++) {
      const from = grades[i];
      const to = grades[i + 1];
      const color = getColor(from + 0.1);
      div.innerHTML +=
        '<i style="background:' + color + '"></i> ' +
        from + (to ? '&ndash;' + to + '<br/>' : '+');
    }
    return div;
  };
  legend.addTo(map);

  //FUNZIONE PER SCARICARE TUTTI I RECORD DA POCKETBASE
  async function fetchAllRecords() {
    let page = 1;
    let totalPages = 1;
    let allItems = [];

    // finché ci sono pagine da scaricare
    do {
      const url = `${PB_URL}/api/collections/${COLLECTION_NAME}/records?perPage=500&page=${page}&t=${Date.now()}`;
      
      const res = await fetch(url);
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}: ${txt}`);
      }

      const data = await res.json();
      const items = data.items || [];
      allItems = allItems.concat(items);
      totalPages = data.totalPages;   // PocketBase fornisce quante pagine totali ci sono
      page++;
    } while (page <= totalPages);

    return allItems;
  }

  //FUNZIONE CHE CARICA E DISEGNA I DATI SULLA MAPP A
  async function loadFromPocketBase() {
    try {
      info.update(null, true); // Loading

      const items = await fetchAllRecords();

      // Conversione dei dati PocketBase nel formato usato dalla mappa
      const results = items.map(row => ({
        location: row.location,
        city: row.city,
        country: row.country,
        coordinates: { latitude: row.lat, longitude: row.lon },
        measurements: [{
          parameter: row.parameter || 'pm25',
          value: row.value,
          unit: row.unit,
          lastUpdated: row.lastUpdated
        }]
      }));

      // Filtra solo valori PM2.5 validi con coordinate presenti
      const filtered = results.filter(r => {
        if (!r.coordinates.latitude || !r.coordinates.longitude) return false;
        const p = (r.measurements[0].parameter || '').toLowerCase();
        return p.includes('pm2'); // accetta 'pm25' o 'pm2.5'
      });

      if (!filtered.length) {
        info.update(0);
        console.warn('Nessun record trovato.');
        return;
      }

      // Aggiunge i risultati alla mappa
      addResults(filtered);
      map.addLayer(markers);
      info.update(markers.getLayers().length);

      // Zoom automatico sul primo caricamento
      if (markers.getLayers().length > 0 && !window.hasFittedBounds) {
        try {
          map.fitBounds(markers.getBounds(), { maxZoom: 4 });
          window.hasFittedBounds = true;
        } catch(e) {}
      }

    } catch (err) {
      console.error('Errore PocketBase:', err);
      info.updateError('PB Connection Error');
    }
  }

  //FUNZIONE CHE CREA E AGGIUNGE I MARKER ALLA MAPPA
  function addResults(list) {
    list.forEach(loc => {
      const coords = loc.coordinates;
      const measure = loc.measurements[0];
      const v = measure.value;
      if (v == null) return;

      const size = getSize(v);
      const color = getColor(v);

      // HTML per il marker circolare colorato
      const iconHtml =
        `<div style="background:${color};width:${size}px;height:${size}px;border-radius:50%;border:1px solid #fff;box-shadow:0 0 4px rgba(0,0,0,0.4);"></div>`;

      // Crea l'icona e il marker
      const icon = L.divIcon({
        className: '',
        html: iconHtml,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2]
      });

      const marker = L.marker(
        [coords.latitude, coords.longitude],
        { icon }
      );

      // Popup informativo con dettagli sul punto
      const when = measure.lastUpdated
        ? new Date(measure.lastUpdated).toLocaleString()
        : 'N/D';

      const popup =
        `<strong>${loc.location || 'Stazione'}</strong><br/>` +
        `${loc.city || ''} ${loc.country || ''}<br/>` +
        `PM2.5: <b>${v}</b> ${measure.unit || ''}<br/>` +
        `<small>Updated: ${when}</small>`;

      marker.bindPopup(popup);
      markers.addLayer(marker);
    });
  }

  //FUNZIONE CHE RICARICA TUTTI I DATI
  async function reloadData() {
    markers.clearLayers();      // svuota i marker attuali
    await loadFromPocketBase(); // ricarica e ridisegna
  }

  // AVVIO INIZIALE
  reloadData();

  //RICARICA AUTOMATICA OGNI X SECONDI
  setInterval(reloadData, REFRESH_INTERVAL_MS);
});
