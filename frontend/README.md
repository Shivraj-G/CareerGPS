# CareerGPS — Goa career pathway platform

A React + Vite frontend for CareerGPS, using the supplied CareerGPS brand artwork and a Goa-first career discovery experience.

## Included production polish

- CareerGPS logo from the supplied artwork, including favicon and social-share image
- Unique route-level page titles and meta descriptions
- Canonical URLs using `https://careergpsgoa.in` as the configured production origin
- Open Graph and Twitter metadata
- Organization, WebSite, BreadcrumbList and Goa-area LocalBusiness JSON-LD
- `sitemap.xml`, `robots.txt` and `llms.txt`
- Custom 404 page
- SPA rewrites for Vercel
- Internal navigation and breadcrumbs
- Production source maps disabled
- Vite/Rollup vendor chunking for React/router and icon dependencies
- No Vite/React branding in the document title or interface

## Custom domain

The frontend is configured to use `https://careergpsgoa.in` as its production origin. A domain cannot be registered or have DNS changed from frontend source code alone. After registering the domain, attach it to the deployment provider and keep `VITE_SITE_URL=https://careergpsgoa.in` for production builds. The canonical tags, sitemap, robots file, JSON-LD and social URLs already use that origin.

Do not claim the domain is live until the DNS records and deployment-provider domain verification have completed.

## Run locally

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
npm run preview
```

## Backend integration

The API client in `src/api/client.js` follows the project's documented `/api/v1` frontend boundary. The browser should not call `/internal/v1` or the Python service directly.
