# X Auto-Scheduling Setup Guide

This guide walks you through all four steps to go live with automatic tweet posting.
Complete them in order — each step produces credentials the next step needs.

**Time to complete:** ~20 minutes

---

## Prerequisites

- Your app is pushed to a GitHub repository
- You have a Vercel account (free at vercel.com)
- You have an X (Twitter) account to post from

---

## Step 1 — X Developer Portal: Create your app

This step gets you the **Client ID** and **Client Secret** your server uses to exchange OAuth tokens with X.

### 1.1 Apply for developer access

1. Go to [developer.twitter.com](https://developer.twitter.com) and sign in with the X account you want to post from.
2. Click **"Sign up for Free Account"** (or **"Developer Portal"** if you already have access).
3. On the sign-up form:
   - **Use case:** select *"Making a bot"* or *"Build tools for personal use / hobbyist project"*
   - **Description:** write 2–3 sentences, e.g. *"I'm building a personal tweet scheduling tool that generates and posts content via the X API."*
   - Accept the developer agreement and click **Submit**.
4. Check your email — X may send a verification request within a few minutes. Approve it.

> **Already have developer access?** Skip to 1.2.

---

### 1.2 Create a project and app

1. In the Developer Portal, click **"+ Create Project"** in the left sidebar.
2. Fill in the project form:
   - **Project name:** `tweet-command-center` (or anything you like)
   - **Use case:** *Making a bot* → *My own use*
   - **Description:** *Personal tweet scheduling tool*
3. Click **Next** until you reach the **"Create your App"** screen.
4. Give the app a name, e.g. `tweet-scheduler` → click **Next**.
5. X displays your **API Key** and **API Key Secret** — **ignore these**, they are for OAuth 1.0a which you won't use. Click **App Settings** or **Done**.

---

### 1.3 Enable OAuth 2.0

1. Inside your app, open the **"Settings"** tab.
2. Scroll to **"User authentication settings"** → click **"Set up"**.
3. Configure the form:

   | Field | Value |
   |-------|-------|
   | **App permissions** | Read and Write |
   | **Type of App** | Web App, Automated App or Bot |
   | **Callback URI / Redirect URL** | See below |
   | **Website URL** | Your Vercel deployment URL (e.g. `https://tweet-command-center.vercel.app`) — required but not used functionally |

4. **Callback URI** — add **both** of these (one for production, one for local dev):
   ```
   https://your-app.vercel.app/api/auth/x/callback
   http://localhost:3001/api/auth/x/callback
   ```
   Replace `your-app.vercel.app` with your actual Vercel URL. You can find it after deploying in Step 4 — come back and add it then.

5. Click **Save**.

---

### 1.4 Get your Client ID and Client Secret

1. On your app page, open the **"Keys and tokens"** tab.
2. Under **"OAuth 2.0 Client ID and Client Secret"**, click **"Regenerate"**.
3. X shows you a modal with:
   - **Client ID** — safe to store anywhere, used in the OAuth URL
   - **Client Secret** — treat like a password, server-side only

4. Copy both values and store them temporarily (a text editor is fine). You'll paste them into Vercel in Step 3.

> **Important:** X shows the Client Secret **once**. If you close the modal without copying it, click Regenerate again to get a new one.

---

### 1.5 Verify scopes

1. Still on **"Keys and tokens"**, confirm the **OAuth 2.0 scopes** section shows:
   - `tweet.write`
   - `users.read`
   - `offline.access`

   If any are missing, go back to **Settings → User authentication settings** and re-save. The scopes are derived from the permissions you set there.

---

## Step 2 — Vercel KV: Create the database

The KV store holds OAuth tokens and the tweet queue. Vercel KV is built on Upstash Redis and is free up to 256 MB.

### 2.1 Open the Vercel Storage dashboard

1. Go to [vercel.com](https://vercel.com) and sign in.
2. Select your **team** (or personal account) from the top-left dropdown.
3. Click **"Storage"** in the left navigation.

---

### 2.2 Create a KV store

1. Click **"Create Database"**.
2. Select **"KV"** from the list of storage types → click **"Continue"**.
3. Fill in the creation form:
   - **Name:** `tweet-scheduler-kv` (lowercase, hyphens only)
   - **Region:** choose the region closest to your users (e.g. `iad1` for US East, `cdg1` for Europe)
   - **Plan:** Free
4. Click **"Create"**.

---

### 2.3 Connect the KV store to your project

1. After creation, Vercel shows a **"Connect to Project"** prompt.
2. Select your `tweet-command-center` project from the dropdown.
3. Choose which environments to connect:
   - ✅ **Production**
   - ✅ **Preview**
   - ✅ **Development** (allows local use via `vercel env pull`)
4. Click **"Connect"**.

---

### 2.4 Copy the KV credentials

1. Click into the KV store you just created → open the **".env.local"** tab.
2. You'll see something like:

   ```
   KV_URL=redis://...
   KV_REST_API_URL=https://...upstash.io
   KV_REST_API_TOKEN=AXxx...
   KV_REST_API_READ_ONLY_TOKEN=AXxx...
   ```

3. Copy **`KV_REST_API_URL`** and **`KV_REST_API_TOKEN`** — you need these in Step 3.

> **Alternative:** Run `vercel env pull .env.local` in your project directory to pull all environment variables including KV credentials automatically. Requires the [Vercel CLI](https://vercel.com/docs/cli) (`npm i -g vercel`).

---

## Step 3 — Vercel: Add all environment variables

All secrets live in Vercel's encrypted environment variable store. The app reads them at runtime — nothing is committed to the repository.

### 3.1 Open your project's environment variable settings

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard).
2. Click on your `tweet-command-center` project.
3. Open the **"Settings"** tab → click **"Environment Variables"** in the left sidebar.

---

### 3.2 Add each variable

For each row below, click **"Add New"**, enter the **Name** and **Value**, select all three environments (Production, Preview, Development), then click **"Save"**.

#### Anthropic (already required for generation)

| Name | Value | Notes |
|------|-------|-------|
| `ANTHROPIC_API_KEY` | `sk-ant-...` | From console.anthropic.com |
| `API_TOKEN` | *(random hex)* | Same value as `VITE_API_TOKEN` |
| `VITE_API_TOKEN` | *(random hex)* | Must match `API_TOKEN` exactly |
| `ALLOWED_ORIGIN` | `https://your-app.vercel.app` | Your Vercel deployment URL |

Generate a random token for `API_TOKEN` / `VITE_API_TOKEN`:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

#### X OAuth

| Name | Value | Notes |
|------|-------|-------|
| `X_CLIENT_ID` | *(from Step 1.4)* | Safe to expose — used in auth URL |
| `X_CLIENT_SECRET` | *(from Step 1.4)* | Secret — server-side only |
| `X_CALLBACK_URL` | `https://your-app.vercel.app/api/auth/x/callback` | Must match exactly what you entered in the X portal |

---

#### Vercel KV

| Name | Value | Notes |
|------|-------|-------|
| `KV_REST_API_URL` | *(from Step 2.4)* | The Upstash REST URL |
| `KV_REST_API_TOKEN` | *(from Step 2.4)* | The Upstash REST token |

> If you used **"Connect to Project"** in Step 2.3, Vercel may have already added these automatically. Check if they're already present before adding them again.

---

#### Cron security

| Name | Value | Notes |
|------|-------|-------|
| `CRON_SECRET` | *(random hex)* | Vercel sends this header on cron calls |

Generate:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

### 3.3 Verify the variable list

After adding all variables, your environment variables panel should contain at minimum:

```
ANTHROPIC_API_KEY
API_TOKEN
VITE_API_TOKEN
ALLOWED_ORIGIN
X_CLIENT_ID
X_CLIENT_SECRET
X_CALLBACK_URL
KV_REST_API_URL
KV_REST_API_TOKEN
CRON_SECRET
```

---

## Step 4 — Deploy

### 4.1 Import the repository into Vercel (first-time only)

If you haven't deployed yet:

1. Go to [vercel.com/new](https://vercel.com/new).
2. Click **"Import Git Repository"** and select your `tweet-command-center` repo.
3. Vercel auto-detects the framework as **Vite**.
4. Leave the build settings at their defaults:
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
5. Click **"Deploy"**.

Vercel runs the build and gives you a deployment URL like `https://tweet-command-center-abc123.vercel.app`.

---

### 4.2 Add the production callback URL to X

Now that you have your Vercel URL:

1. Go back to the [X Developer Portal](https://developer.twitter.com/en/portal/dashboard).
2. Open your app → **Settings** → **User authentication settings** → **Edit**.
3. Under **Callback URI / Redirect URL**, confirm the production URL is present:
   ```
   https://tweet-command-center-abc123.vercel.app/api/auth/x/callback
   ```
   (Replace with your actual URL.)
4. Click **Save**.
5. Back in Vercel, update `X_CALLBACK_URL` and `ALLOWED_ORIGIN` to match your production URL if you used a placeholder earlier.

---

### 4.3 Redeploy to pick up the updated env vars

Any time you change environment variables in Vercel, you need a new deployment for them to take effect.

1. In Vercel → your project → **"Deployments"** tab.
2. Click the **"⋯"** menu on the latest deployment → **"Redeploy"**.
3. Wait for the build to complete (~1 minute).

---

### 4.4 Verify the cron job is registered

1. In Vercel → your project → **"Settings"** → **"Crons"**.
2. You should see one entry:

   | Path | Schedule | Description |
   |------|----------|-------------|
   | `/api/cron/post-tweets` | `0 * * * *` | Runs at the top of every hour |

3. Click **"Run"** to trigger it manually once and confirm it returns `{ "posted": 0, "errors": 0 }` in the response.

> **Hobby plan note:** The `0 * * * *` schedule (hourly) is the highest frequency available on the free Hobby plan. Tweets scheduled for e.g. 12:15 PM will post at the 1:00 PM cron run at the latest — a maximum of 59 minutes late. For minute-level precision, upgrade to Pro and change the schedule in `vercel.json` to `* * * * *`.

---

### 4.5 Test the full flow

1. Open your deployed app.
2. Generate and approve some tweets.
3. Click **"Schedule Review"** → you should see the **"Connect X"** banner.
4. Click **"Connect X"** → you're redirected to X to authorise the app.
5. After authorising, you land back on the app with the banner replaced by **"Connected to X ●"**.
6. Click **"Schedule to X"** → the button changes to **"Scheduled!"** and the confirmation banner appears.
7. In Vercel → **Crons** → click **"Run"** to trigger the cron immediately.
8. Tweets whose `scheduledAt` is in the past will be posted. Each tweet card shows **"Posted ✓"** after the next status refresh.

---

## Local development with X OAuth

To test the OAuth flow locally (optional):

1. Copy `.env.example` to `.env` and fill in all values.
2. Set `X_CALLBACK_URL=http://localhost:3001/api/auth/x/callback` in `.env`.
3. Confirm `http://localhost:3001/api/auth/x/callback` is listed in your X app's callback URLs (you added it in Step 1.3).
4. Start the proxy: `node server.js`
5. Start the frontend: `npm run dev`
6. Navigate to `http://localhost:5173` → Schedule Review → Connect X.

The local server uses an **in-memory KV store** when `KV_REST_API_URL` is not set, so tokens and queues persist only for the life of the Node.js process. To use the real Vercel KV locally, run `vercel env pull .env.local` (requires Vercel CLI) and source that file before starting the server.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| "X OAuth not configured" on Connect X | `X_CLIENT_ID` not set | Add env var in Vercel and redeploy |
| Redirect to `/?xError=invalid_state` | PKCE state expired (>5 min) or cookie blocked | Try again; ensure browser allows cookies from your domain |
| Redirect to `/?xError=…` with an X error message | Callback URL mismatch | Make sure `X_CALLBACK_URL` exactly matches the URL registered in the X portal |
| "X session expired — reconnect" | KV not connected or tokens TTL expired | Re-connect X; check `KV_REST_API_URL` is set |
| Cron runs but posts nothing | Tweets' `scheduledAt` is in the future | Wait for the scheduled time, or test with past-dated tweets |
| Cron returns `errors: N` | Invalid/expired access token | Disconnect and reconnect X to get a fresh token |
| Tweets post but X returns 403 | App permissions not set to Read+Write | Update permissions in X portal → User authentication settings |
| Tweets post but X returns 401 | `offline.access` scope missing | Re-authorise the app after adding the scope in X portal |
