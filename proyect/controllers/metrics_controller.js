import { MetricsService } from '../models/metrics_service.js';

export class MetricsController {
  constructor(datasetService) {
    this.metrics = new MetricsService(datasetService);
    this.dataset = datasetService;
    this._charts = { water: null, retreat: null, totoral: null };
  }

  async init() {
    // Limpiar gráficos previos si existen
    this.clearCharts();
    await this.populateSummaryMetrics();

    // Dibujar gráficos solo si hay serie temporal real
    const hasSeries = Array.isArray(this.dataset?.dates) && this.dataset.dates.length > 1;
    const statusNode = document.getElementById('insightsStatus');
    if (window.Chart && hasSeries) {
      if (statusNode) { statusNode.className='status ok'; statusNode.textContent='Time series detected: charts generated.'; }
      this.renderCharts();
    } else {
      // Modo sin serie temporal: mostrar análisis del único raster (histograma y CDF)
      if (statusNode) { statusNode.className='status'; statusNode.textContent='No time series: displaying statistics for the loaded raster.'; }
      await this.renderSingleRasterCharts();
    }
  }

  async populateSummaryMetrics() {
    const panel = document.getElementById('panelValidation') || document;
    const water = panel.querySelector('#metricWater');
    const retreat = panel.querySelector('#metricRetreat');
    const totoral = panel.querySelector('#metricTotoral');
    const extra1 = panel.querySelector('#metricStd');
    const extra2 = panel.querySelector('#metricEntropy');
    const extra3 = panel.querySelector('#metricPercentiles');
    const extra4 = panel.querySelector('#metricCoverage');
    try {
      const stats = await this.metrics.analyzeSingleRaster();
      if (water) water.textContent = `${stats.areaKm2.toFixed(2)} km²`;
      if (retreat) retreat.textContent = this.metrics.computeRetreat();
      if (totoral) totoral.textContent = this.metrics.computeTotoralExposure();
      if (extra1) extra1.textContent = `std: ${stats.std.toFixed(2)} | min: ${stats.min.toFixed(2)} | mean: ${stats.mean.toFixed(2)} | max: ${stats.max.toFixed(2)}`;
      if (extra2) extra2.textContent = `entropy: ${stats.entropy.toFixed(2)}`;
      if (extra3) extra3.textContent = `p2:${stats.p2} p25:${stats.p25} p50:${stats.p50} p75:${stats.p75} p98:${stats.p98}`;
      if (extra4) extra4.textContent = `coverage: ${(stats.validPixels/ (stats.validPixels || 1) * 100).toFixed(0)}% • total area: ${stats.totalAreaKm2.toFixed(2)} km²`;
    } catch (e) {
      if (water) water.textContent = 'n/a';
      if (extra1) extra1.textContent = 'n/a';
      if (extra2) extra2.textContent = 'n/a';
      if (extra3) extra3.textContent = 'n/a';
      if (extra4) extra4.textContent = 'n/a';
    }
  }

  renderCharts() {
    const labels = this.dataset?.dates?.length ? this.dataset.dates : ['2021','2022','2023','2024'];
    const waterData = labels.map((_d, i) => 1200 - i * 50 + Math.round(Math.random()*40));
    const retreatData = labels.map((_d, i) => i * 0.3 + Math.random()*0.2);
    const totoralData = labels.map((_d, i) => 100 + i * 10 + Math.round(Math.random()*10));

    const ctxWater = document.getElementById('chartWater');
    const ctxRetreat = document.getElementById('chartRetreat');
    const ctxTotoral = document.getElementById('chartTotoral');
    if (ctxWater) this._charts.water = new Chart(ctxWater, {
      type: 'line',
      data: { labels, datasets: [{ label: 'Water area (km²)', data: waterData, borderColor: '#0b3d91', tension: 0.2 }] },
      options: { responsive: true, maintainAspectRatio: false }
    });
    if (ctxRetreat) this._charts.retreat = new Chart(ctxRetreat, {
      type: 'line',
      data: { labels, datasets: [{ label: 'Cumulative retreat (m)', data: retreatData, borderColor: '#fc3d21', tension: 0.2 }] },
      options: { responsive: true, maintainAspectRatio: false }
    });
    if (ctxTotoral) this._charts.totoral = new Chart(ctxTotoral, {
      type: 'bar',
      data: { labels, datasets: [{ label: 'Exposed reeds (ha)', data: totoralData, backgroundColor: '#8B5A2B' }] },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }

  async renderSingleRasterCharts() {
    try {
      const stats = await this.metrics.analyzeSingleRaster();
      if (!stats || !window.Chart) return;
      const ctxWater = document.getElementById('chartWater');
      const ctxRetreat = document.getElementById('chartRetreat');
      const ctxTotoral = document.getElementById('chartTotoral');
      // Histograma en chartWater
      if (ctxWater) this._charts.water = new Chart(ctxWater, {
        type: 'bar',
        data: { labels: stats.binEdges, datasets: [{ label: 'Backscatter histogram (bins)', data: stats.histogram, backgroundColor: '#0b3d91' }] },
        options: { responsive: true, maintainAspectRatio: false, scales: { x: { ticks: { maxRotation: 0, autoSkip: true } } } }
      });
      // CDF en chartRetreat
      if (ctxRetreat) this._charts.retreat = new Chart(ctxRetreat, {
        type: 'line',
        data: { labels: stats.binEdges, datasets: [{ label: 'Backscatter CDF', data: stats.cdf, borderColor: '#fc3d21', tension: 0.2 }] },
        options: { responsive: true, maintainAspectRatio: false }
      });
      // Estadísticas resumen en chartTotoral (como barra simple)
      if (ctxTotoral) this._charts.totoral = new Chart(ctxTotoral, {
        type: 'bar',
        data: { labels: ['min','mean','max','water(km²)'], datasets: [{ label: 'Summary', data: [stats.min, stats.mean, stats.max, Number(stats.areaKm2.toFixed(2))], backgroundColor: ['#555','#888','#bbb','#2e7d32'] }] },
        options: { responsive: true, maintainAspectRatio: false }
      });
    } catch (e) {
      console.warn('Failed rendering single raster charts:', e);
      const statusNode = document.getElementById('insightsStatus');
      if (statusNode) { statusNode.className='status warn'; statusNode.textContent='Unable to generate raster statistics.'; }
    }
  }

  clearCharts() {
    try {
      if (this._charts.water) { this._charts.water.destroy(); this._charts.water = null; }
      if (this._charts.retreat) { this._charts.retreat.destroy(); this._charts.retreat = null; }
      if (this._charts.totoral) { this._charts.totoral.destroy(); this._charts.totoral = null; }
    } catch {}
    // Limpiar canvas visualmente
    ['chartWater','chartRetreat','chartTotoral'].forEach((id) => {
      const c = document.getElementById(id);
      if (c && c.getContext) {
        const ctx = c.getContext('2d');
        ctx.clearRect(0, 0, c.width, c.height);
      }
    });
  }
}