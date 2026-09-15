# AI-Powered Intraday Trading Platform (NSE)

A production-ready algorithmic trading signal platform engineered for Indian markets (**NSE: NIFTY 50 & BANK NIFTY**), featuring AI-based signal generation, automated risk engine, paper trading simulation, and real-time dashboard terminal.

---

## Quick Start (Run Total Project)

### Option 1: One Command (Recommended)

From the root project directory (`/Users/mayurkhotele/Desktop/Trading`):

```bash
npm run dev
```

This concurrently launches:
- **Backend API**: [http://localhost:8000](http://localhost:8000) (Interactive Swagger docs at [http://localhost:8000/docs](http://localhost:8000/docs))
- **Frontend Terminal**: [http://localhost:3000](http://localhost:3000)

---

### Option 2: Running in Separate Terminals

If you prefer viewing backend and frontend logs in dedicated terminal windows:

#### Terminal 1 — Backend (FastAPI + Python)
```bash
# Activate existing virtual environment and run uvicorn
source .venv/bin/activate
cd backend
uvicorn app.main:app --reload --port 8000
```

#### Terminal 2 — Frontend (Next.js)
```bash
cd frontend
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

### Option 3: Full Docker Stack (Production / Containerized)

If Docker & Docker Compose are installed on your system:

```bash
cd docker
docker-compose up --build
```
This spins up:
- **PostgreSQL 15** (Port 5432)
- **Redis 7** (Port 6379)
- **Backend API** (Port 8000)
- **Frontend App** (Port 3000)

---

## Helpful Helper Commands

All commands can be run directly from the workspace root:

| Command | Description |
|---|---|
| `npm run dev` | Starts both backend & frontend together |
| `npm run dev:backend` | Starts only the FastAPI backend (`:8000`) |
| `npm run dev:frontend` | Starts only the Next.js frontend (`:3000`) |
| `npm run build` | Builds the frontend for production |
| `npm run test:backend` | Runs pytest test suite for backend |
| `npm run seed` | Seeds default instruments (`NIFTY 50`, `BANK NIFTY`) |
| `npm run generate-data` | Generates 1-minute historical sample CSVs in `data/` |

---

## Project Structure

```
Trading/
├── .venv/                   # Python virtual environment (pre-installed dependencies)
├── backend/                 # FastAPI REST & WebSocket server
│   ├── app/
│   │   ├── api/v1/          # Routers: auth, market, risk, system
│   │   ├── core/            # Database config, security, logging
│   │   ├── models/          # SQLAlchemy models (instruments, candles, signals, trades)
│   │   ├── schemas/         # Pydantic models
│   │   └── services/        # AI engines, indicators, risk managers, brokers
│   ├── requirements.txt
│   └── tests/               # Unit & integration test suites
├── frontend/                # Next.js 16 + React 19 + Tailwind CSS terminal UI
│   ├── app/                 # Next.js App Router (dashboard page & layouts)
│   ├── components/          # Trading terminal UI components
│   └── package.json
├── data/                    # Generated sample historical CSVs for backtesting & training
├── docker/                  # Docker Compose configuration
├── scripts/                 # Utility scripts (seeding instruments, synthetic CSV generator)
└── package.json             # Root orchestrator scripts
```

---

## Mandatory Risk & Regulatory Notice
*Trading in financial derivatives, futures, and intraday equity carries substantial risk of capital loss. This platform provides quantitative indicators and paper trading simulations for analytical and educational purposes only.*
