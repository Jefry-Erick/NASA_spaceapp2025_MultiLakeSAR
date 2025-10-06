// Servicio de dataset (Modelo): parseo y validación

export class DatasetService {
  constructor() {
    this.csv = null;
    this.json = null;
    this.vv = null;
    this.vh = null;
    this.dates = [];
    this.csvParsed = null;
    // URLs opcionales
    this.urlCsv = null;
    this.urlJson = null;
    this.urlVv = null;
    this.urlVh = null;
    // Estado de disponibilidad de rasters
    this.haveRasters = false;
  }

  async collectInputs() {
    this.csv = document.getElementById('fileCsv').files[0] || null;
    this.json = document.getElementById('fileJson').files[0] || null;
    this.vv = document.getElementById('fileVv').files[0] || null;
    this.vh = document.getElementById('fileVh').files[0] || null;
    // Tomar URLs si se especifican
    this.urlCsv = (document.getElementById('urlCsv')?.value || '').trim() || null;
    this.urlJson = (document.getElementById('urlJson')?.value || '').trim() || null;
    this.urlVv = (document.getElementById('urlVv')?.value || '').trim() || null;
    this.urlVh = (document.getElementById('urlVh')?.value || '').trim() || null;
  }

  async validate() {
    // GeoTIFFs: permitir validar solo CSV/JSON aunque falten rasters
    const haveRasters = !!(this.vv || this.urlVv || this.vh || this.urlVh);
    this.haveRasters = haveRasters;
    const haveMeta = !!(this.csv || this.urlCsv || this.json || this.urlJson);
    if (!haveRasters && !haveMeta) {
      throw new Error('No data to validate. Provide CSV/JSON or VV/VH rasters.');
    }

    // CSV
    if (this.csv || this.urlCsv) {
      const text = this.csv ? await this.readFileAsText(this.csv) : await this.fetchText(this.urlCsv);
      const parsed = this.safeCSVParse(text);
      this.csvParsed = parsed;
      if (!this.validateCSVSchema(parsed.header)) {
        throw new Error('CSV does not match the expected SAR data schema.');
      }
      this.dates = this.inferDates(parsed.rows);
    }

    // JSON opcional
    if (this.json || this.urlJson) {
      const text = this.json ? await this.readFileAsText(this.json) : await this.fetchText(this.urlJson);
      try { JSON.parse(text); } catch { throw new Error('Invalid metadata JSON.'); }
    }
  }

  readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = (e) => reject(e);
      reader.readAsText(file);
    });
  }

  safeCSVParse(text) {
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

  validateCSVSchema(header) {
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

  inferDates(rows) {
    const dates = rows.map((r) => r['acquisition_date']).filter(Boolean);
    return Array.from(new Set(dates)).sort();
  }

  async fetchText(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to read URL: ${url}`);
    return await res.text();
  }
}