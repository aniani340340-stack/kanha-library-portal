# Deploy Kanha Library Portal Online (Free)

Host the app on [Render](https://render.com) so the admin can open it from any phone or computer with internet.

## What you need

1. A free [Render](https://render.com) account  
2. A [GitHub](https://github.com) account (to upload this project)

## Step 1 — Push code to GitHub

1. Create a new repository on GitHub.  
2. In this project folder, run:

```bash
git init
git add .
git commit -m "Kanha Library Portal with admin login"
git branch -M main
git remote add origin YOUR_GITHUB_REPO_URL
git push -u origin main
```

## Step 2 — Deploy on Render

1. Log in to [dashboard.render.com](https://dashboard.render.com).  
2. Click **New +** → **Blueprint** (or **Web Service** if you prefer manual setup).  
3. Connect your GitHub repo.  
4. Render will read `render.yaml` and create the web service with a **persistent disk** for the database and photos.

## Step 3 — Set admin login (important)

In Render → your service → **Environment**:

| Variable | Example | Notes |
|----------|---------|--------|
| `ADMIN_EMAIL` | `you@gmail.com` | Email you use to sign in |
| `ADMIN_PASSWORD` | `MySecurePass123!` | Strong password only you know |
| `SESSION_SECRET` | long random string | e.g. 32+ random characters |
| `ADMIN_WHATSAPP` | `919828130420` | Your number (India: 91 + 10 digits) |
| `CALLMEBOT_API_KEY` | from CallMeBot | Enables automatic WhatsApp when a package ends |

Click **Save Changes**. Render will redeploy automatically.

## WhatsApp alerts when a package ends (free)

When any student’s subscription **ends**, the server sends a WhatsApp message to **9828130420** automatically.

### One-time setup (CallMeBot — free)

1. Add **+34 644 71 39 56** to your phone contacts (name: CallMeBot).  
2. On WhatsApp, send this exact message to that contact:  
   `I allow callmebot to send me messages`  
3. Wait for the reply with your **API key**.  
4. In Render → **Environment**, set `CALLMEBOT_API_KEY` to that key.  
5. Redeploy. Use **Settings → Run expiry check now** to test.

Alerts are checked every 4 hours and when the server starts. Each student is notified once per expiry date (no spam).

## Step 4 — Use from anywhere

After deploy finishes, open your app URL (e.g. `https://kanha-library-portal.onrender.com`).

- Sign in with **ADMIN_EMAIL** and **ADMIN_PASSWORD**.  
- Register students, manage seats, renew subscriptions — same as on your PC.

## Local development

```bash
npm install
npm run dev
```

Open http://localhost:3000

Default local login (only if env vars are not set):

- Email: `admin@kanhalibrary.com`  
- Password: `KanhaAdmin@2024`

Change these in a `.env` file (copy from `.env.example`) before sharing the app.

## Notes

- **Free tier**: The app may sleep after ~15 minutes of no use; the first visit can take ~30 seconds to wake up.  
- **Data never lost on refresh**: All students, payments, and **deleted students** are stored in SQLite on Render’s **persistent disk** (`/app/data`). Refreshing the browser or redeploying the app does **not** erase data — only deleting the Render disk would.  
- **Deleted students**: Removing someone from the directory saves them under **Deleted Students** in the sidebar (not erased).  
- **Backup**: Periodically download `data/db.sqlite` from the server if you need a backup.
