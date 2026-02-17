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
- users, activity_logs, accounts, categories, studios, contractors, transactions, legal_entities

### API
- All frontend API calls use `/api` prefix, proxied by Vite to backend on port 3001
- Auth: POST /api/login, GET/POST/DELETE /api/users
- Transactions: POST/PUT/DELETE /api/transactions
- Dictionaries: POST/PUT/DELETE for categories, contractors, accounts, studios, legal_entities
- Init data: GET /api/init

### Default Login
- Username: grachev, Password: cd5d56a8

### Categories
- 2 types: income, expense (CategoryType in types.ts)
- Hierarchical: parent categories with subcategories (parent_id in DB)
- Tree view with collapsible parents in Directories page

### Legal Entities
- Table: legal_entities (name, inn, kpp, address, description)
- Accounts have optional legal_entity_id foreign key
- Accounts table displays linked legal entity name
- Legal entities table displays linked accounts as tags
- Full CRUD in Directories page under "Мои юрлица" tab

## Recent Changes
- Number inputs: hidden spinners (CSS), disabled mouse wheel changing values (global listener)
- Dropdown positioning: double requestAnimationFrame for correct initial placement
- FilterSelect: multi-select with checkboxes, supports selecting multiple studios/accounts/etc.
- TransactionForm: Russian validation error messages on submit
- TransactionForm: long text overflow fixed with truncation in select buttons
- Bulk actions: confirm/unconfirm/delete for selected transactions
- Selected transactions summary: footer shows count, income, expense, net total of selected
- Polling interval: 10 seconds
- Pagination: 50 transactions per page with auto-clamping
- Sidebar: PlanFact-style compact 72px fixed width, vertical icon+label layout, no hover animation, Settings pinned to bottom, teal active indicator
- Reports page: 4 tabs (ПиУ, ДДС, По статьям, По студиям)
  - P&L report: neutral white/slate palette, monthly breakdown, expandable subcategories
  - DDS report: studio-based columns, categories under Operational Flow
  - Category analysis with pie chart and percentage breakdown
  - Studio analysis with cards showing top expenses per studio
  - Excel export for P&L and DDS reports
- Unified teal color scheme
- Added "Мои юрлица" (Legal Entities) with fields: name, inn, kpp, address, description
- Accounts now link to legal entities via legal_entity_id
- Activity history: pagination, filtering, detailed before/after tracking in Russian
- Hierarchical categories with subcategories (parent/child tree view)
- XLSX import: upload file, download template, preview with validation, bulk import
- Import supports all transaction types including transfers (На счет column)
