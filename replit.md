# ViVi Finance

## Overview
A finance management application (Russian language UI) built with React + Vite frontend and Express.js backend with PostgreSQL database.

## Project Architecture

### Frontend
- **Framework**: React 19 with TypeScript
- **Bundler**: Vite (port 5000)
- **Styling**: Tailwind CSS (via CDN), custom scrollbar styles
- **Routing**: react-router-dom v7
- **Charts**: recharts
- **Icons**: lucide-react
- **Excel**: xlsx for export

### Backend
- **Framework**: Express.js (port 3001, CommonJS `.cjs` files)
- **Database**: PostgreSQL (Replit built-in)
- **Server files**: Located in `server/` directory with `.cjs` extension

### Key Files
- `index.html` - Entry HTML
- `index.tsx` - React entry point
- `App.tsx` - Main app component with routing
- `context/AuthContext.tsx` - Authentication state
- `context/FinanceContext.tsx` - Finance data state
- `components/` - UI components
- `server/index.cjs` - Express server entry
- `server/db.cjs` - PostgreSQL pool
- `server/startup.cjs` - DB table initialization
- `server/routes/` - API route handlers

### Database Tables
- users, activity_logs, accounts, categories, studios, contractors, projects, transactions

### API
- All frontend API calls use `/api` prefix, proxied by Vite to backend on port 3001
- Auth: POST /api/login, GET/POST/DELETE /api/users
- Transactions: POST/PUT/DELETE /api/transactions
- Dictionaries: POST/DELETE for categories, contractors, projects, accounts, studios
- Init data: GET /api/init

### Default Login
- Username: admin, Password: admin

## Recent Changes
- Migrated to Replit environment
- Created Replit PostgreSQL database
- Configured Vite proxy for API calls (frontend -> backend)
- Renamed server files from .js to .cjs for CommonJS compatibility with "type": "module" in package.json
- Updated all hardcoded localhost:3001 API URLs to use relative /api paths
