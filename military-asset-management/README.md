# Military Asset Management System

This project implements a simple Military Asset Management System (React frontend + Node.js backend + SQLite database).

## Folder Layout

`backend/` contains the Express API.

`military-asset-management/` (inner folder) contains the React frontend.

## Backend

1. `cd backend`
2. `npm install`
3. `npm start`

API base URL: `http://localhost:4000`

Demo users (seeded automatically on first run):
- `admin / admin123` (role `ADMIN`)
- `commander / commander123` (role `COMMANDER`)
- `logistics_a / logistics123` (role `LOGISTICS`, base `BASE_A`)
- `logistics_b / logistics123` (role `LOGISTICS`, base `BASE_B`)

## Frontend

1. `cd military-asset-management`
2. `npm install`
3. `npm run dev`

The UI will default to calling the backend at `http://localhost:4000` (you can override with `VITE_API_BASE`).

## Features Implemented

- Asset balances by base
- Purchases (inventory increases) and expenditures (inventory decreases)
- Assignments (inventory decreases + assignment history)
- Transfers (inventory moves between bases)
- JWT authentication and RBAC by role (ADMIN / COMMANDER / LOGISTICS)

