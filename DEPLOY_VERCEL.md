# Vercel Deployment

Deploy this Node/Express API to Vercel in 5 minutes.

## Prerequisites
- Vercel account (https://vercel.com)
- Vercel CLI: `npm i -g vercel`

## Steps

### 1. Install Vercel CLI (if not already)
```bash
npm install -g vercel
```

### 2. Login
```bash
vercel login
```

### 3. Deploy (from project root)
```bash
vercel
```

Follow prompts:
- Set up and deploy? **Y**
- Which scope? *(your account)*
- Link to existing project? **N** (first time)
- Project name? `online-learning-api`
- In which directory is your code located? `./` (just press enter)
- Want to modify these settings? **N**

### 4. Add Environment Variables
```bash
vercel env add SUPABASE_URL production
vercel env add SUPABASE_SERVICE_KEY production
vercel env add SUPABASE_ANON_KEY production
vercel env add OLLAMA_URL production
vercel env add OLLAMA_MODEL production
vercel env add OLLAMA_KEY production
```

Or use the dashboard: https://vercel.com/dashboard → your project → Settings → Environment Variables

### 5. Deploy to Production
```bash
vercel --prod
```

## Verify
- `https://your-app.vercel.app/api-docs/` → Swagger UI
- `https://your-app.vercel.app/api/courses` → API endpoint

## Notes
- Vercel uses **serverless functions**, so each cold start takes ~1s
- Free tier: 100GB bandwidth, 100GB-hrs serverless execution
- File uploads (multer) work but files go to `/tmp` (ephemeral) — for production, switch to **Supabase Storage**
