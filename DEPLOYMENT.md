# Deployment Guide

## 1. Create PostgreSQL database

Recommended quick setup: Supabase, Render PostgreSQL, Railway PostgreSQL, or Neon.

Set one of these env styles:

```bash
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE
DB_SSL=true
```

Or:

```bash
DB_HOST=...
DB_PORT=5432
DB_DATABASE=...
DB_USER=...
DB_PASSWORD=...
DB_SSL=true
```

Initialize tables:

```bash
npm run db:init:pg
npm run db:verify:pg
```

## 2. Required production env

```bash
NODE_ENV=production
HOST=0.0.0.0
PORT=3000
JWT_SECRET=replace-with-a-long-random-secret
DATABASE_URL=postgresql://...
DB_SSL=true
AI_BASE_URL=http://localhost:20128/v1
AI_API_KEY=...
AI_MODEL=ag/gemini-3.8-flash
YOUTUBE_API_KEY=...
```

Firebase also needs `src/firebaseServiceAccountKey.json` or a production-safe Firebase credential loading flow before deploy.

## 3. Render deploy

1. Push repo to GitHub.
2. Create a new Render Web Service.
3. Build command: `npm ci`
4. Start command: `npm start`
5. Add env vars from section 2.
6. Open `/health` after deploy.

This repo includes `render.yaml` for Render Blueprint deploy.

## 4. Railway deploy

1. Create a Railway project.
2. Add PostgreSQL plugin.
3. Deploy from GitHub.
4. Set `DATABASE_URL`, `DB_SSL=true`, `JWT_SECRET`, API keys, and Firebase credential.
5. Run once in Railway shell:

```bash
npm run db:init:pg
npm run db:verify:pg
```

## 5. Docker deploy

```bash
docker build -t online-learning-api .
docker run -p 3000:3000 --env-file .env online-learning-api
```

## 6. Docker Compose local full stack

This starts PostgreSQL and the API together. The API initializes the schema before booting.

```bash
docker compose up --build
```

Open:

```text
http://localhost:3000/health
```

Stop:

```bash
docker compose down
```

## Notes

- Uploaded files under `src/public/uploads` are local disk files. On Render/Railway free web services, disk can be ephemeral. For production, move uploads to S3, Cloudinary, Supabase Storage, or Firebase Storage.
- Rotate any API keys that were ever committed or shared.
