# Zameen Online — AJK & Pakistan Property Portal

Built by **Ijaz Software House** (www.ijazs.online) · www.zameen.online

## What's inside

| Page | What it does |
|---|---|
| `index.html` | Home: hero search (Buy/Rent, city, type), stats, property types, featured ads, city cards, AJK gallery, services, dealer CTA |
| `listings.html` | All properties with filters (purpose, keyword, AJK-only, city, type, price, beds), sorting and pages |
| `property.html?id=…` | Photo gallery, price in Lakh/Crore, details, map, Call / WhatsApp / inquiry form, similar properties |
| `post-ad.html` | Post or edit an ad with up to 6 photos (auto-resized) — goes to admin for approval |
| `dealers.html` | Dealer directory with search and city filter |
| `services.html` | Plumbers, electricians, contractors, interior designers etc. by category and city |
| `packages.html` | Basic / Gold / Platinum / Elite dealer packages (subscribe via WhatsApp) |
| `login.html` | Sign in, sign up (Owner or Dealer), forgot password |
| `dashboard.html` | User's ads, views, messages from buyers, saved properties, profile |
| `admin.html` | Approve/reject ads, feature ads, manage dealers, services, inquiries, user roles and packages |

Back end = **Firebase** (Authentication + Firestore). No server to maintain; hosting on **Vercel** from GitHub.

## Try it right now (demo mode)

While `assets/js/firebase-config.js` has an empty `apiKey`, the site runs in demo mode with 16 sample properties,
8 dealers and 10 service providers. Data is saved only in that browser.
Admin login in demo: **admin@zameen.online / admin123**

To view locally: open the folder in VS Code → right-click `index.html` → "Open with Live Server"
(or run `python -m http.server` in the folder and open http://localhost:8000). Opening the file by double-click will not work because the site uses JavaScript modules.

## Go live — step by step

### 1. Firebase (free Spark plan is enough)
1. https://console.firebase.google.com → **Add project** → name it `zameen-online`.
2. **Build → Authentication → Get started → Email/Password → Enable**.
3. **Build → Firestore Database → Create database** → Production mode → location `asia-south1` (Mumbai, closest to Pakistan).
4. Firestore → **Rules** tab → paste everything from `firestore.rules` → **Publish**.
5. **Project settings (⚙) → General → Your apps → Web (</>)** → register app → copy the `firebaseConfig` values into `assets/js/firebase-config.js`.
6. Authentication → **Settings → Authorized domains** → add `zameen.online`, `www.zameen.online` and your `*.vercel.app` domain.

### 2. Make yourself admin
1. Open the site and **sign up** with your own email.
2. Firebase Console → Firestore → `users` → your document → change field `role` from `user` to `admin`.
3. Sign out and in again — the **Admin** button appears. In Admin → Overview you can press **Load sample data** so the site isn't empty on day one (delete those ads later).

### 3. GitHub + Vercel
1. Create a GitHub repo (e.g. `zameen-online`) and upload all files in this folder (keep the folder structure).
2. https://vercel.com → **Add New → Project** → import the repo → Framework preset **Other** → Deploy.
3. Vercel project → **Settings → Domains** → add `zameen.online` and `www.zameen.online`, then copy the DNS records Vercel shows into your domain's DNS (GoDaddy → DNS → Manage).
4. Every time you push to GitHub, Vercel redeploys automatically.

## Everyday admin work
- New ads arrive as **pending** → Admin → Pending Ads → **Approve** (goes live) or Reject.
- **★ Feature** an ad to show it on the homepage "Hand-Picked Properties".
- When a dealer pays for a package: Admin → Users → set their **Package**; Admin → Dealers → Edit → tick **Verified**.
- Buyer inquiries appear in the ad owner's Dashboard → Messages, and in Admin → Inquiries.

## Changing things
- Phone, WhatsApp, email, address: `assets/js/firebase-config.js` → `SITE`.
- Colours and fonts: top of `assets/css/style.css` (`--primary`, `--accent` …).
- Package prices and features, cities, property types, service categories: `assets/js/seed.js`.
- City card photos and homepage text: `index.html` and `assets/js/pages/home.js`.

## Notes
- Photos are resized in the browser and stored in Firestore (no paid Firebase Storage needed). Each ad's photos are stored apart from the ad so the listing pages stay fast.
- Listing pages load all approved ads and filter in the browser — fast for a few thousand ads. Beyond that, move filtering to Firestore queries with indexes.
- Firestore free quota: 50,000 reads / 20,000 writes per day, 1 GB storage.
