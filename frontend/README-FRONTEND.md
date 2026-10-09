# NogorGoti Frontend

## Structure

frontend/
- index.html
- login.html
- register.html
- guest.html
- passenger.html
- admin.html
- css/
  - global.css
  - home.css
  - auth.css
  - dashboard.css
  - guest.css
  - passenger.css
  - admin.css
- js/
  - api.js
  - common.js
  - auth.js
  - home.js
  - guest.js
  - passenger.js
  - admin.js

## Run backend

From project root with `.venv` activated:

```bash
python -m uvicorn backend.main:app --reload
```

Expected backend: `http://127.0.0.1:8000`

## Run frontend

From project root:

```bash
python -m http.server 5500 -d frontend
```

Open:

`http://127.0.0.1:5500`

Do not double-click the HTML files directly; use the HTTP server.

## Test order

### Guest
1. Home page loads.
2. Home From/To dropdowns populate from `GET /stops`.
3. Quick fare calls `GET /fare-lookup`.
4. Guest dashboard loads routes, stops, fares, fare logs, forum posts/replies, and ratings.
5. Route selection loads `GET /routes/{route_id}/stops`.
6. Fare tracker stats calls `GET /fare-logs/stats`.

### Passenger
1. Register with a unique email and unique phone.
2. Login as passenger.
3. Passenger dashboard should open automatically.
4. Student verification POST works without a user_id field.
5. Student fare lookup uses JWT.
6. Fare report POST works without user_id.
7. Forum post and reply work.
8. Rating and complaint work.
9. Profile GET/PUT work.
10. Logout clears localStorage.

### Access control
1. Passenger tries to open `admin.html` -> frontend redirects to passenger page.
2. Backend still provides the real protection with `require_admin()`.

### Admin
1. Login using a database account whose role is `ADMIN`.
2. Overview metrics load.
3. Transport CRUD works.
4. Stop CRUD works.
5. Route CRUD works.
6. Route stop add/remove works.
7. Fare CRUD works.
8. Student verification list and approve works.
9. Complaint status changes through SUBMITTED / IN_PROGRESS / VERIFIED.
10. Users list loads.

## Backend assumptions

This frontend matches your current backend:
- Public registration creates `PASSENGER`.
- `POST /login` returns `access_token` and user details.
- Protected requests send `Authorization: Bearer <token>`.
- Passenger-created records get user_id from JWT.
- User fields are `name`, `email`, `phone`, `role`.
- Admin CRUD endpoints require ADMIN role.
- Complaint statuses are `SUBMITTED`, `IN_PROGRESS`, `VERIFIED`.

If the backend port changes, edit `API_BASE_URL` in `js/api.js`.
