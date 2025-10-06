// Controlador principal: orquesta eventos y usa servicios
import { DatasetService } from '../models/dataset_service.js';
import { MapController } from './map_controller.js';
import { MetricsController } from './metrics_controller.js';

export class AppController {
  constructor() {
    this.dataset = new DatasetService();
    this.mapCtrl = new MapController(this.dataset);
    this.metricsCtrl = new MetricsController(this.dataset);
  }

  init() {
    // Navegación
    this.on('btnHelp','click', () => {
      const modal = document.getElementById('helpModal');
      if (!modal) return;
      modal.style.display = 'block';
      modal.setAttribute('aria-hidden','false');
      // focus close for accessibility
      const closeBtn = document.getElementById('helpClose');
      try { closeBtn?.focus(); } catch {}
    });
    // Cerrar modal
    const closeModal = () => {
      const modal = document.getElementById('helpModal');
      if (!modal) return;
      modal.style.display = 'none';
      modal.setAttribute('aria-hidden','true');
    };
    this.on('helpClose','click', closeModal);
    this.on('helpOk','click', closeModal);
    // click en backdrop
    document.addEventListener('click', (ev) => {
      const target = ev.target;
      if (target && target.hasAttribute && target.hasAttribute('data-close-modal')) closeModal();
    });
    // Navegación a "Acerca" será vía router (#/acerca)

    // Dataset
    this.on('btnValidate','click', () => this.validateDataset());
    // Se removió el slider de tiempo del sidebar; mantener compatibilidad si existe en otra vista
    const timeSlider = document.getElementById('timeSlider');
    if (timeSlider) {
      timeSlider.addEventListener('input', (e) => this.onTimeChange(e));
    }

    // Capas
    this.mapCtrl.init();
  }

  on(id, evt, cb) {
    const node = document.getElementById(id);
    if (node) node.addEventListener(evt, cb);
  }

  async validateDataset() {
    const status = document.getElementById('validationStatus');
    status.className = 'status';
    status.textContent = 'Validating dataset…';
    try {
      await this.dataset.collectInputs();
      await this.dataset.validate();
      // Configurar slider si existe
      const slider = document.getElementById('timeSlider');
      if (slider) {
        slider.min = 0;
        slider.max = Math.max(0, this.dataset.dates.length - 1);
        slider.value = 0;
        const lbl = document.getElementById('timeLabel');
        if (lbl) lbl.textContent = `Date: ${this.dataset.dates[0] ?? 'n/a'}`;
        this.mapCtrl.onTimeChange(this.dataset.dates[0] ?? null);
      }
      // Cargar overlays de GeoTIFF y refit bounds en cada validación si hay rasters
      if (this.dataset.haveRasters) {
        try { this.mapCtrl.map.hasFitBounds = false; } catch {}
        await this.mapCtrl.map.loadGeoTIFFOverlays?.();
      }
      // Actualizar métricas
      this.metricsCtrl.init();
      status.className = 'status ok';
      status.textContent = this.dataset.haveRasters
        ? 'Dataset validated. Raster ready to visualize.'
        : 'Dataset validated (metadata). Upload VV/VH to visualize raster.';
    } catch (e) {
      status.className = 'status warn';
      status.textContent = e.message || 'Error during validation.';
    }
  }

  onTimeChange(e) {
    const idx = Number(e.target.value);
    const date = this.dataset.dates[idx] ?? 'n/a';
    document.getElementById('timeLabel').textContent = `Date: ${date}`;
    this.mapCtrl.onTimeChange(date);
  }
}