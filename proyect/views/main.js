// Entry point MVC: carga parciales y arranca controladores

import { AppController } from '../controllers/controller.js';
import { RouterService } from '../models/router_service.js';
import { MapController } from '../controllers/map_controller.js';
import { ValidationController } from '../controllers/validation_controller.js';

async function mountPartial(id, url) {
  const mount = document.getElementById(id);
  if (!mount) return;
  const res = await fetch(url);
  const html = await res.text();
  mount.innerHTML = html;
}

async function boot() {
  await mountPartial('headerMount', 'views/header.html');
  await mountPartial('sidebarMount', 'views/sidebar.html');
  const router = new RouterService();
  router.start();
  const app = new AppController();
  app.init();

  // Inicializar controladores específicos según vista
  let mapCtrl = app.mapCtrl; // ya creado dentro de AppController
  window.addEventListener('view:loaded', (ev) => {
    const route = ev.detail?.route || '';
    if (route.startsWith('#/dashboard')) {
      // Rebind del mapa y métricas al DOM recién cargado
      if (mapCtrl) {
        mapCtrl.init();
      }
      // Inicializar métricas cuando el dashboard está montado
      try { app.metricsCtrl.init(); } catch {}
    } else if (route.startsWith('#/validacion')) {
      const v = new ValidationController();
      v.init();
    }
  });
}

window.addEventListener('DOMContentLoaded', boot);