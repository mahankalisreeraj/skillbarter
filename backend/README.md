# Link & Learn — Django Backend

The REST API and WebSocket backend for the Link & Learn skill barter platform. Built with Django 5, Django REST Framework, Django Channels, and Daphne.

---

## Tech Stack

| Component | Technology |
|---|---|
| **Language** | Python 3.11+ |
| **Web Framework** | Django 5.0 |
| **REST API** | Django REST Framework |
| **Authentication** | SimpleJWT (JWT via Bearer token) |
| **Real-time** | HTTP Polling (frontend polls REST endpoints via Axios `setInterval`) |
| **Channel Layer** | N/A (not used by frontend) |
| **Database** | SQLite (dev) / PostgreSQL via `dj-database-url` (prod) |
| **Static Files** | WhiteNoise |
| **CORS** | `django-cors-headers` |
| **Code Execution** | [onlinecompiler.io](https://onlinecompiler.io) (proxied) |

---

## Quick Start

### 1. Create Virtual Environment

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate

# Linux / macOS
source venv/bin/activate
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Configure Environment Variables

Create a `backend/.env` file:

```env
SECRET_KEY=your-secret-key-here
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1
DATABASE_URL=                        # Leave empty to use SQLite in dev
CORS_ALLOWED_ORIGINS=http://localhost:5173
CSRF_TRUSTED_ORIGINS=http://localhost:5173,http://127.0.0.1:8000
ONLINECOMPILER_API_KEY=your-key-here # Required for /api/execute/
```

> **Note:** Django Channels and Daphne are installed as dependencies but the frontend does **not** use WebSockets — it uses HTTP polling exclusively. You can run the server with the standard `python manage.py runserver` for full functionality.

### 4. Run Migrations

```bash
python manage.py makemigrations
python manage.py migrate
```

### 5. Create Superuser (Optional)

```bash
python manage.py createsuperuser
```

The custom `User` model uses **email** as the unique identifier (not `username`). The `createsuperuser` command will ask for `email`, `name`, and `password`.

### 6. Start Server

**Recommended (standard Django server — sufficient for all features):**
```bash
python manage.py runserver
```

**Alternative ASGI server (Daphne — installed but not required by the frontend):**
```bash
daphne -b 127.0.0.1 -p 8000 linklearn.asgi:application
```

---

## Project Structure

```
backend/
├── manage.py
├── requirements.txt
├── Procfile                    # Render: web: daphne linklearn.asgi:application
├── build.sh                    # Render build script
├── runtime.txt                 # Python version pin (e.g., python-3.11.x)
├── linklearn/                  # Django project package
│   ├── settings.py
│   ├── urls.py                 # Root URL config: /admin/, /api/, media/
│   ├── asgi.py                 # Channels ASGI app entry point
│   └── wsgi.py
└── core/                       # Main Django app
    ├── models/
    │   ├── user.py             # Custom User (email auth, credits, streak)
    │   ├── session.py          # Session, SessionTimer
    │   ├── learning_request.py # LearningRequestPost
    │   ├── credit.py           # Bank (singleton), CreditTransaction
    │   ├── review.py           # Review
    │   └── chat.py             # ChatMessage
    ├── serializers/
    │   ├── user.py
    │   ├── session.py
    │   ├── learning_request.py
    │   ├── credit.py
    │   ├── review.py
    │   └── chat.py
    ├── views/
    │   ├── auth.py             # SignupView, LoginView, LogoutView
    │   ├── user.py             # UserMeView, UserDetailView, UserListView
    │   ├── session.py          # SessionViewSet
    │   ├── learning_request.py # LearningRequestPostViewSet
    │   ├── presence.py         # PresenceViewSet
    │   ├── chat_views.py       # ChatViewSet
    │   ├── review.py           # ReviewViewSet
    │   ├── credit.py           # CreditBalanceView, CreditTransactionListView
    │   ├── bank.py             # BankSupportView
    │   └── misc.py             # execute_code (onlinecompiler.io proxy)
    ├── urls.py                 # All /api/* routes
    ├── middleware.py
    ├── permissions.py
    └── utils.py                # calculate_credits() helper
```

---

## API Endpoints

All endpoints are prefixed with `/api/`. All protected endpoints require the header:
```
Authorization: Bearer <access_token>
```

### Authentication

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/signup/` | No | Register new user |
| POST | `/api/auth/login/` | No | Login user, returns JWT pair |
| POST | `/api/auth/logout/` | Yes | Logout user |
| POST | `/api/auth/token/refresh/` | No | Refresh access token |

**Signup request body:**
```json
{
  "email": "test@example.com",
  "name": "Test User",
  "password": "SecurePass123!",
  "password_confirm": "SecurePass123!"
}
```

### Users

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/users/` | Yes | List users |
| GET | `/api/users/me/` | Yes | Get current user profile |
| PATCH | `/api/users/me/` | Yes | Update own profile |
| GET | `/api/users/<id>/` | Yes | Get user by ID |
| GET | `/api/users/<user_pk>/reviews/` | Yes | Get reviews received by a user |

### Learning Request Posts

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/posts/` | Yes | List active posts |
| POST | `/api/posts/` | Yes | Create a learning request post |
| GET | `/api/posts/<id>/` | Yes | Get post details |
| PATCH | `/api/posts/<id>/` | Yes | Update a post |
| POST | `/api/posts/<id>/complete/` | Yes | Mark post as completed |
| GET | `/api/posts/my_posts/` | Yes | Get own active posts |

**Create post request body:**
```json
{
  "topic_to_learn": "Python",
  "topic_to_teach": "JavaScript",
  "ok_with_just_learning": false,
  "bounty_enabled": false
}
```

### Sessions

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/sessions/` | Yes | List user's sessions |
| POST | `/api/sessions/` | Yes | Create session from a learning post (`{"post_id": 123}`) |
| GET | `/api/sessions/<id>/` | Yes | Get session details |
| POST | `/api/sessions/<id>/respond/` | Yes | Accept or reject session (`{"decision": "accept"}`) |
| POST | `/api/sessions/<id>/propose-time/` | Yes | Propose a meeting time |
| POST | `/api/sessions/<id>/confirm-time/` | Yes | Confirm proposed time |
| POST | `/api/sessions/<id>/join-lobby/` | Yes | Signal lobby presence |
| GET | `/api/sessions/<id>/updates/` | Yes | Poll for sync data, WebRTC signals, and presence |
| POST | `/api/sessions/<id>/sync/` | Yes | Push whiteboard/code/WebRTC signal data |
| POST | `/api/sessions/<id>/timer/start/` | Yes | Start teaching timer |
| POST | `/api/sessions/<id>/timer/stop/` | Yes | Stop teaching timer |
| POST | `/api/sessions/<id>/end/` | Yes | End session and process credit transfers |
| POST | `/api/sessions/dm/<user_id>/` | Yes | Get or create a DM session with a user |
| POST | `/api/sessions/<session_pk>/reviews/` | Yes | Submit a review for the session |
| GET | `/api/sessions/<session_pk>/reviews/` | Yes | List reviews for a session |

### Credits & Bank

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/credits/` | Yes | Get current credit balance |
| GET | `/api/credits/transactions/` | Yes | List credit transaction history |
| GET | `/api/bank/support/` | Yes | Check bank support eligibility |
| POST | `/api/bank/support/` | Yes | Request support credits from the bank |

### Presence

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/presence/` | Yes | List online users |
| GET | `/api/presence/online/` | Yes | Get online user list |

### Chat

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/chat/` | Yes | List chat messages |

### Code Execution

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/execute/` | No | Execute code via onlinecompiler.io proxy |

**Request body:**
```json
{
  "language": "python",
  "files": [{ "content": "print('hello')" }],
  "input": ""
}
```

**Supported languages:** `python`, `javascript`, `java`, `c`, `cpp`, `c++`, `csharp`, `php`, `ruby`, `go`, `rust`, `typescript`

---

## Frontend Polling Behaviour

The frontend uses HTTP polling (no WebSockets) via a shared `usePolling` hook built on `setInterval`:

| Hook | Endpoint Polled | Interval | Purpose |
|---|---|---|---|
| `usePresence` | `GET /api/presence/online/` | 5 s | Online users & waiting sessions |
| `useChatSocket` (HTTP) | `GET /api/chat/<session_id>/messages/` | 3 s | New chat messages since last ID |
| `useSessionSocket` (HTTP) | `GET /api/sessions/<session_id>/updates/` | 1.5 s | Session state, timer, WebRTC signals, whiteboard/code sync |

Collaborative data (whiteboard, code editor, WebRTC signalling) is **pushed** via:
```
POST /api/sessions/<session_id>/sync/
```
and **received** by the peer on the next poll of `/updates/`.

---

## Data Models

### User
Custom user model (`AUTH_USER_MODEL = 'core.User'`) using **email** as the unique login identifier.

| Field | Type | Notes |
|---|---|---|
| `email` | EmailField (unique) | Primary login identifier |
| `name` | CharField (unique) | Display name |
| `credits` | DecimalField | Starts at 15.00 |
| `is_online` | BooleanField | Updated via WebSocket presence |
| `availability` | CharField | Free-text availability description |
| `last_seen` | DateTimeField | Last active timestamp |
| `last_support_request` | DateTimeField | For 24h cooldown enforcement |
| `last_login_date` | DateField | For streak tracking |
| `login_streak` | IntegerField | Consecutive login days |

### Session

| Field | Type | Notes |
|---|---|---|
| `user1` | FK User | Learner (post creator) |
| `user2` | FK User | Teacher (session initiator) |
| `learning_request` | FK LearningRequestPost | Nullable (null for DM sessions) |
| `status` | CharField | `pending / accepted / scheduled / active / completed / expired / rejected` |
| `scheduled_time` | DateTimeField | Set after time is confirmed |
| `room_id` | CharField (unique) | UUID assigned when time is confirmed |
| `whiteboard_data` | JSONField | Collaborative whiteboard state |
| `code_data` | JSONField | Collaborative code editor state |
| `signal_data` | JSONField | WebRTC signalling (offer/answer/candidates) |
| `sync_version` | PositiveIntegerField | Incremented on every collaborative update |

### CreditTransaction
Types: `TEACHING`, `LEARNING`, `SIGNUP`, `SUPPORT`, `BANK_CUT`

---

## Credit System Rules

- **New users** receive **15 credits** on signup
- **Teaching**: every 5 minutes = 1 credit earned
- **Bank cut**: 10% from every teaching credit transfer
- **Session expiry penalty**: –1 credit per user who fails to join within 10 minutes of scheduled time

### Bank Support

| Current Credits | Credits Received |
|---|---|
| 0 | +6 |
| 1 – 2 | +4 |
| 3 | +2 |
| > 3 | Not eligible |
| Cooldown | 24 hours between requests |

---

## Django Admin

Access at `http://127.0.0.1:8000/admin/` after creating a superuser.

Registered models: `User`, `Session`, `SessionTimer`, `LearningRequestPost`, `Bank`, `CreditTransaction`, `Review`, `ChatMessage`

---

## JWT Token Lifetime

| Token | Lifetime |
|---|---|
| Access token | 1 hour |
| Refresh token | 7 days |
| Rotation | Enabled (refresh token rotated on each use) |

---

## Example API Calls (curl)

### Signup
```bash
curl -X POST http://localhost:8000/api/auth/signup/ \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","name":"Test User","password":"SecurePass123!","password_confirm":"SecurePass123!"}'
```

### Login
```bash
curl -X POST http://localhost:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"SecurePass123!"}'
```

### Create Learning Post
```bash
curl -X POST http://localhost:8000/api/posts/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -d '{"topic_to_learn":"Python","topic_to_teach":"JavaScript","ok_with_just_learning":false}'
```

### Execute Code
```bash
curl -X POST http://localhost:8000/api/execute/ \
  -H "Content-Type: application/json" \
  -d '{"language":"python","files":[{"content":"print(\"hello world\")"}]}'
```

---

## Production Deployment (Render)

The backend is configured for deployment on [Render](https://render.com):

- **Start command** (`Procfile`): `web: daphne -b 0.0.0.0 -p $PORT linklearn.asgi:application` (Daphne is used as the production ASGI server; the frontend uses HTTP polling, not WebSockets)
- Set all required environment variables in the Render dashboard
- Set `DEBUG=False` and provide `DATABASE_URL` (PostgreSQL)
- WhiteNoise serves static files; media files are served directly (ephemeral storage on Render)

---

## License

MIT
