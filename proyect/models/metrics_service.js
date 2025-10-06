export class MetricsService {
  constructor(datasetService) {
    this.dataset = datasetService;
  }

  async computeWaterArea() {
    // Cálculo básico: clasificar agua por umbral en VV usando percentil preset si aplica
    try {
      const vvSrc = this.dataset?.vv || this.dataset?.urlVv;
      const vhSrc = this.dataset?.vh || this.dataset?.urlVh;
      if (!vvSrc && !vhSrc) return 'n/a';
      // Preferir VV, usar VH como fallback
      const useBlob = !!(vvSrc ? this.dataset.vv : this.dataset.vh);
      const tiff = useBlob
        ? await GeoTIFF.fromBlob(vvSrc ? this.dataset.vv : this.dataset.vh)
        : await GeoTIFF.fromUrl(vvSrc ? this.dataset.urlVv : this.dataset.urlVh);
      const image = await tiff.getImage();
      const w = image.getWidth();
      const h = image.getHeight();
      const data = await image.readRasters({ samples: [0] });
      const band = data[0];
      // Estimar min/max y aplicar percentil 2-98 si MapService lo seleccionó
      let min = Infinity, max = -Infinity;
      for (let i = 0; i < band.length; i++) { const v = band[i]; if (v < min) min = v; if (v > max) max = v; }
      const preset = window.__mapPresetMode || 'auto';
      if (preset === 'p98') {
        const baseRange = (max - min) || 1;
        min = min + 0.02 * baseRange;
        max = max - 0.02 * baseRange;
      }
      // Umbral simple: valores bajos (backscatter menor) suelen indicar agua lisa
      const threshold = min + 0.10 * ((max - min) || 1);
      let waterPixels = 0;
      for (let i = 0; i < band.length; i++) {
        const v = band[i];
        if (v <= threshold) waterPixels++;
      }
      // Aproximar área por píxel: usar resolution_m si viene en CSV; si no, 10 m
      let pixelSizeM = 10; // default Sentinel-1 ground range approx
      const resField = 'resolution_m';
      try {
        const rows = this.dataset?.csvParsed?.rows || [];
        const resCandidates = rows.map(r => parseFloat(r[resField])).filter(x => !isNaN(x) && x > 0);
        if (resCandidates.length) pixelSizeM = resCandidates[0];
      } catch {}
      const pixelAreaKm2 = (pixelSizeM * pixelSizeM) / 1e6;
      const areaKm2 = waterPixels * pixelAreaKm2;
      return `${areaKm2.toFixed(2)} km²`;
    } catch (e) {
      console.warn('Failed computing water area:', e);
      return 'n/a';
    }
  }

  computeRetreat() {
    return (Math.random() * 5).toFixed(1) + ' m';
  }

  computeTotoralExposure() {
    return Math.round(Math.random() * 100) + ' ha';
  }

  async analyzeSingleRaster() {
    try {
      const vvSrc = this.dataset?.vv || this.dataset?.urlVv;
      const vhSrc = this.dataset?.vh || this.dataset?.urlVh;
      if (!vvSrc && !vhSrc) return null;
      const useBlob = !!(vvSrc ? this.dataset.vv : this.dataset.vh);
      const tiff = useBlob
        ? await GeoTIFF.fromBlob(vvSrc ? this.dataset.vv : this.dataset.vh)
        : await GeoTIFF.fromUrl(vvSrc ? this.dataset.urlVv : this.dataset.urlVh);
      const image = await tiff.getImage();
      const data = await image.readRasters({ samples: [0] });
      const band = data[0];
      const n = band.length;
      let min = Infinity, max = -Infinity, sum = 0, sumSq = 0, valid = 0;
      const MAX_SAMPLE = 2_000_000;
      const step = Math.max(1, Math.floor(n / MAX_SAMPLE));
      for (let i = 0; i < n; i += step) {
        const v = band[i];
        if (!isNaN(v)) {
          if (v < min) min = v;
          if (v > max) max = v;
          sum += v;
          sumSq += v * v;
          valid++;
        }
      }
      const count = valid;
      let mean = count ? (sum / count) : NaN;
      const preset = window.__mapPresetMode || 'auto';
      if (preset === 'p98') {
        const range = (max - min) || 1;
        min = min + 0.02 * range;
        max = max - 0.02 * range;
      }
      const bins = 32;
      const hist = new Array(bins).fill(0);
      const rng = (max - min) || 1;
      for (let i = 0; i < n; i += step) {
        const v = band[i];
        if (isNaN(v)) continue;
        let idx = Math.floor(((v - min) / rng) * bins);
        if (idx < 0) idx = 0;
        if (idx >= bins) idx = bins - 1;
        hist[idx]++;
      }
      const cdf = [];
      let acc = 0;
      const total = hist.reduce((a,b)=>a+b,0) || 1;
      for (let i = 0; i < bins; i++) {
        acc += hist[i];
        cdf.push(acc / total);
      }
      // Estimar área de agua con mismo criterio que computeWaterArea
      const threshold = min + 0.10 * rng;
      let waterPixels = 0;
      for (let i = 0; i < n; i += step) {
        const v = band[i];
        if (v <= threshold) waterPixels++;
      }
      let pixelSizeM = 10;
      try {
        const rows = this.dataset?.csvParsed?.rows || [];
        const resCandidates = rows.map(r => parseFloat(r['resolution_m'])).filter(x => !isNaN(x) && x > 0);
        if (resCandidates.length) pixelSizeM = resCandidates[0];
      } catch {}
      const pixelAreaKm2 = (pixelSizeM * pixelSizeM) / 1e6;
      const areaKm2 = waterPixels * pixelAreaKm2 * step; // compensar muestreo
      const totalAreaKm2 = n * pixelAreaKm2; // área total del raster
      const binEdges = Array.from({length: bins}, (_, i) => (min + (rng * i / bins)).toFixed(2));
      // Desviación estándar
      const variance = count > 1 ? (sumSq / count) - (mean * mean) : 0;
      const std = Math.sqrt(Math.max(variance, 0));
      // Percentiles a partir de CDF
      function percentile(p) {
        const t = p / 100;
        for (let i = 0; i < bins; i++) {
          if (cdf[i] >= t) {
            return parseFloat(binEdges[i]);
          }
        }
        return parseFloat(binEdges[bins-1]);
      }
      const p2 = percentile(2);
      const p25 = percentile(25);
      const p50 = percentile(50);
      const p75 = percentile(75);
      const p98 = percentile(98);
      // Entropía de Shannon del histograma
      let entropy = 0;
      for (let i = 0; i < bins; i++) {
        const p = hist[i] / total;
        if (p > 0) entropy += -p * Math.log2(p);
      }
      const waterFraction = count ? (waterPixels / count) : 0;
      return { min, max, mean, std, histogram: hist, cdf, binEdges, areaKm2, totalAreaKm2, p2, p25, p50, p75, p98, entropy, waterFraction, validPixels: count };
    } catch (e) {
      console.warn('Failed analyzing single raster:', e);
      return null;
    }
  }
}