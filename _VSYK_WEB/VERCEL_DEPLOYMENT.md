# Vercel Deployment Guide for _VSYK_WEB

**Goal**: Deploy the VSYK CHITS Next.js website (`_VSYK_WEB`) to Vercel **properly**, with correct configuration for a subdirectory project, environment variables, and production readiness.

This guide follows current best practices for Next.js 14 on Vercel (as of 2026).

---

## Prerequisites

- Git repository pushed to GitHub (or GitLab/Bitbucket) with the `_VSYK_WEB` folder.
  - Your current branch is `Improve` and you have a remote (`origin`).
- Vercel account (sign up free with GitHub — recommended).
- Access to your Supabase project (you already have the keys in `.env.local`).
- (Optional but recommended) A custom domain you control (e.g. vsykchits.com).

**Important notes about this project**:
- The app is a **subdirectory** of the larger workspace repo (`_VSYK_WEB/` inside the root).
- Most functionality uses **direct Supabase client** (no heavy server-side needs).
- The only external dependency in env is `NEXT_PUBLIC_SUPABASE_*` keys (the `NEXT_PUBLIC_API_URL` in `.env.local` is **not used** by any code in `_VSYK_WEB` — it's a leftover from the mobile app).
- Sessions are managed client-side with `localStorage` (member + admin logins). This works fine on Vercel.
- Features like Razorpay orders / auction scheduler live in the separate `Backend/` (you will need to deploy the Backend separately if you want those flows).

---

## Step 1: Prepare Your Code (Local)

1. Make sure everything is committed:
   ```bash
   cd /path/to/_VSYK   # the workspace root
   git status
   git add .
   git commit -m "Prepare _VSYK_WEB for Vercel deployment"
   git push origin Improve
   ```

2. **Do NOT commit** sensitive files:
   - `.env.local` must stay ignored (it should already be in root or subdir `.gitignore`).
   - Confirm:
     ```bash
     cat _VSYK_WEB/.gitignore 2>/dev/null || echo "No local gitignore — relying on root"
     ```

3. (Optional) Test a production build locally:
   ```bash
   cd _VSYK_WEB
   npm run build
   ```
   This should succeed with no errors. Vercel will run the same command.

---

## Step 2: Create Project on Vercel (Recommended Method)

1. Go to [vercel.com](https://vercel.com) and log in with GitHub.
2. Click **Add New Project** → **Import Git Repository**.
3. Select your repository (the one containing the `_VSYK` root).
4. **Important Vercel settings** (you'll see these during import or in Project Settings afterward):

   - **Framework Preset**: Next.js (Vercel detects it automatically)
   - **Root Directory**: `_VSYK_WEB`   ← **This is the most important setting**
   - **Build Command**: `npm run build` (default — leave it)
   - **Output Directory**: `.next` (default)
   - **Install Command**: `npm install` (default)

5. Click **Deploy**.

Vercel will:
- Install dependencies inside `_VSYK_WEB`
- Run the Next.js build
- Give you a `*.vercel.app` preview URL instantly.

---

## Step 3: Configure Environment Variables (Critical)

After the first deploy (or before), go to:

**Project Settings → Environment Variables**

Add these (copy values from your local `_VSYK_WEB/.env.local` — **use the real production Supabase project**):

| Name                              | Value                                      | Environment     |
|-----------------------------------|--------------------------------------------|-----------------|
| `NEXT_PUBLIC_SUPABASE_URL`        | `https://your-project.supabase.co`         | Production + Preview + Development |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`   | `sb_publishable_...` (the anon key)        | Production + Preview + Development |

- You can leave `NEXT_PUBLIC_API_URL` out (it's unused in this web codebase).
- For **Preview** deployments (PRs / other branches) use the same keys or a staging Supabase if you have one.
- Click **Save**.
- **Redeploy** the project (Vercel → Deployments → Redeploy latest).

Vercel injects these at build time for `NEXT_PUBLIC_*` vars (they become available on the client).

---

## Step 4: Post-Deployment Checks

1. Visit your new Vercel URL.
2. Test key flows:
   - Marketing pages load with animations.
   - `/login` — member login (phone lookup) and admin login.
   - Member area (`/app/*`) — uses localStorage session.
   - Admin area (`/admin/*`) — separate admin session.
   - Supabase data loads (chits, auctions, etc.).
3. Check browser console for any Supabase or build errors.
4. Open **Vercel Dashboard → Deployments** and look at the build log for the production deploy.

---

## Step 5: Production Polish (Recommended)

### Custom Domain
1. Vercel → Project → Settings → Domains.
2. Add your domain (e.g. `vsykchits.com` or `app.vsykchits.com`).
3. Follow Vercel's DNS instructions (or use Vercel nameservers for easiest).
4. Update the `metadataBase` in `app/layout.tsx` if you change the primary domain.

### Branch & Preview Deployments
- Pushing to `Improve` or any branch will trigger preview deployments automatically (great for testing).
- Main production = the default branch you selected (you can change this in Settings → Git).

### Environment Separation (Best Practice)
- **Production**: Real Supabase + real data.
- **Preview**: You can use the same keys (since RLS is currently demo-open) or create a separate Supabase project later for previews.
- Development (local): Your `.env.local`.

### Analytics & Speed
- Enable **Vercel Analytics** and **Speed Insights** in Project Settings (free).
- Next.js on Vercel is already edge-optimized.

### Optional: vercel.json (Advanced)

Create `_VSYK_WEB/vercel.json` if you ever need custom headers, rewrites, or cron (not needed yet):

```json
{
  "framework": "nextjs",
  "regions": ["iad1"],   // closest region, change if needed
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" }
      ]
    }
  ]
}
```

Commit and push — Vercel will pick it up.

---

## Important: The Backend (Separate Deployment)

The `_VSYK_WEB` site itself does **not** require the Backend for core viewing / member / admin data (everything is direct Supabase).

However:
- Features that use `/api/payments/razorpay/*`, scheduler triggers, push notifications, etc. live in `Backend/`.
- If you later want Razorpay order creation from the web, you must:
  1. Deploy the Backend to a platform that supports long-running processes + setInterval (e.g. **Render.com**, **Railway**, **Fly.io**, or a VPS).
  2. Update `NEXT_PUBLIC_API_URL` in Vercel to point at the live Backend URL.
  3. Redeploy the web.

For now, deploying just `_VSYK_WEB` gives you the full beautiful marketing site + the member/admin portals using Supabase.

---

## Troubleshooting Common Issues

| Problem                          | Fix |
|----------------------------------|-----|
| Build fails on Vercel            | Run `npm run build` locally in `_VSYK_WEB` and fix errors. Common: missing types or env vars during build. |
| "Missing env var"                | Add the `NEXT_PUBLIC_SUPABASE_*` vars in Vercel (and redeploy). |
| Login / data not loading         | Confirm the Supabase keys in Vercel match a project that has the tables (`customers`, `chit_groups`, etc.) and the demo-open RLS. |
| 404 on `/app` or admin routes    | Next.js App Router routes are handled automatically. Make sure you set the correct Root Directory. |
| localStorage sessions lost       | Expected on new deploys sometimes (normal browser behavior). Users will re-login. |
| Slow initial load                | Vercel edge + Next.js caching is fast. First visit may have cold start (subsequent are instant). |

---

## Quick Commands Reference

```bash
# From workspace root
cd _VSYK_WEB
npm run build          # Test locally
npm run lint

# Git
git add _VSYK_WEB
git commit -m "chore: prepare for Vercel"
git push origin Improve
```

After pushing, Vercel will auto-deploy if the project is connected.

---

## Summary — Proper Deployment Checklist

- [ ] Root Directory set to `_VSYK_WEB` in Vercel
- [ ] `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` added to Vercel env vars (all environments)
- [ ] Code pushed to Git
- [ ] First production deploy successful
- [ ] Test login + data loading
- [ ] (Later) Custom domain + Backend deployment if needed

You now have a production-grade Next.js site on Vercel with automatic previews, HTTPS, global CDN, and zero-config scaling.

---

**Need help with a specific step?**

Reply with:
- "I imported the repo — what do I set for Root Directory?"
- "Build failed with this error: ..."
- "I want to set up a custom domain next"
- Or paste a screenshot of your Vercel import screen.

I'll guide you through it live.

This setup is clean, follows Vercel + Next.js best practices, and keeps the marketing site + full member/admin experience live. Good luck — deploy it! 🚀