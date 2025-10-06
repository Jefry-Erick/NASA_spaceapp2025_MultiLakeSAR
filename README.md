NASA_SAR Web App

Overview
- Static web application to visualize SAR-derived metrics and maps.
- Built with plain HTML/CSS/JS and Leaflet; routes via hash.

Folder Structure
- `proyect/` contains the site (index.html, views, controllers, models).
- `DATOS_SAR/` holds example data; not required for publishing.

Publish to GitHub Pages
1) Create GitHub repo and push code
   - `git init`
   - `git add .`
   - `git commit -m "Initial commit"`
   - `git branch -M main`
   - `git remote add origin https://github.com/<user>/<repo>.git`
   - `git push -u origin main`
2) Pages via GitHub Actions
   - The workflow `.github/workflows/deploy-pages.yml` publishes `proyect/` to Pages on each push to `main`.
   - In repo Settings → Pages, ensure Source is set to `GitHub Actions`.
3) Access your site
   - After workflow completes, your app is available at:
     `https://<user>.github.io/<repo>/`

Local Preview
- Run `powershell -ExecutionPolicy Bypass -File proyect/views/serve.ps1 -Port 8080 -Root proyect` and open `http://localhost:8080/`.

Notes
- `.nojekyll` is included to serve nested assets correctly.
- Routes use hashes (`#/dashboard`, `#/acerca`, `#/validacion`), so Pages works without extra config.
- If you add heavy data, prefer separate storage or on-demand upload by users.