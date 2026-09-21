# Clonify

Photograph a space. Get a walkable, AR-ready 3D environment with floor plans, room-to-room navigation, and role-specific reports for staging, disaster assessment, accessibility audits, and MEP retrofits.

## Stack

- Next.js 16 (App Router) + React 19 + Tailwind 4
- SQLite via Prisma (swap `DATABASE_URL` for Postgres in production)
- Session cookies (httpOnly)
- MinIO (S3) for photos, Valkey/Redis + BullMQ for reconstruction jobs
- Stripe Checkout for Pro / Enterprise
- OpenStreetMap / Nominatim / Wikimedia for public-building context
- MapAnything (local Python/PyTorch bridge) for metric multi-view geometry, camera poses, scale, confidence, and the renderable point-cloud GLB
- Upstream `Noahabebe/clonify` floorplan vectorization and ROS2 robotics foundations under `server/floorplan/` and `robot/`

## Local setup

```bash
cp .env.example .env
npm install
npx prisma migrate deploy
npx prisma generate
docker compose up -d   # MinIO + Valkey (optional)
npm run dev
```

### Optional local MapAnything inference

Clonify runs the open-source MapAnything model locally and converts its bounded
metric point cloud directly to a GLB. No hosted photo-to-3D service is used.

```bash
git clone https://github.com/facebookresearch/map-anything.git
cd map-anything
conda create -n mapanything python=3.12 -y
conda activate mapanything
pip install -e .
pip install -r /path/to/clonify/services/mapanything/requirements.txt
```

The Next.js app starts this service automatically during Node startup; you do
not need to run a second server command. Set
`MAP_ANYTHING_PYTHON` if MapAnything is installed in a virtualenv/conda
environment, then restart Clonify. Conservative local defaults send four views per reconstruction, use
one inference minibatch, cap CPU inference at two threads, and warm the model
before the first scan arrives. Tune `MAP_ANYTHING_MAX_VIEWS` or
`MAP_ANYTHING_CPU_THREADS` only when your machine has headroom. CPU inference
may take several minutes locally; `MAP_ANYTHING_TIMEOUT_MS` defaults to 15
minutes. MapAnything
must be available to the app-managed worker for reconstruction; failures are
surfaced instead of replaced with a generic room.

Blueprint retrieval first searches the named place, then falls back to public
building-type searches such as `school floor plan`, `museum elevation`, and
`civic architectural drawing`. Retrieved candidates are fetched and checked
with OpenCV before a scan can proceed. If `LOCAL_MODEL_URL` is set for the
local Ollama-compatible guidance model, it also reranks blueprint titles; the
retrieval path remains fully functional without that model.

Open [http://localhost:3000](http://localhost:3000).

1. Create an account
2. Pick a role and units
3. Start a scan with an address (and optional photos / 360° panorama)
4. Wait on the processing screen, then open the viewer

Starter includes **one active scan** and **four rooms**. Delete a scan or upgrade to add more.

## Three product phases

1. **Indoor Navigation** provides accessible, multi-floor routes and live guidance.
2. **Indoor Showcase + Renovation** turns captures into a virtual home/property
   tour and a builder workflow for progress, issues, measurements, and plans.
3. **Clonify Robotics** is confidential and admin-gated. The upstream floorplan
   compiler and ROS2 fleet foundations are included under `server/floorplan/`
   and `robot/`. Only `mail@clonify.ca` can reveal the product in `/admin`; it
   must remain disabled until IP/patent approval.

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
