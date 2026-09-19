# Clonify

Photograph a space. Get a walkable, AR-ready 3D environment with floor plans, room-to-room navigation, and role-specific reports for staging, disaster assessment, accessibility audits, and MEP retrofits.

## Stack

- Next.js 16 (App Router) + React 19 + Tailwind 4
- SQLite via Prisma (swap `DATABASE_URL` for Postgres in production)
- Session cookies (httpOnly)
- MinIO (S3) for photos, Valkey/Redis + BullMQ for reconstruction jobs
- Stripe Checkout for Pro / Enterprise
- OpenStreetMap / Nominatim / Wikimedia for public-building context
- TRELLIS (Hugging Face Space) for photo-to-3D when available; procedural GLB fallback otherwise

## Local setup

```bash
cp .env.example .env
npm install
npx prisma migrate deploy
npx prisma generate
docker compose up -d   # MinIO + Valkey (optional)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

1. Create an account
2. Pick a role and units
3. Start a scan with an address (and optional photos / 360° panorama)
4. Wait on the processing screen, then open the viewer

Starter includes **one active scan** and **four rooms**. Delete a scan or upgrade to add more.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint |

## Production notes

- Set `NEXT_PUBLIC_APP_URL` to the public HTTPS origin.
- Set `secure` session cookies via `NODE_ENV=production`.
- Configure real `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`, and point Stripe webhooks at `/api/webhooks/stripe`.
- Use a persistent `DATABASE_URL` and object storage (`S3_*`) instead of local Docker volumes.
- `GET /api/health` is a liveness check for the database.
