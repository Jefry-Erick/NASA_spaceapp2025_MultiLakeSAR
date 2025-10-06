import { MapService } from '../models/map_service.js';

export class MapController {
  constructor(datasetService) {
    this.map = new MapService();
    this.dataset = datasetService;
  }

  init() {
    this.map.init('mapCanvas');
    this.map.setDataset(this.dataset);
    // Intentar cargar overlays de GeoTIFF si ya hay archivos seleccionados
    this.map.loadGeoTIFFOverlays?.();
    ['layerVV','layerVH','layerRGB','layerCoast','layerTotorales'].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      this.map.toggleLayer(id, el.checked);
      el.addEventListener('change', () => this.map.toggleLayer(id, el.checked));
    });
  }

  onTimeChange(dateStr) {
    this.map.updateDate(dateStr);
  }
}