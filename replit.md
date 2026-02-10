# ViVi Finance

## Overview
A finance management application (Russian language UI) built with React + Vite frontend and Express.js backend with PostgreSQL database.

## User Preferences
- **Database**: Always use the external PostgreSQL database specified in the `.env` file (`postgresql://postgres:cd5d56a8@213.226.124.2:5432/planfact_vivi`). Do not use the Replit internal database unless explicitly requested.
- **No Projects**: The "projects" entity has been removed. Only "studios" are used for grouping.
- **Language**: All activity logs and UI must be in Russian.

## Project Architecture

### Frontend
- **Framework**: React 19 with TypeScript
- **Bundler**: Vite (port 5000)
- **Styling**: Tailwind CSS (via CDN), custom scrollbar styles
- **Routing**: react-router-dom v7
- **Charts**: recharts
- **Icons**: lucide-react
- **Excel**: xlsx for export
- **Real-time sync**: Polling every 5 seconds for multi-user data synchronization

### Backend
- **Framework**: Express.js (port 3001, CommonJS `.cjs` files)
- **Database**: PostgreSQL (Replit built-in)
- **Server files**: Located in `server/` directory with `.cjs` extension

### Key Files
- `index.html` - Entry HTML
- `index.tsx` - React entry point
- `App.tsx` - Main app component with routing
- `context/AuthContext.tsx` - Authentication state
- `context/FinanceContext.tsx` - Finance data state with polling
- `components/` - UI components
- `server/index.cjs` - Express server entry
- `server/db.cjs` - PostgreSQL pool
- `server/startup.cjs` - DB table initialization
- `server/routes/` - API route handlers
- `server/utils/logger.cjs` - Activity logging with Russian translations

### Database Tables
- users, activity_logs, accounts, categories, studios, contractors, transactions

### API
- All frontend API calls use `/api` prefix, proxied by Vite to backend on port 3001
- Auth: POST /api/login, GET/POST/DELETE /api/users
- Transactions: POST/PUT/DELETE /api/transactions
- Dictionaries: POST/PUT/DELETE for categories, contractors, accounts, studios
- Init data: GET /api/init

### Default Login
- Username: grachev, Password: cd5d56a8

### Categories
- 5 types: income, expense, asset, liability, capital (CategoryType in types.ts)
- Hierarchical: parent categories with subcategories (parent_id in DB)
- Tree view with collapsible parents in Directories page

## Recent Changes
- Added edit dialogs for all directory items (categories, contractors, accounts, studios)
- Expanded category types to 5 (Доходы, Расходы, Активы, Обязательства, Капитал)
- Implemented hierarchical categories with subcategories (parent/child tree view)
- Fixed creation forms to include all fields (studios: address, accounts: type/currency/initialBalance)
- Added PUT endpoints for updating dictionary items
- Removed "projects" entity entirely (DB, backend, frontend)
- Activity history logs now display in Russian
- Added 5-second polling for real-time data sync between users
- Preloaded Settings page data to eliminate loading delays
- Migrated to Replit environment
- Configured Vite proxy for API calls (frontend -> backend)
