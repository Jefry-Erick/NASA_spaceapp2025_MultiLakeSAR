export class RouterService {
  constructor() {
    this.routes = {
      '#/dashboard': 'views/dashboard.html',
      '#/acerca': 'views/acerca.html',
      '#/validacion': 'views/validacion-local.html'
    };
    this.defaultRoute = '#/dashboard';
  }

  async navigate(hash) {
    const route = this.routes[hash] || this.routes[this.defaultRoute];
    const mount = document.getElementById('viewMount');
    if (!mount) return;
    const res = await fetch(route);
    mount.innerHTML = await res.text();
    // Emitir evento de vista cargada
    try {
      const ev = new CustomEvent('view:loaded', { detail: { route: hash || this.defaultRoute, path: route } });
      window.dispatchEvent(ev);
    } catch {}
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  start() {
    const onHashChange = () => this.navigate(location.hash || this.defaultRoute);
    window.addEventListener('hashchange', onHashChange);
    onHashChange();
  }
}