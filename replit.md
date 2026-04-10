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
- **Database**: PostgreSQL (external)
- **Server files**: Located in `server/` directory with `.cjs` extension
- **Timezone**: All dates/times use Moscow time (UTC+3) exclusively. DB session timezone set to 'Europe/Moscow'. Server uses `getMoscowNow()`/`getMoscowToday()` from `server/utils/moscow.cjs`. Frontend uses same from `utils/moscow.ts`. Never use bare `new Date()` for business dates.

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
- users (+ studio_id for master role), activity_logs, accounts, categories, studios, contractors, transactions, legal_entities, payment_requests, master_incomes, credit_date_rules, auto_transfer_rules, holidays
- **transactions.credit_date**: DATE field for income transactions — actual date when money is credited to the bank account (may differ from transaction date). Used in all balance calculations via `COALESCE(t.credit_date, t.date)`.
- **credit_date_rules**: Per-account rules for auto-calculating credit_date (delay_days, weekend_rule: next_business_day|saturday_ok|previous_business_day|no_adjustment)
- **auto_transfer_rules**: Automatic transfer rules between accounts (schedule, skip_weekends, amount or transfer_all)
- **holidays**: Russian holidays/non-working days (date, name, affects_credit). Used by credit date calculation — if affects_credit=true, the day is treated like a weekend for date shifting. Holidays are cached server-side (5min TTL). UI supports year-by-year management and bulk pre-fill of standard Russian public holidays.
- **calendar_balances**: Per-account manual balance entries for payment calendar (account_id, month, manual_balance). Persisted on blur so admins can compare system vs actual bank balances.
- **calendar_balances_total**: Total manual balance per month for payment calendar reconciliation.
- **settlement_rules**: Rules mapping technical accounts → real bank settlement accounts (account_id, category_id, studio_id, settlement_account_id, enabled). More specific rules (with category+studio) take priority.
- **transactions.settlement_account_id**: FK to accounts — the real bank account where income money is credited. Informational only, does not affect balance calculations. Auto-resolved from settlement_rules on create/update.

### Reconciliation Page
- **Route**: `/reconciliation` (admin only), sidebar icon "Сверка"
- **Purpose**: Daily bank statement reconciliation for settlement (real) accounts
- **Backend**: `server/routes/reconciliation.cjs` — GET `/api/reconciliation` (params: settlementAccountId, startDate, endDate), GET `/api/reconciliation/accounts`
- **Frontend**: `components/ReconciliationPage.tsx`
- **Logic**: Income counted by credit_date (all statuses), expenses only paid/verified, transfers only confirmed. Shows opening/closing balance per day with expandable transaction details.
- **Settlement rules mass-apply**: POST `/api/settlement-rules/apply-all` — backfills settlement_account_id for all existing income transactions

### Transaction Features
- **Daily totals**: Transaction list shows per-day income/expense/net totals in the day group header
- **Income "Проверено" status**: Income transactions can be marked as "verified" (status='verified'). Shown as a teal badge. Filterable via "income_verified" filter option. Bulk action available.
- **Payment calendar day click**: Clicking a day header in payment calendar opens a form to create a payment request pre-filled with that date

### API
- All frontend API calls use `/api` prefix, proxied by Vite to backend on port 3001
- Auth: POST /api/login, GET/POST/DELETE /api/users
- Transactions: POST/PUT/DELETE /api/transactions
- Dictionaries: POST/PUT/DELETE for categories, contractors, accounts, studios, legal_entities
- Payment Requests: GET/POST/PUT/DELETE /api/payment-requests
- Master Incomes: GET/POST /api/master-incomes, GET /api/master-incomes/stats
- Init data: GET /api/init

### User Roles
- admin: full access to all features
- user: full access to all features
- requester: can only create payment requests and view their own request history
- master: tied to a specific studio, can only create income entries via standalone page (/master), has dashboard with KPIs

