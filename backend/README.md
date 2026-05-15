# 🎨 PaintGH Backend API

Node.js + Express + SQLite REST API for the Ghana Painter Booking Platform.

---

## ⚡ Quick Setup (5 minutes)

### 1. Requirements
- Node.js v16 or higher → https://nodejs.org
- npm (comes with Node.js)

### 2. Install dependencies
```bash
cd paintgh-backend
npm install
```

### 3. Configure environment
```bash
cp config/env.example .env
```
Edit `.env` and **generate a strong JWT secret** — never reuse the placeholder:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```
Paste the output as `JWT_SECRET=…` in `.env`. The local `.env` is gitignored;
the only checked-in template is `config/env.example`.

### 4. Start the server
```bash
# Production
npm start

# Development (auto-restarts on file change)
npm run dev
```

Server runs at: **http://localhost:3000**

The SQLite database (`paintgh.db`) is created automatically on first run, with 8 demo painters and sample data seeded.

---

## 📡 API Reference

### Base URL
```
http://localhost:3000/api
```

### Authentication
Protected routes require a Bearer token in the header:
```
Authorization: Bearer <your_token>
```

---

### 🔐 Auth Endpoints

| Method | Endpoint            | Auth | Description              |
|--------|---------------------|------|--------------------------|
| POST   | /auth/register      | No   | Register new account     |
| POST   | /auth/login         | No   | Login and get token      |
| GET    | /auth/me            | Yes  | Get current user         |
| PUT    | /auth/password      | Yes  | Change password          |

**Register** `POST /api/auth/register`
```json
{
  "name": "Ama Owusu",
  "phone": "0244123456",
  "email": "ama@example.com",
  "password": "mypassword",
  "role": "customer"
}
```
Roles: `customer` | `painter`

**Login** `POST /api/auth/login`
```json
{
  "phone": "0244123456",
  "password": "mypassword"
}
```
Returns: `{ token, user }`

---

### 🖌️ Painters Endpoints

| Method | Endpoint               | Auth    | Description                     |
|--------|------------------------|---------|---------------------------------|
| GET    | /painters              | No      | List & filter painters          |
| GET    | /painters/:id          | No      | Get painter profile + reviews   |
| GET    | /painters/me           | Painter | Get own profile                 |
| PUT    | /painters/profile      | Painter | Update own profile              |

**Filter painters** `GET /api/painters?city=Accra&service=Interior&min_rating=4&max_rate=500`

Query params: `city`, `service`, `min_rating`, `max_rate`, `page`, `limit`

**Update profile** `PUT /api/painters/profile` (painter token required)
```json
{
  "city": "Accra",
  "area": "East Legon",
  "bio": "Professional painter with 8 years experience...",
  "experience_years": 8,
  "rate_per_day": 350,
  "services": ["Interior", "Exterior", "Commercial"],
  "materials_included": true
}
```

---

### 📅 Bookings Endpoints

| Method | Endpoint                    | Auth          | Description                  |
|--------|-----------------------------|---------------|------------------------------|
| POST   | /bookings                   | Customer      | Create a booking             |
| GET    | /bookings                   | Any           | List own bookings            |
| GET    | /bookings/:id               | Owner         | Get single booking           |
| PUT    | /bookings/:id/confirm       | Painter       | Confirm/accept booking       |
| PUT    | /bookings/:id/cancel        | Owner         | Cancel booking               |
| PUT    | /bookings/:id/complete      | Painter       | Mark job as complete         |

**Create booking** `POST /api/bookings` (customer token required)
```json
{
  "painter_id": 1,
  "service": "Interior",
  "address": "Plot 14, Madina, Accra",
  "job_date": "2026-05-10",
  "duration_days": 3,
  "area_sqm": 120,
  "notes": "Please use Dulux paint",
  "payment_method": "momo"
}
```
Payment methods: `momo` | `card` | `onsite`

---

### ⭐ Reviews Endpoints

| Method | Endpoint                      | Auth     | Description                     |
|--------|-------------------------------|----------|---------------------------------|
| POST   | /reviews                      | Customer | Submit a review                 |
| GET    | /reviews/painter/:painter_id  | No       | Get all reviews for a painter   |
| DELETE | /reviews/:id                  | Admin    | Delete a review                 |

**Submit review** `POST /api/reviews` (customer token required)
```json
{
  "booking_id": "BK-12345",
  "rating": 5,
  "comment": "Excellent work! Very professional."
}
```
Note: Booking must be `completed` to leave a review.

---

## 👥 Demo Accounts (seeded on first run)

| Role     | Phone       | Password    |
|----------|-------------|-------------|
| Customer | 0244200001  | password123 |
| Painter  | 0244100001  | password123 |
| Admin    | 0244000000  | password123 |

---

## 📁 Project Structure

```
paintgh-backend/
├── server.js          # App entry point — helmet, CORS, rate limits, routers
├── database.js        # SQLite schema + seeding
├── package.json
├── .env               # Your environment config (gitignored — never commit)
├── .gitignore
├── config/
│   └── env.example    # Environment template (committed)
├── middleware/
│   └── auth.js        # JWT protect + restrictTo
└── routes/
    ├── auth.js        # /api/auth/*
    ├── painters.js    # /api/painters/*
    ├── bookings.js    # /api/bookings/*
    └── reviews.js     # /api/reviews/*
```

---

## 🛡️ Security defaults

- **helmet** sets standard HTTP security headers on every response.
- **express-rate-limit** caps `/api/auth/*` at 10 attempts per 15 min per IP and
  the rest of `/api` at 120 requests per minute per IP. Tune via
  `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_AUTH_MAX` in `.env`.
- JSON request bodies are capped at 100 KB.
- All SQL is parametrized (no string concatenation of user input).
- bcrypt cost factor is 12.
- Passwords are stripped from API responses before serialization.

For production, also: lock CORS to your frontend origin(s), put the API behind
HTTPS (Render/Caddy/Nginx), and rotate `JWT_SECRET` on deploy.

---

## 🚀 Next Steps for Production

1. **Connect real payments** — Integrate [Paystack](https://paystack.com) for MoMo + card
2. **SMS notifications** — Use [Hubtel](https://hubtel.com) to send booking SMS to customers & painters
3. **Deploy** — Host on [Render](https://render.com) (free tier) or a VPS
4. **Connect frontend** — Update `data.js` in the frontend to fetch from this API instead of using static mock data
