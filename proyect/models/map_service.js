export class MapService {
  constructor() {
    this.layers = {
      layerVV: false,
      layerVH: false,
      layerRGB: false,
      layerCoast: false,
      layerTotorales: false,
    };
    this.container = null;
    this.currentDate = null;
    this.dataset = null;
    this.map = null;
    this.layerGroups = {};
    this.rasterOverlays = { vv: null, vh: null, rgb: null };
    this.tileLayers = { vv: null, vh: null };
    this.loadingNode = null;
    this.hasFitBounds = false;
    this.visRange = { min: null, max: null };
    this.presetMode = 'auto';
    this.rasterBounds = null;
  }

  init(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) return;
    // Limpiar placeholder y crear contenedor de mapa
    this.container.innerHTML = '';
    const mapDiv = document.createElement('div');
    mapDiv.style.height = '100%';
    mapDiv.style.width = '100%';
    this.container.appendChild(mapDiv);

    // Indicador de carga
    const loader = document.createElement('div');
    loader.style.position = 'absolute';
    loader.style.top = '10px';
    loader.style.right = '10px';
    loader.style.background = 'rgba(0,0,0,0.6)';
    loader.style.color = '#fff';
    loader.style.padding = '6px 10px';
    loader.style.borderRadius = '6px';
    loader.style.fontSize = '12px';
    loader.style.display = 'none';
    loader.style.zIndex = '1000';
    loader.textContent = 'Loading…';
    mapDiv.style.position = 'relative';
    mapDiv.appendChild(loader);
    this.loadingNode = loader;

    const trySetup = () => {
      if (window.L) {
        this.setupLeafletMap(mapDiv);
      } else {
        // Fallback sin Leaflet + intento de carga dinámica
        const placeholder = document.createElement('div');
        placeholder.className = 'map-placeholder';
        placeholder.textContent = 'Map preparing (Leaflet/canvas unavailable).';
        this.container.appendChild(placeholder);
        this.loadScript('https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js')
          .then(() => {
            if (window.L) {
              // Quitar placeholder y configurar mapa
              try { placeholder.remove(); } catch {}
              this.setupLeafletMap(mapDiv);
            }
          })
          .catch(() => {
            console.warn('Unable to load Leaflet dynamically.');
          });
      }
    };
    trySetup();
    console.log('MapService initialized');
  }

  setupLeafletMap(mapDiv) {
    // Centro aproximado del Lago Titicaca
    this.map = L.map(mapDiv).setView([-15.9, -69.4], 9);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(this.map);
    // Capas demostrativas (no ligadas a VV/VH/RGB)
    this.layerGroups.layerCoast = L.layerGroup([ L.polyline([[-16.0,-69.6],[-15.8,-69.5],[-15.7,-69.3]], { color: '#333', weight: 2 }) ]);
    this.layerGroups.layerTotorales = L.layerGroup([ L.circle([-15.85,-69.45], { radius: 4000, color: '#8B5A2B', fillColor: '#8B5A2B', fillOpacity: 0.2 }) ]);
  }

  setDataset(datasetService) {
    this.dataset = datasetService;
    console.log('Dataset linked to map', !!datasetService);
    this.hasFitBounds = false;
    // Warning for large local .tif files
    const warnLimitMB = 250;
    const toMB = (b) => Math.round((b || 0) / (1024*1024));
    const vvSize = this.dataset?.vv?.size || 0;
    const vhSize = this.dataset?.vh?.size || 0;
    if (vvSize > warnLimitMB*1024*1024 || vhSize > warnLimitMB*1024*1024) {
      const msg = `Warning: large local GeoTIFF files (${toMB(vvSize)}MB / ${toMB(vhSize)}MB). Consider using COG URLs for better performance.`;
      const status = document.getElementById('validationStatus');
      if (status) { status.className = 'status warn'; status.textContent = msg; }
      else { try { alert(msg); } catch {} }
    }
    // Hook para controles de visualización
    const btn = document.getElementById('btnApplyVis');
    if (btn) {
      btn.addEventListener('click', () => {
        const minNode = document.getElementById('visMin');
        const maxNode = document.getElementById('visMax');
        const preset = document.getElementById('visPreset')?.value || 'auto';
        let min = parseFloat(minNode?.value);
        let max = parseFloat(maxNode?.value);
        this.presetMode = preset;
        try { window.__mapPresetMode = preset; } catch {}
        if (preset === 'db') { min = -25; max = 0; }
        if (preset === 'auto' || preset === 'p98') { min = NaN; max = NaN; }
        this.visRange.min = isNaN(min) ? null : min;
        this.visRange.max = isNaN(max) ? null : max;
        this.reloadRasters();
      });
    }
  }

  toggleLayer(id, visible) {
    this.layers[id] = visible;
    console.log('Layer', id, 'visible?', visible);
    if (this.map && this.layerGroups[id]) {
      if (visible) {
        this.layerGroups[id].addTo(this.map);
      } else {
        this.layerGroups[id].remove();
      }
    }
    // Mostrar/ocultar overlays raster cuando existan
    if (this.map) {
      if (id === 'layerVV' && this.rasterOverlays.vv) {
        if (visible) this.rasterOverlays.vv.addTo(this.map); else this.rasterOverlays.vv.remove();
      }
      if (id === 'layerVH' && this.rasterOverlays.vh) {
        if (visible) this.rasterOverlays.vh.addTo(this.map); else this.rasterOverlays.vh.remove();
      }
      if (id === 'layerRGB' && this.rasterOverlays.rgb) {
        if (visible) this.rasterOverlays.rgb.addTo(this.map); else this.rasterOverlays.rgb.remove();
      }
      // Mostrar/ocultar capas tile (georaster)
      if (id === 'layerVV' && this.tileLayers.vv) {
        if (visible) this.tileLayers.vv.addTo(this.map); else this.map.removeLayer(this.tileLayers.vv);
      }
      if (id === 'layerVH' && this.tileLayers.vh) {
        if (visible) this.tileLayers.vh.addTo(this.map); else this.map.removeLayer(this.tileLayers.vh);
      }
    }
  }

  updateDate(dateStr) {
    this.currentDate = dateStr;
    console.log('Map date updated to', dateStr);
    // TODO: refresh raster tiles for date
  }

  async loadGeoTIFFOverlays() {
    if (!this.map || !this.dataset) return;
    const vvFile = this.dataset.vv;
    const vhFile = this.dataset.vh;
    const vvUrl = this.dataset.urlVv;
    const vhUrl = this.dataset.urlVh;
    if (!vvFile && !vhFile && !vvUrl && !vhUrl) return;
    const hasTileSupport = typeof window.GeoRasterLayer === 'function' && typeof window.parseGeoraster === 'function';
    try {
      this.setLoading(true, 'Loading GeoTIFF (tiles)…');
      if (hasTileSupport) {
        // Leer como georaster para capas tile con georreferenciación real.
        // Si hay URLs, usarlas para aprovechar COG y solicitudes por rango.
        const geoVV = (vvUrl)
          ? await window.parseGeoraster(vvUrl)
          : (vvFile ? await window.parseGeoraster(await (vvFile.arrayBuffer())) : null);
        const geoVH = (vhUrl)
          ? await window.parseGeoraster(vhUrl)
          : (vhFile ? await window.parseGeoraster(await (vhFile.arrayBuffer())) : null);

        // Limpiar capas anteriores
        if (this.tileLayers.vv) this.map.removeLayer(this.tileLayers.vv);
        if (this.tileLayers.vh) this.map.removeLayer(this.tileLayers.vh);

        const makeGrayFn = (mins, maxs) => (values) => {
          const v = values && values[0];
          if (v == null || isNaN(v)) return null;
          let baseMin = (mins && mins[0] != null) ? mins[0] : v;
          let baseMax = (maxs && maxs[0] != null) ? maxs[0] : v + 1;
          let min = (this.visRange.min != null) ? this.visRange.min : baseMin;
          let max = (this.visRange.max != null) ? this.visRange.max : baseMax;
          if (this.visRange.min == null && this.visRange.max == null && this.presetMode === 'p98') {
            const range = baseMax - baseMin;
            min = baseMin + 0.02 * range;
            max = baseMax - 0.02 * range;
          }
          const rng = (max - min) || 1;
          const val = Math.max(0, Math.min(255, Math.round(((v - min) / rng) * 255)));
          return `rgba(${val},${val},${val},255)`;
        };

        this.tileLayers.vv = geoVV ? new window.GeoRasterLayer({
          georaster: geoVV,
          opacity: 0.85,
          resolution: 256,
          pixelValuesToColorFn: makeGrayFn(geoVV.mins, geoVV.maxs)
        }) : null;
        this.tileLayers.vh = geoVH ? new window.GeoRasterLayer({
          georaster: geoVH,
          opacity: 0.85,
          resolution: 256,
          pixelValuesToColorFn: makeGrayFn(geoVH.mins, geoVH.maxs)
        }) : null;

        // Añadir según toggles actuales
        if (this.layers.layerVV && this.tileLayers.vv) this.tileLayers.vv.addTo(this.map);
        if (this.layers.layerVH && this.tileLayers.vh) this.tileLayers.vh.addTo(this.map);

        // Ajustar mapa a los límites del primer raster si aún no se ajustó
        if (!this.hasFitBounds) {
          try {
            const b = this.tileLayers.vv?.getBounds?.() || this.tileLayers.vh?.getBounds?.();
            if (b) { this.map.fitBounds(b); this.hasFitBounds = true; }
          } catch {}
        }

        console.log('GeoTIFF tile layers loaded');
      } else if (window.GeoTIFF) {
        // Fallback: renderizar rásteres en canvas y usar ImageOverlay con bounds aproximados
        const vvTiff = (vvFile ? await GeoTIFF.fromBlob(vvFile) : (vvUrl ? await GeoTIFF.fromUrl(vvUrl) : null));
        const vhTiff = (vhFile ? await GeoTIFF.fromBlob(vhFile) : (vhUrl ? await GeoTIFF.fromUrl(vhUrl) : null));
        const vvImage = vvTiff ? await vvTiff.getImage() : null;
        const vhImage = vhTiff ? await vhTiff.getImage() : null;
        const vvData = vvImage ? await vvImage.readRasters() : null;
        const vhData = vhImage ? await vhImage.readRasters() : null;
        const wVV = vvImage ? vvImage.getWidth() : null;
        const hVV = vvImage ? vvImage.getHeight() : null;
        const wVH = vhImage ? vhImage.getWidth() : null;
        const hVH = vhImage ? vhImage.getHeight() : null;

        const urlVV = vvData ? this.renderCanvasFromRaster(vvData[0], wVV, hVV) : null;
        const urlVH = vhData ? this.renderCanvasFromRaster(vhData[0], wVH, hVH) : null;

        let urlRGB = null;
        if (vvData && vhData && wVV === wVH && hVV === hVH) {
          ({ urlRGB } = this.renderRGBComposite(vvData[0], vhData[0], wVV, hVV));
        }

        // Derivar bounds a partir del bbox del GeoTIFF si existe
        let bounds = null;
        try {
          const bbox = (vvImage && vvImage.getBoundingBox?.()) || (vhImage && vhImage.getBoundingBox?.());
          if (bbox && Array.isArray(bbox) && bbox.length === 4) {
            const [minX, minY, maxX, maxY] = bbox;
            bounds = L.latLngBounds([ [minY, minX], [maxY, maxX] ]);
          }
        } catch {}
        if (!bounds) {
          bounds = L.latLngBounds([[-16.2, -69.64], [-15.7, -69.12]]);
        }
        if (this.rasterOverlays.vv) this.rasterOverlays.vv.remove();
        if (this.rasterOverlays.vh) this.rasterOverlays.vh.remove();
        if (this.rasterOverlays.rgb) this.rasterOverlays.rgb.remove();
        this.rasterOverlays.vv = urlVV ? L.imageOverlay(urlVV, bounds, { opacity: 0.7 }) : null;
        this.rasterOverlays.vh = urlVH ? L.imageOverlay(urlVH, bounds, { opacity: 0.7 }) : null;
        if (urlRGB) {
          this.rasterOverlays.rgb = L.imageOverlay(urlRGB, bounds, { opacity: 0.6 });
        } else {
          this.rasterOverlays.rgb = null;
        }

        if (this.layers.layerVV && this.rasterOverlays.vv) this.rasterOverlays.vv.addTo(this.map);
        if (this.layers.layerVH && this.rasterOverlays.vh) this.rasterOverlays.vh.addTo(this.map);
        if (this.layers.layerRGB && this.rasterOverlays.rgb) this.rasterOverlays.rgb.addTo(this.map);
        console.log('GeoTIFF overlays (fallback) loaded');
        if (!this.hasFitBounds && bounds) {
          try { this.map.fitBounds(bounds); this.hasFitBounds = true; } catch {}
        }
      } else {
        console.warn('No support from georaster-layer or geotiff.js to load rasters');
      }
    } catch (e) {
      console.error('Error loading GeoTIFFs:', e);
    } finally {
      this.setLoading(false);
    }
  }

  reloadRasters() {
    // Re-crear capas con el nuevo rango de visualización
    if (!this.map || !this.dataset) return;
    // Quitar capas existentes para forzar recreación
    if (this.tileLayers.vv) { try { this.map.removeLayer(this.tileLayers.vv); } catch {} this.tileLayers.vv = null; }
    if (this.tileLayers.vh) { try { this.map.removeLayer(this.tileLayers.vh); } catch {} this.tileLayers.vh = null; }
    if (this.rasterOverlays.vv) { try { this.rasterOverlays.vv.remove(); } catch {} this.rasterOverlays.vv = null; }
    if (this.rasterOverlays.vh) { try { this.rasterOverlays.vh.remove(); } catch {} this.rasterOverlays.vh = null; }
    if (this.rasterOverlays.rgb) { try { this.rasterOverlays.rgb.remove(); } catch {} this.rasterOverlays.rgb = null; }
    this.hasFitBounds = false;
    this.loadGeoTIFFOverlays();
  }

  renderCanvasFromRaster(band, w, h) {
    // Normalizar valores a 0-255 con downsampling para evitar canvases gigantes
    const n = band.length;
    // Estimar min/max (muestreo si es muy grande)
    let min = Infinity, max = -Infinity;
    const sampleStep = Math.ceil(Math.max(1, Math.floor(n / 2000000))); // máximo ~2M lecturas
    for (let i = 0; i < n; i += sampleStep) { const v = band[i]; if (v < min) min = v; if (v > max) max = v; }
    // Aplicar rango de visualización si está definido
    if (this.visRange.min != null) min = this.visRange.min;
    if (this.visRange.max != null) max = this.visRange.max;
    // Percentil 2–98 si no hay min/max explícitos y está seleccionado
    if (this.visRange.min == null && this.visRange.max == null && this.presetMode === 'p98') {
      const baseMin = min;
      const baseMax = max;
      const baseRange = baseMax - baseMin || 1;
      min = baseMin + 0.02 * baseRange;
      max = baseMax - 0.02 * baseRange;
    }
    const rng = max - min || 1;
    // Downsample: limitar dimensión máxima
    const MAX_DIM = 2048;
    const scale = Math.min(1, MAX_DIM / Math.max(w, h));
    const newW = Math.max(1, Math.floor(w * scale));
    const newH = Math.max(1, Math.floor(h * scale));
    const canvas = document.createElement('canvas');
    canvas.width = newW;
    canvas.height = newH;
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(newW, newH);
    const xRatio = w / newW;
    const yRatio = h / newH;
    for (let y = 0; y < newH; y++) {
      const ys = Math.floor(y * yRatio);
      for (let x = 0; x < newW; x++) {
        const xs = Math.floor(x * xRatio);
        const srcIdx = ys * w + xs;
        const v = band[srcIdx];
        const val = Math.max(0, Math.min(255, Math.round(((v - min) / rng) * 255)));
        const idx = (y * newW + x) * 4;
        img.data[idx] = val;
        img.data[idx+1] = val;
        img.data[idx+2] = val;
        img.data[idx+3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return canvas.toDataURL('image/png');
  }

  renderRGBComposite(vvBand, vhBand, w, h) {
    const n = vvBand.length;
    // Downsample RGB compuesto
    let vvMin=Infinity,vvMax=-Infinity,vhMin=Infinity,vhMax=-Infinity;
    const sampleStep = Math.ceil(Math.max(1, Math.floor(n / 2000000)));
    for (let i=0;i<n;i+=sampleStep){const a=vvBand[i];const b=vhBand[i];if(a<vvMin)vvMin=a; if(a>vvMax)vvMax=a; if(b<vhMin)vhMin=b; if(b>vhMax)vhMax=b; }
    const vvRng = vvMax - vvMin || 1;
    const vhRng = vhMax - vhMin || 1;
    const MAX_DIM = 2048;
    const scale = Math.min(1, MAX_DIM / Math.max(w, h));
    const newW = Math.max(1, Math.floor(w * scale));
    const newH = Math.max(1, Math.floor(h * scale));
    const canvas = document.createElement('canvas');
    canvas.width = newW;
    canvas.height = newH;
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(newW, newH);
    const xRatio = w / newW;
    const yRatio = h / newH;
    for (let y=0;y<newH;y++){
      const ys = Math.floor(y * yRatio);
      for (let x=0;x<newW;x++){
        const xs = Math.floor(x * xRatio);
        const src = ys * w + xs;
        const r = Math.round(((vvBand[src]-vvMin)/vvRng)*255);
        const g = Math.round(((vhBand[src]-vhMin)/vhRng)*255);
        const b = Math.round(((vvBand[src]+vhBand[src]-vvMin-vhMin)/(vvRng+vhRng))*255);
        const idx=(y*newW+x)*4;
        img.data[idx]=r; img.data[idx+1]=g; img.data[idx+2]=b; img.data[idx+3]=255;
      }
    }
    ctx.putImageData(img,0,0);
    return { urlRGB: canvas.toDataURL('image/png') };
  }

  setLoading(on, msg) {
    if (!this.loadingNode) return;
    if (msg) this.loadingNode.textContent = msg;
    this.loadingNode.style.display = on ? 'block' : 'none';
  }

  loadScript(url) {
    return new Promise((resolve, reject) => {
      try {
        const s = document.createElement('script');
        s.src = url;
        s.onload = () => resolve();
        s.onerror = (e) => reject(e);
        document.head.appendChild(s);
      } catch (e) {
        reject(e);
      }
    });
  }

  async fetchArrayBuffer(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to read GeoTIFF from URL: ${url}`);
    return await res.arrayBuffer();
  }
}