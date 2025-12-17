document.addEventListener('DOMContentLoaded', () => {
  if (typeof L === 'undefined') {
    console.error('Leaflet non trovato');
    return;
  }

  //CONFIGURAZIONE
  const PB_URL = 'http://127.0.0.1:8090';
  const COLLECTION_NAME = 'stations';
  // Aumenta l'intervallo a 60s se hai 10k stazioni, per non sovraccaricare il browser
  const REFRESH_INTERVAL_MS = 60 * 1000; 

  // Mappa
  const map = L.map('map').setView([20, 0], 2);

  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors'
  }).addTo(map);

  // Colori PM2.5
  function getColor(d) {
    return d > 250 ? '#7e0023' :
           d > 150 ? '#800080' :
           d > 55  ? '#ff0000' :
           d > 35  ? '#ff7e00' :
           d > 12  ? '#ffd700' :
                     '#00e400';
  }

  function getSize(d) {
    if (!d || d <= 0) return 6;
    return Math.min(30, 4 + Math.sqrt(d) * 2);
  }

  // Cluster
  const markers = (typeof L.markerClusterGroup === 'function')
    ? L.markerClusterGroup()
    : L.layerGroup();

  // Info box
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

  // Legenda
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

  // Funzione che scarica TUTTE le pagine da PocketBase
  async function fetchAllRecords() {
    let page = 1;
    let totalPages = 1;
    let allItems = [];

    // Ciclo finché non ho scaricato tutte le pagine
    do {
      // timestamp per evitare cache
      const url = `${PB_URL}/api/collections/${COLLECTION_NAME}/records?perPage=500&page=${page}&t=${Date.now()}`;
      
      const res = await fetch(url);
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}: ${txt}`);
      }

      const data = await res.json();
      const items = data.items || [];
      allItems = allItems.concat(items);
      
      totalPages = data.totalPages; // PocketBase ci dice quante pagine totali ci sono
      page++;
      
    } while (page <= totalPages);

    return allItems;
  }

  // Carica, mappa e disegna
  async function loadFromPocketBase() {
    try {
      info.update(null, true); // Mostra "Loading..."

      const items = await fetchAllRecords();

      // Mappatura dati PB -> Formato Mappa
      const results = items.map(row => ({
        location: row.location,
        city: row.city,
        country: row.country,
        coordinates: {
          latitude: row.lat,
          longitude: row.lon
        },
        measurements: [
          {
            parameter: row.parameter || 'pm25',
            value: row.value,
            unit: row.unit,
            lastUpdated: row.lastUpdated
          }
        ]
      }));

      // Filtro PM2.5 + coordinate valide
      const filtered = results.filter(r => {
        if (!r.coordinates.latitude || !r.coordinates.longitude) return false;
        const p = (r.measurements[0].parameter || '').toLowerCase();
        // Accetta 'pm25', 'pm2.5', ecc.
        return p.includes('pm2'); 
      });

      if (!filtered.length) {
        info.update(0);
        console.warn('Nessun record trovato.');
        return;
      }

      addResults(filtered);
      map.addLayer(markers);
      info.update(markers.getLayers().length);

      // Fit bounds solo al primo caricamento
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

  function addResults(list) {
    list.forEach(loc => {
      const coords = loc.coordinates;
      const measure = loc.measurements[0];
      const v = measure.value;
      if (v == null) return;

      const size = getSize(v);
      const color = getColor(v);
      
      const iconHtml =
        `<div style="background:${color};width:${size}px;height:${size}px;border-radius:50%;border:1px solid #fff;box-shadow:0 0 4px rgba(0,0,0,0.4);"></div>`;

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

  async function reloadData() {
    markers.clearLayers();
    await loadFromPocketBase();
  }

  // Avvio
  reloadData();

  // Ricarica periodica
  setInterval(reloadData, REFRESH_INTERVAL_MS);
});
