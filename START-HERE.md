# Pharma Clinic Project Start Guide

## Stack
- Frontend: Angular (`frontend`)
- Backend: NestJS (`backend`)
- Planned DB: PostgreSQL (managed)
- Planned cache/queue: Redis (managed)

## Theme Baseline
- Background: white
- Primary color: `#3191ea`
- Global tokens live in `frontend/src/styles.scss`

## UI Library
- Tagia UI components are planned for feature screens.
- Once the package install command is provided, add the library and replace starter cards/header with Tagia elements.

## Run Frontend
```bash
cd frontend
npm install
npm start
```

Frontend URL: `http://localhost:4200`

## Run Backend
```bash
cd backend
npm install
npm run start:dev
```

Backend URL: `http://localhost:3000`
Health endpoint: `http://localhost:3000/api/health`

## Structure (Frontend)
- `src/app/core`: app shell and core layout
- `src/app/shared`: reusable UI components
- `src/app/features`: feature pages/modules

## What Was Added
- Reusable app shell: `frontend/src/app/core/layout`
- Reusable UI components: `frontend/src/app/shared/ui`
- Starter dashboard page: `frontend/src/app/features/dashboard/pages`
- API prefix + CORS + health endpoint on backend

## Next Build Targets
1. Frontdesk module
2. Patient search + new visit flow
3. Services catalog + price lookup
4. Department worklist
5. Billing and payment flow
