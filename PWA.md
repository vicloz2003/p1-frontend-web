# PWA — Progressive Web App (RNF-7)

La web de iBPMS es instalable y funciona con red intermitente gracias al **Angular Service Worker**.

## Qué se añadió

| Pieza | Archivo |
|---|---|
| Config del service worker | `ngsw-config.json` |
| Web App Manifest | `public/manifest.webmanifest` |
| Iconos (192 / 512 / maskable) | `public/icons/*.png` |
| Registro del worker | `src/app/app.config.ts` (`provideServiceWorker`) |
| `<link rel="manifest">` + `theme-color` | `src/index.html` |
| Activación en build | `angular.json` → `production.serviceWorker` |

## Estrategias de caché (`ngsw-config.json`)

- **assetGroup `app`** (`prefetch`): app-shell (`index.html`, JS, CSS, manifest) → la app **abre sin conexión**.
- **assetGroup `assets`** (`lazy`): imágenes, iconos y fuentes bajo demanda.
- **dataGroup `api-reads`** (`freshness`, timeout 5 s, `maxAge` 1d): GET de
  `processes/policies/departments` — intenta la red y, si tarda/ falla, sirve la última
  respuesta cacheada. Las **escrituras nunca se cachean** (no aparecen en `dataGroups`).

> El service worker **solo se activa en build de producción** (`enabled: !isDevMode()`).
> En `npm start` (dev) no se registra, para no interferir con el hot-reload.

## Probar la PWA

```bash
npm run build                      # genera dist/frontend_web/browser con ngsw-worker.js
npx http-server dist/frontend_web/browser -p 4200   # (cualquier server estático sirve)
```

1. Abrir <http://localhost:4200> en Chrome → DevTools ▸ **Application ▸ Service Workers**
   debe mostrar `ngsw-worker.js` activo.
2. **Application ▸ Manifest** muestra nombre, iconos e ícono *maskable* → botón **Instalar**.
3. Marcar **Offline** en DevTools y recargar: el app-shell sigue cargando y las últimas
   listas de trámites se muestran desde caché.

## Nota sobre el origen del API

`dataGroups` usa rutas relativas (`/api/v1/...`), que casan cuando el backend se sirve
en el **mismo origen** que la web (despliegue tras un reverse proxy). Si el API vive en
otro origen (p.ej. `:3000` en dev), añade el patrón absoluto del origen del API a
`dataGroups[].urls` para que la caché de frescura aplique también cross-origin.
La instalabilidad y el app-shell offline funcionan en cualquier caso.
