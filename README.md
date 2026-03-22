# Link & Learn — Skill Barter Platform

A peer-to-peer learning platform where users can teach and learn skills using a credit-based exchange system. Built with a Django REST API backend and a React + TypeScript frontend.

---

## Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 18, TypeScript, Vite, Zustand, Axios, Tailwind CSS, Framer Motion |
| **Frontend (Editors)** | Monaco Editor (`@monaco-editor/react`), Excalidraw (`@excalidraw/excalidraw`) |
| **Frontend (Charts)** | Recharts |
| **Backend** | Python 3.11+, Django 5, Django REST Framework, SimpleJWT |
| **Real-time** | HTTP Polling (via `setInterval` + Axios on the frontend) |
| **Database** | SQLite (dev) / PostgreSQL via `DATABASE_URL` (prod) |
| **Static Files** | WhiteNoise |
| **CORS** | `django-cors-headers` |
| **Deployment** | Vercel (frontend), Render (backend) |

---

## Features

- **Credit-based skill exchange** — New users receive 15 credits; 5 minutes of teaching earns 1 credit; bank takes 10% from every teaching transaction
- **Learning request posts** — Users post skills they want to learn and can offer a skill to teach in return
- **Session lifecycle** — Sessions move through `pending → accepted → scheduled → active → completed` states with lobby-based activation
- **Session scheduling** — Users can propose and confirm meeting times; sessions that expire (10 min past scheduled time) apply a 1-credit penalty to absent users
- **Chat** — In-session text chat polled every 3 seconds (`GET /api/chat/<session_id>/messages/`)
- **Real-time collaborative workspace** — Shared whiteboard (Excalidraw), shared code editor (Monaco), in-session text chat, and WebRTC video call — all synced via HTTP polling (`GET /api/sessions/<id>/updates/` every 1.5 s; `POST /api/sessions/<id>/sync/` to push changes). WebRTC signalling (offer/answer/ICE candidates) is also exchanged through this polling endpoint.
- **Teaching timer** — Per-user teaching timer tracked per session; only one timer can run at a time
- **Bank support system** — Users with ≤ 3 credits can request emergency credits from the platform bank (24-hour cooldown)
- **Login streak tracking** — Consecutive login days tracked per user
- **Online presence** — Online/offline status via HTTP polling every 5 seconds (`GET /api/presence/online/`)
- **User profiles** — Public profiles with average rating, total hours taught, and weekly activity charts
- **Reviews** — Users can rate each other after sessions
- **Code execution** — Proxy to [onlinecompiler.io](https://onlinecompiler.io) supporting Python, JavaScript, Java, C, C++, C#, PHP, Ruby, Go, Rust, TypeScript
- **Credit transaction history** — Full audit trail of all credit movements
- **Direct message sessions** — Start a DM session with any user

---

## Project Structure

```
skillbarter/
├── README.md
├── run_project.py          # Helper script to start both servers
├── backend/
│   ├── manage.py
│   ├── requirements.txt
│   ├── Procfile            # Render deployment config
│   ├── build.sh            # Render build script
│   ├── runtime.txt         # Python version pin
│   ├── linklearn/          # Django project package
│   │   ├── settings.py
│   │   ├── urls.py
│   │   ├── asgi.py         # Channels/Daphne entry point
│   │   └── wsgi.py
│   └── core/               # Main Django app
│       ├── models/
│       │   ├── user.py             # Custom User model (email-auth)
│       │   ├── session.py          # Session & SessionTimer models
│       │   ├── learning_request.py # LearningRequestPost model
│       │   ├── credit.py           # Bank & CreditTransaction models
│       │   ├── review.py           # Review model
│       │   └── chat.py             # ChatMessage model
│       ├── views/
│       │   ├── auth.py             # Signup, Login, Logout
│       │   ├── user.py             # User profile views
│       │   ├── session.py          # SessionViewSet
│       │   ├── learning_request.py # LearningRequestPostViewSet
│       │   ├── presence.py         # PresenceViewSet
│       │   ├── chat_views.py       # ChatViewSet
│       │   ├── review.py           # ReviewViewSet
│       │   ├── credit.py           # Credit balance & transactions
│       │   ├── bank.py             # BankSupportView
│       │   └── misc.py             # execute_code (code runner proxy)
│       ├── serializers/
│       ├── consumers/
│       │   ├── presence.py         # Presence WebSocket consumer
│       │   ├── chat.py             # Chat WebSocket consumer
│       │   └── session.py          # Session WebSocket consumer
│       ├── urls.py
│       ├── routing.py              # WebSocket URL routing
│       ├── middleware.py
│       └── permissions.py
└── frontend/
    ├── index.html
    ├── vite.config.ts
    ├── tailwind.config.js
    ├── package.json
    ├── tsconfig.json
    ├── vercel.json
    └── src/
        ├── App.tsx                 # Routes
        ├── main.tsx
        ├── types.ts
        ├── pages/
        │   ├── HomePage.tsx
        │   ├── LoginPage.tsx
        │   ├── SignupPage.tsx
        │   ├── SearchPage.tsx      # Browse & create learning posts
        │   ├── ProfilePage.tsx     # User profile
        │   ├── SessionPage.tsx     # Live session workspace
        │   └── SessionsPage.tsx    # Session list & management
        ├── components/
        │   ├── Header.tsx
        │   ├── Sidebar.tsx
        │   ├── Layout.tsx
        │   ├── ProtectedRoute.tsx
        │   ├── ReviewCard.tsx
        │   ├── ReviewForm.tsx
        │   ├── AvailabilityModal.tsx
        │   ├── AnimatedPage.tsx
        │   ├── profile/
        │   └── session/
        ├── hooks/
        ├── stores/                 # Zustand stores
        └── lib/
```

---

## Quick Start

### Backend

```bash
# 1. Create and activate a virtual environment
cd backend
python -m venv venv

# Windows
venv\Scripts\activate

# Linux / macOS
source venv/bin/activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Copy and configure environment variables (see section below)
# Create backend/.env

# 4. Run database migrations
python manage.py migrate

# 5. (Optional) Create a superuser
python manage.py createsuperuser

# 6. Start the ASGI server (required for WebSockets)
daphne -b 127.0.0.1 -p 8000 linklearn.asgi:application
```

> **Note:** `python manage.py runserver` works for HTTP-only development but does **not** support WebSockets. Use `daphne` for full functionality.

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Configure environment variables (see section below)
# Create frontend/.env

# Start development server
npm run dev
```

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `SECRET_KEY` | Yes | insecure dev key | Django secret key |
| `DEBUG` | No | `True` | Set `False` in production |
| `ALLOWED_HOSTS` | No | `localhost,127.0.0.1,.onrender.com` | Comma-separated allowed hosts |
| `DATABASE_URL` | No | SQLite | Full PostgreSQL connection URL for production |
| `CORS_ALLOWED_ORIGINS` | No | localhost variants + Vercel URL | Comma-separated CORS origins |
| `CSRF_TRUSTED_ORIGINS` | No | localhost variants + Vercel URL | Comma-separated CSRF-trusted origins |
| `REDIS_HOST` | No | `127.0.0.1` | Redis host (used only when `DEBUG=False`) |
| `REDIS_PORT` | No | `6379` | Redis port (used only when `DEBUG=False`) |
| `ONLINECOMPILER_API_KEY` | Yes (for code execution) | — | API key for [onlinecompiler.io](https://onlinecompiler.io) |

> When `DEBUG=True`, an in-memory channel layer is used — **no Redis required**.
> When `DEBUG=False`, Redis is required for WebSocket channel groups.

### Frontend (`frontend/.env`)

| Variable | Required | Description |
|---|---|---|
| `VITE_API_URL` | Yes | Base URL of the backend API (e.g., `http://127.0.0.1:8000`) |
| `VITE_WS_URL` | Yes | WebSocket base URL (e.g., `http://127.0.0.1:8000`) |

---

## URLs

| Service | URL |
|---|---|
| Frontend (dev) | http://localhost:5173 |
| Backend API | http://127.0.0.1:8000/api/ |
| Django Admin | http://127.0.0.1:8000/admin/ |

---

## Credit System Rules

| Event | Credits |
|---|---|
| Signup bonus | +15 credits |
| Teaching (per 5 min) | +1 credit (minus 10% bank cut) |
| Learning | –credits proportional to teacher's time |
| Bank cut | 10% of every teaching transaction |
| No-show penalty | –1 credit (if session expires unjoined) |
| **Bank support** (0 credits) | +6 credits |
| **Bank support** (1–2 credits) | +4 credits |
| **Bank support** (3 credits) | +2 credits |
| **Bank support** (> 3 credits) | Not eligible |
| Support cooldown | 24 hours between requests |
