# GitUI Deployment Guide

## Quick Deploy to Vercel

### 1. Prerequisites
- Vercel account
- Supabase project (already configured)
- GitHub OAuth App (will be created after first deploy)

### 2. Deploy to Vercel

#### Option A: Using Vercel CLI (Recommended)
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy from project root
cd /Users/jasonczarnecki/Windsurf/GitUI
vercel --prod
```

#### Option B: Using Vercel Dashboard
1. Go to [vercel.com/new](https://vercel.com/new)
2. Import from GitHub: `https://github.com/jason-czar/GitUI`
3. Set Framework Preset: **Next.js**
4. Set Root Directory: `apps/web/client`
5. Add environment variables (see below)

### 3. Environment Variables

Add these to your Vercel project settings:

#### Required Variables
```bash
# Supabase (already have these)
NEXT_PUBLIC_SUPABASE_URL=https://kilakiqhfsfwtkjxzosc.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpbGFraXFoZnNmd3Rranh6b3NjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgzMDAzNjAsImV4cCI6MjA3Mzg3NjM2MH0.WrJehOc2Sy2sHYo9e-CSlVnx2GW27PB_erf-Ziuy5YA
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpbGFraXFoZnNmd3Rranh6b3NjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODMwMDM2MCwiZXhwIjoyMDczODc2MzYwfQ.Bvr00fkkYwPJozu-fLUlr5Zb0cC1F7k9UjrP1Q0O-Wg
SUPABASE_DATABASE_URL=postgres://postgres.kilakiqhfsfwtkjxzosc:UCsvjNpvycojAVZh@aws-1-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require&supa=base-pooler.x

# GitHub OAuth (will be set after creating OAuth App)
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
NEXT_PUBLIC_GITHUB_SCOPES=repo,read:org

# CodeSandbox (required)
CSB_API_KEY=

# AI (required for AI features)
OPENROUTER_API_KEY=
```

#### Optional Variables
```bash
# OpenAI (alternative to OpenRouter)
OPENAI_API_KEY=

# Stripe (for billing)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# Analytics
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=
```

### 4. GitHub OAuth App Setup

After your first deployment, you'll get a URL like: `https://gitui-xyz.vercel.app`

1. Go to [GitHub Developer Settings](https://github.com/settings/applications/new)
2. Create new OAuth App:
   - **Application name**: GitUI
   - **Homepage URL**: `https://your-vercel-url.vercel.app`
   - **Authorization callback URL**: `https://your-vercel-url.vercel.app/api/auth/github/callback`
3. Copy the Client ID and Client Secret
4. Add them to your Vercel environment variables
5. Redeploy

### 5. Required API Keys

#### CodeSandbox API Key
1. Go to [CodeSandbox API](https://codesandbox.io/t/api)
2. Generate an API key
3. Add as `CSB_API_KEY` in Vercel

#### OpenRouter API Key (for AI features)
1. Go to [OpenRouter](https://openrouter.ai/settings/keys)
2. Generate an API key
3. Add as `OPENROUTER_API_KEY` in Vercel

### 6. Deployment Commands

```bash
# Preview deployment
bun run deploy:preview

# Production deployment  
bun run deploy:staging

# Run post-deploy script (migrations)
bun run postdeploy
```

### 7. Health Check

After deployment, check: `https://your-vercel-url.vercel.app/api/health`

Should return:
```json
{
  "status": "healthy",
  "services": {
    "supabase": true,
    "github_oauth": true,
    "codesandbox": true,
    "ai": true
  }
}
```

## Architecture

- **Frontend**: Next.js 15 with App Router
- **Backend**: tRPC for type-safe APIs
- **Database**: Supabase PostgreSQL with Drizzle ORM
- **Auth**: Supabase Auth + GitHub OAuth
- **Sandboxes**: CodeSandbox SDK
- **Deployment**: Vercel

## Troubleshooting

### Build Errors
- Ensure all required environment variables are set
- Check that Supabase database is accessible
- Verify API keys are valid

### Database Issues
- Run migrations: `bun run db:push`
- Check connection string format
- Ensure RLS policies are configured

### OAuth Issues
- Verify callback URL matches exactly
- Check GitHub OAuth App settings
- Ensure scopes include `repo,read:org`
