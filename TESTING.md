# Test before deploy (no hosting required)

You can test everything on your PC first. Deploy only after these pass.

## Quick start

**Terminal 1** — start the app:

```bash
npm install
npm run dev
```

Open http://localhost:3000 in your browser.

**Terminal 2** — run automated API tests:

```bash
npm test
```

If all tests pass, the backend (login, students, archive, notifications) works correctly.

---

## Default login (local)

| Email | Password |
|-------|----------|
| `admin@kanhalibrary.com` | `KanhaAdmin@2024` |

---

## Automated tests (`npm test`)

Checks:

- Wrong password is rejected  
- Admin login works  
- API requires login  
- Dashboard stats  
- Register student → list → archive → deleted list → restore  
- Notifications endpoint  
- Homepage loads  

WhatsApp is **not** sent during tests unless you set `CALLMEBOT_API_KEY` in `.env`.

---

## Manual UI checklist (5–10 minutes)

| # | Action | Expected |
|---|--------|----------|
| 1 | Open http://localhost:3000 | Login page appears |
| 2 | Sign in with admin email/password | Dashboard opens |
| 3 | **Student Register** — add a student with seat + photo | Success toast, seat on dashboard |
| 4 | **Seat Layout** — click a seat | Shows student or empty |
| 5 | **Student Directory** — search name | Student found |
| 6 | Remove student → **Move to Archive** | Gone from directory |
| 7 | **Deleted Students** | Same student listed with details |
| 8 | **Restore** with a free seat | Back in directory |
| 9 | **Settings** — change total seats, Save | Seat map updates |
| 10 | Refresh browser (F5) | Still logged in, data still there |
| 11 | Sign out → sign in again | Data unchanged |

---

## Test production build locally (same as Render)

```bash
npm run build
npm start
```

Open http://localhost:5000 (single port — API + website).

Run `npm test` again (tests use port 5000 by default).

---

## Test WhatsApp alerts (optional, before deploy)

1. Copy `.env.example` to `.env`  
2. Complete CallMeBot setup (see `DEPLOY.md`)  
3. Set `CALLMEBOT_API_KEY` in `.env`  
4. Restart `npm run dev`  
5. In app: **Settings → Run expiry check now**  
6. Or register a student with **expiry date = yesterday** and run check again  

Message should arrive on **9828130420**.

---

## When to deploy

Deploy to Render when:

- `npm test` passes  
- Manual checklist looks good  
- You set `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `SESSION_SECRET` on Render  
- (Optional) `CALLMEBOT_API_KEY` for WhatsApp  

See `DEPLOY.md` for hosting steps.
