# 🚀 Railway.app Complete Deployment Guide

This project is already **Docker-ready and Railway-optimized** with dynamic `$PORT` routing, CORS handling, and Next.js backend proxy rewrites.

Railway par isko deploy karna bahut aasan hai. Aapko bas **2 Services** banani hoti hain (ek Backend aur ek Frontend) usi ek GitHub repo se.

---

## 📋 Architecture on Railway

```
                  ┌──────────────────────────────────────────────┐
                  │                 USER BROWSER                 │
                  │  https://trading-frontend.up.railway.app     │
                  └──────────────────────┬───────────────────────┘
                                         │
                        ┌────────────────┴────────────────┐
                        ▼                                 ▼
         ┌──────────────────────────────┐  ┌──────────────────────────────┐
         │       SERVICE 1: FRONTEND    │  │       SERVICE 2: BACKEND     │
         │   Next.js 16 + React 19      │─▶│     FastAPI + Upstox Live    │
         │   (Root Directory: frontend) │  │    (Root Directory: backend) │
         └──────────────────────────────┘  └──────────────────────────────┘
                                                          │
                                                          ▼
                                           ┌──────────────────────────────┐
                                           │       UPSTOX API V2          │
                                           │      NSE Live Quotes         │
                                           └──────────────────────────────┘
```

---

## 🛠️ Step-by-Step Deployment Instructions

### STEP 1: Code ko GitHub par Push karein
Apne terminal me check karein ki latest changes committed aur pushed hain:
```bash
git add .
git commit -m "Configure Railway deployment with dynamic PORT, CORS, and paper engine"
git push origin main
```

---

### STEP 2: Railway par Project Banayein
1. [railway.app](https://railway.app/) par jayein aur apne **GitHub Account** se login karein.
2. Dashboard par **"+ New Project"** button par click karein.
3. **"Deploy from GitHub repo"** select karein aur apna trading repo select karein.

---

### STEP 3: Backend Service Configure karein
1. Railway aapke repo ko inspect karega. Us service par click karein aur **Settings** tab me jayein:
   - **Service Name**: `trading-backend`
   - **Root Directory**: `backend` (ye type karke Save karein)
   - **Build**: Railway automatically `backend/Dockerfile` detect kar lega.
2. **Networking** (Public Domain):
   - **Settings ➔ Networking ➔ "Generate Domain"** par click karein.
   - Ye aapko ek public URL dega (Jaise: `https://trading-backend-production-xxxx.up.railway.app`). Is URL ko copy kar lein!
3. **Variables** (Environment Variables) tab me jayein aur ye variables add karein:

| Variable Name | Value |
| :--- | :--- |
| `MARKET_DATA_PROVIDER` | `UPSTOX` |
| `UPSTOX_CLIENT_ID` | Aapki Upstox API Key |
| `UPSTOX_CLIENT_SECRET` | Aapka Upstox API Secret |
| `UPSTOX_ACCESS_TOKEN` | Aapka Upstox Access Token |
| `UPSTOX_REDIRECT_URI` | `https://trading-backend-production-xxxx.up.railway.app/api/v1/auth/upstox/callback` |
| `JWT_SECRET` | `your-secure-jwt-secret-at-least-32-characters-long` |
| `DATABASE_URL` | `sqlite+aiosqlite:///./trading.db` |
| `DEBUG` | `false` |

---

### STEP 4: Frontend Service Add karein (Same Project me)
1. Usi Railway Project ke canvas par upar **"+ New"** button par click karein.
2. **"GitHub Repo"** select karein aur wahi same repository dobara choose karein.
3. Nayi service create hogi, uspe click karein aur **Settings** me jayein:
   - **Service Name**: `trading-frontend`
   - **Root Directory**: `frontend` (ye zaroor set karein)
4. **Variables** tab me jayein aur sirf 1 variable add karein:

| Variable Name | Value |
| :--- | :--- |
| `NEXT_PUBLIC_API_URL` | `https://trading-backend-production-xxxx.up.railway.app` (Jo Step 3 me Backend ka Domain mila tha) |

5. **Networking**:
   - **Settings ➔ Networking ➔ "Generate Domain"** par click karein.
   - Ye aapke Frontend ka public web address dega (Jaise: `https://trading-frontend-production-xxxx.up.railway.app`).

---

### STEP 5: Verification & Launch! 🚀
1. Dono services deploy hone me 1-2 minute lengi (Green Checkmark `Active` dikhega).
2. Frontend ke domain par click karke open karein.
3. Dashboard live hoga:
   - Live Upstox Quotes stream honge.
   - Status bar me `UPSTOX API V2 LIVE` dikhega.
   - **Paper Trading** aur **Day-Wise P&L Ledger** cloud me 24/7 background me bina laptop on rakhe bhi chalta rahega!

---

## 💡 Railway Pro Tips:
- **Upstox Access Token Update**: Har subah agar token expire ho, to aapko code redeploy nahi karna padega. Bas Railway ke `trading-backend` service ke **Variables** me jaakar `UPSTOX_ACCESS_TOKEN` ki value update kar deni hai—Railway 10 seconds me auto-restart kar dega!
- **Zero Cost / Hobby Plan**: Railway ke Free/Hobby tier ($5 free monthly credits) par ye dono lightweight containers aaram se mahina bhar chal jate hain.
