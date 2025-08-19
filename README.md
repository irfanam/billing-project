# Billing Project

This repository contains a simple Billing API (FastAPI + Supabase) and a React frontend (Vite + Tailwind).

Layout
- `backend/` - the FastAPI backend application (move of previous `app/`)
- `frontend/` - Vite + React frontend scaffold

Running the backend
1. Create and activate a Python virtualenv:

```bash
python -m venv .venv
source .venv/bin/activate
```

2. Install Python dependencies:

```bash
pip install -r requirements.txt
```

3. Provide Supabase credentials (create a `.env` in project root):

```
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
```

4. Run the backend:

```bash
uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000
```

Running the frontend
1. Install npm dependencies:

```bash
cd frontend
npm install
```

2. Start the dev server (proxies `/api` to backend):

```bash
npm run dev
```

The frontend will be available at `http://127.0.0.1:5173` (or another port Vite chooses).

Notes
- Don't commit `.env` or secrets. Rotate keys if they were exposed.
- The frontend dev server proxies `/api/*` to `http://127.0.0.1:8000` so requests from the React app to `/api/billing` will hit the backend.