### Payment Requests
- Table: payment_requests (user_id, amount, category_id, studio_id, contractor_id, description, status, payment_date, accrual_date, account_id, paid_at)
- Status values: pending, paid, rejected
- Webhook: POST to https://vivi-stats.store/webhook/planfact on create/paid/rejected
- Requester users see a standalone page with form and history (no sidebar)
- Admins see payment requests via sidebar "Выплаты" button
- When admin marks request as "paid", selects account and an expense transaction is automatically created in transactions table
- Form fields: amount, category (searchable), studio (searchable), contractor (searchable + create new), payment_date, accrual_date, description

### Default Login
- Username: grachev, Password: cd5d56a8

### Categories
- 2 types: income, expense (CategoryType in types.ts)
- Hierarchical: unlimited nesting depth (parent_id in DB), e.g. root → child → grandchild
- Recursive tree view with collapsible nodes at any depth in Directories page
- Add/edit forms show full category tree with indentation in parent dropdown
- Edit form prevents circular references (excludes self and all descendants from parent options)

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
- Added favicon (public/favicon.png) with apple-touch-icon support
- Full mobile responsiveness across all pages:
  - Sidebar: hamburger menu on mobile, slide-in drawer with overlay, auto-close on navigation
  - TopBar: adapts to mobile width, hides username on small screens
  - Layout: removes sidebar margin on mobile
  - TransactionList: mobile filter drawer toggle, stacking header, compact bulk actions
  - Dashboard: stacking metrics/charts vertically on mobile, responsive text/padding
  - Settings: horizontally scrollable tables on mobile
  - Reports: scrollable tabs, responsive date selectors
  - Modal: responsive padding and title sizing
- Performance: memoized TransactionRow component, lookup Maps instead of .find() for O(1) access
- Optimistic updates: transactions appear/update/delete instantly in UI
- YClients verification: multi-signal matching engine with visit grouping
  - Records grouped by visit_id (one visit = multiple services/transactions)
  - Matching signals: client name (from description or contractor), phone, contractor_phone, amount (exact/subset/close), goods_exact
  - Service AND goods/product subset matching via dynamic programming (handles multi-payment visits + product sales/абонементы)
  - goods_transactions from YClients records are included in visit totals and subset matching
  - Statuses: match (name+amount), weak_match (amount only), amount_mismatch (name but not amount), not_found
  - Frontend shows matched signals as tags, all visit services/goods, and matched subset
  - Contractors have phone field used as high-priority matching signal (score 150)
  - Master income account resolution returns error if account not found
- Master Dashboard: tab-based navigation (Записи / Показатели) with KPI cards (Выручка, Клиенты, Средний чек, Визитов), primary/regular client split bar, daily revenue chart (recharts), payment type breakdown, category breakdown, custom calendar period picker (month view, click range selection), period buttons (Сегодня/Неделя/Месяц/Период)
- Zero-amount visits: visits with totalAmount=0 (abonement or free procedure) show "Отметить визит" button, save master_income with amount=0 and payment_type='visit_only', no transaction created. Dashboard shows totalVisits (unique visit count) and zeroVisits subtext.
- Abonement data: services with paid_abonements_count > 0 are tagged paidByAbonement. goods_transactions always included with cost field. Schedule view shows colored tags: violet for abonement-paid services, teal for goods/abonements. Visit counts use DISTINCT on visitId/recordIds to avoid double-counting multi-payment visits.
- Settlement accounts (Счета зачисления): income transactions now track which real bank account money is credited to
  - DB: settlement_rules table maps technical accounts → real settlement accounts by account/category/studio specificity
  - DB: transactions.settlement_account_id stores the resolved settlement account
  - Backend: auto-resolves settlement account on create AND update (re-resolves when account/category/studio changes)
  - Backend: POST /api/settlement-rules/resolve endpoint for frontend live preview
  - Frontend TransactionForm: shows "Счет зачисления" field for income (read-only, auto-resolved from rules)
  - Frontend TransactionRow: shows "→ {settlement account name}" under the account name for income transactions
  - Settings → Правила → "Счета зачисления" tab: full CRUD for settlement rules with enable/disable, category/studio filtering
  - Does NOT affect balance calculations (informational only, for future admin reconciliation page)
