// Titicaca SAR Monitor - lógica base (migrado a MVC en mvc/main.js)

const el = (id) => document.getElementById(id);

// Estado del dataset cargado
const state = {
  csvMeta: null, // contenido CSV
  jsonMeta: null, // contenido JSON
  vvRaster: null, // archivo GeoTIFF VV
  vhRaster: null, // archivo GeoTIFF VH
  dates: [], // fechas disponibles
};

// Helpers de lectura
function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = (e) => reject(e);
    reader.readAsText(file);
  });
}

function safeCSVParse(text) {
  // Parse muy simple (sin comillas), suficiente para nuestros CSV simulados
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const header = lines[0].split(',').map((h) => h.trim());
  const rows = lines.slice(1).map((line) => {
    const cols = line.split(',');
    const obj = {};
    header.forEach((h, i) => (obj[h] = (cols[i] ?? '').trim()));
    return obj;
  });
  return { header, rows };
}

function validateCSVSchema(header) {
  // Aceptamos dos esquemas: datos_simulados.csv y datos simulados.csv
  const schemaA = [
    'product_id','mission','sensor','band','polarization','acquisition_date','acquisition_time_utc','center_lat','center_lon','orbit_direction','incidence_angle_deg','look_angle_deg','resolution_m','sigma0_vv_db','sigma0_vh_db','coherence','deformation_mm','soil_moisture_pct','water_mask','quality_flag'
  ];
  const schemaB = [
    'scene_id','platform','band','polarization','acquisition_date','orbit_direction','look_direction','incidence_angle_deg','lat','lon','land_cover','backscatter_dB','coherence','dem_elevation_m','quality_flag'
  ];
  const hset = new Set(header);
  const matchA = schemaA.every((k) => hset.has(k));
  const matchB = schemaB.every((k) => hset.has(k));
  return matchA || matchB;
}

function inferDates(rows) {
  const dates = rows.map((r) => r['acquisition_date']).filter(Boolean);
  return Array.from(new Set(dates)).sort();
}

async function onValidate() {
  const status = el('validationStatus');
  status.className = 'status';
  status.textContent = 'Validando dataset…';

  try {
    // CSV
    const csvFile = el('fileCsv').files[0];
    let csvParsed = null;
    if (csvFile) {
      const text = await readFileAsText(csvFile);
      csvParsed = safeCSVParse(text);
      if (!validateCSVSchema(csvParsed.header)) {
        status.className = 'status warn';
        status.textContent = 'CSV no cumple el esquema esperado para datos SAR.';
        return;
      }
      state.csvMeta = csvParsed;
      state.dates = inferDates(csvParsed.rows);
    }

    // JSON opcional
    const jsonFile = el('fileJson').files[0];
    if (jsonFile) {
      const text = await readFileAsText(jsonFile);
      try {
        state.jsonMeta = JSON.parse(text);
      } catch (e) {
        status.className = 'status warn';
        status.textContent = 'JSON de metadatos inválido.';
        return;
      }
    }

    // Rasters (GeoTIFF) VV/VH
    const vvFile = el('fileVv').files[0];
    const vhFile = el('fileVh').files[0];
    if (!vvFile || !vhFile) {
      status.className = 'status warn';
      status.textContent = 'Faltan rasters GeoTIFF VV y/o VH.';
      return;
    }
    state.vvRaster = vvFile;
    state.vhRaster = vhFile;

    // Actualizar UI de tiempo
    const slider = el('timeSlider');
    slider.min = 0;
    slider.max = Math.max(0, state.dates.length - 1);
    slider.value = 0;
    el('timeLabel').textContent = `Fecha: ${state.dates[0] ?? 'n/a'}`;

    status.className = 'status ok';
    status.textContent = 'Dataset validado. Listo para visualizar y analizar.';
  } catch (err) {
    console.error(err);
    status.className = 'status warn';
    status.textContent = 'Error durante la validación.';
  }
}

function onTimeChange(e) {
  const idx = Number(e.target.value);
  const date = state.dates[idx] ?? 'n/a';
  el('timeLabel').textContent = `Fecha: ${date}`;
  // TODO: actualizar mapa y métricas para la fecha seleccionada
}

function setupLayerToggles() {
  const ids = ['layerVV','layerVH','layerRGB','layerCoast','layerTotorales'];
  ids.forEach((id) => {
    el(id).addEventListener('change', () => {
      // TODO: mostrar/ocultar capas en mapa
      console.log(`Toggle capa ${id}:`, el(id).checked);
    });
  });
}

function setupNav() {
  el('btnHelp').addEventListener('click', () => {
    alert('Guía rápida:\n1) Carga CSV/JSON y GeoTIFF VV/VH.\n2) Valida el dataset.\n3) Usa el slider temporal y las capas para explorar.');
  });
  el('btnAbout').addEventListener('click', () => {
    document.getElementById('panelAbout').scrollIntoView({ behavior: 'smooth' });
  });
}

// Init
// Este archivo queda como referencia. La inicialización actual está en mvc/main.js