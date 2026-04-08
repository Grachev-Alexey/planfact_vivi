import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays, ChevronDown, ChevronUp, Download, Landmark, AlertCircle, CheckCircle2, Plus, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useFinance } from '../context/FinanceContext';
import { PaymentCalendarEntryModal } from './PaymentCalendarEntryModal';
import { getMoscowNow } from '../utils/moscow';

interface PREntry {
  id: number;
  source: 'pr' | 'tx';
  amount: number;
  status: 'pending' | 'approved' | 'paid' | 'verified';
  description: string;
  username: string;
  contractorName: string;
  createdAt: string;
  paymentDate: string | null;
  accrualDate: string | null;
}

interface CategoryRow {
  id: string;
  name: string;
  days: Record<number, PREntry[]>;
}

interface AccountBalance {
  id: number;
  name: string;
  currency: string;
  balance: number;
}

interface CalendarData {
  daysInMonth: number;
  startingBalance: number;
  accountBalances: AccountBalance[];
  incomePlan: Record<number, number>;
  incomeFact: Record<number, number>;
  expensePlan: Record<number, number>;
  expenseFact: Record<number, number>;
  balance: Record<number, number>;
  expenseCategories: CategoryRow[];
}

const STATUS_CFG: Record<string, { label: string; text: string; bg: string; border: string; dot: string; pill: string }> = {
  pending:  { label: 'Ожидает',    text: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-200',   dot: 'bg-amber-500',   pill: 'bg-amber-100 text-amber-700'    },
  approved: { label: 'Утверждено', text: 'text-sky-700',     bg: 'bg-sky-50',     border: 'border-sky-200',     dot: 'bg-sky-500',     pill: 'bg-sky-100 text-sky-700'        },
  paid:     { label: 'Оплачено',   text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', dot: 'bg-emerald-500', pill: 'bg-emerald-100 text-emerald-700' },
  verified: { label: 'Проверено',  text: 'text-teal-700',    bg: 'bg-teal-50',    border: 'border-teal-200',    dot: 'bg-teal-500',    pill: 'bg-teal-100 text-teal-700'      },
};
const STATUS_FALLBACK = { label: '?', text: 'text-slate-500', bg: 'bg-slate-50', border: 'border-slate-200', dot: 'bg-slate-400', pill: 'bg-slate-100 text-slate-500' };

const MONTH_NAMES_GEN = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
const MONTH_NAMES = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const DAY_SHORT = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];

function fmtCompact(v: number | undefined): string {
  if (!v || v === 0) return '';
  const hasDecimals = v % 1 !== 0;
  if (!hasDecimals) return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(v);
  const intPart = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(Math.trunc(v));
  const decPart = Math.abs(Math.round((v % 1) * 100)).toString().padStart(2, '0');
  return `${intPart},${decPart}`;
}

function FmtWithCents({ v, className }: { v: number; className?: string }) {
  return <span className={className}>{fmtCompact(Math.abs(v)) ? ((v < 0 ? '−' : '') + fmtCompact(Math.abs(v))) : '0'}</span>;
}

function fmtFull(v: number): string {
  const hasDecimals = v % 1 !== 0;
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: hasDecimals ? 2 : 0, maximumFractionDigits: 2 }).format(v);
}


function dominantStatus(entries: PREntry[]): string {
  if (entries.some(e => e.status === 'verified')) return 'verified';
  if (entries.some(e => e.status === 'paid')) return 'paid';
  if (entries.some(e => e.status === 'approved')) return 'approved';
  return 'pending';
}

function cellTotal(entries: PREntry[]): number {
  return entries.reduce((s, e) => s + e.amount, 0);
}

const COL_W = 76;
const LABEL_W = 196;
const TOTAL_W = 84;

interface TooltipState {
  entries: PREntry[];
  catName: string;
  day: number;
  cellLeft: number;
  cellRight: number;
  cellTop: number;
  cellBottom: number;
  cellWidth: number;
}


interface ToastItem {
  id: number;
  message: string;
  type: 'success' | 'error';
  exiting: boolean;
}

function parseNum(s: string) { return parseFloat(s.replace(/\s/g, '').replace(',', '.')) || 0; }

function fmtInput(s: string): string {
  const clean = s.replace(/[^\d,.\-]/g, '');
  const parts = clean.split(/[,.]/, 2);
  const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return parts.length > 1 ? `${intPart},${parts[1]}` : intPart;
}

function rawInput(s: string): string {
  return s.replace(/\s/g, '');
}

function BalanceCheck({ system, manual }: { system: number; manual: string }) {
  if (!manual.trim()) return null;
  const m = parseNum(manual);
  const diff = system - m;
  const ok = Math.abs(diff) < 1;
  return ok ? (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full whitespace-nowrap">
      <CheckCircle2 size={9} /> ОК
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-600 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded-full whitespace-nowrap">
      <AlertCircle size={9} /> {diff > 0 ? '+' : ''}{fmtCompact(diff)}
    </span>
  );
}

interface AccountBalancesPanelProps {
  accounts: AccountBalance[];
  accountsOpen: boolean;
  setAccountsOpen: (v: boolean) => void;
  manualBalance: string;
  setManualBalance: (v: string) => void;
  perAccount: Record<number, string>;
  setPerAccountValue: (id: number, v: string) => void;
  onSaveAccountBalance: (accountId: number, value: string) => void;
  onSaveTotalBalance: (value: string) => void;
}

function AccountBalancesPanel({ accounts, accountsOpen, setAccountsOpen, manualBalance, setManualBalance, perAccount, setPerAccountValue, onSaveAccountBalance, onSaveTotalBalance }: AccountBalancesPanelProps) {
  const [showZero, setShowZero] = React.useState(false);

  const total = accounts.reduce((s, a) => s + a.balance, 0);
  const nonZero = accounts.filter(a => Math.abs(a.balance) >= 1);
  const visible = showZero ? accounts : nonZero;

  return (
    <div className="shrink-0 mx-4 lg:mx-6 mb-2">
      <button
        onClick={() => setAccountsOpen(!accountsOpen)}
        className="w-full flex items-center gap-2.5 bg-white border border-slate-200 rounded-xl px-4 py-2.5 shadow-sm hover:bg-slate-50 transition-colors text-left"
      >
        <Landmark size={14} className="text-slate-400 shrink-0" />
        <span className="text-xs font-semibold text-slate-600">Остатки на счетах</span>
        <span className={`text-sm font-bold tabular-nums ml-1 ${total < 0 ? 'text-rose-600' : 'text-slate-800'}`}>
          {fmtFull(total)}
        </span>
        {manualBalance && <BalanceCheck system={total} manual={manualBalance} />}
        <span className="ml-auto text-slate-400 shrink-0">{accountsOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}</span>
      </button>

      {accountsOpen && (
        <div className="mt-1 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          {/* Per-account rows */}
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50">
                <th className="text-left px-4 py-1.5 text-[10px] font-medium text-slate-400 uppercase tracking-wide">Счёт</th>
                <th className="text-right px-3 py-1.5 text-[10px] font-medium text-slate-400 uppercase tracking-wide">Система</th>
                <th className="text-right px-3 py-1.5 text-[10px] font-medium text-slate-400 uppercase tracking-wide" style={{ width: '140px' }}>Банк</th>
                <th className="text-right px-3 py-1.5 text-[10px] font-medium text-slate-400 uppercase tracking-wide" style={{ width: '110px' }}>Разница</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map(acc => {
                const manVal = perAccount[acc.id] ?? '';
                return (
                  <tr key={acc.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-2 text-slate-700 truncate" style={{ maxWidth: '200px' }}>{acc.name}</td>
                    <td className={`px-3 py-2 text-right font-semibold tabular-nums whitespace-nowrap ${acc.balance < 0 ? 'text-rose-600' : acc.balance === 0 ? 'text-slate-400' : 'text-slate-800'}`}>
                      {fmtFull(acc.balance)}
                    </td>
                    <td className="px-3 py-1.5" style={{ width: '140px' }}>
                      <input
                        type="text"
                        value={fmtInput(manVal)}
                        onChange={e => setPerAccountValue(acc.id, rawInput(e.target.value))}
                        onBlur={() => onSaveAccountBalance(acc.id, manVal)}
                        placeholder="—"
                        className="w-full text-[12px] tabular-nums border border-slate-200 rounded-md px-2.5 py-1 focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400 bg-white text-right transition-colors"
                      />
                    </td>
                    <td className="px-3 py-2 text-right" style={{ width: '110px' }}>
                      <BalanceCheck system={acc.balance} manual={manVal} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {accounts.length !== visible.length && (
            <div className="border-t border-slate-100 px-4 py-1.5">
              <button
                onClick={() => setShowZero(v => !v)}
                className="text-[11px] text-slate-400 hover:text-teal-600 transition-colors"
              >
                {showZero ? '↑ Скрыть нулевые' : `↓ Показать ещё ${accounts.length - nonZero.length} нулевых`}
              </button>
            </div>
          )}

          <div className="border-t border-slate-200 bg-slate-50/80">
            <table className="w-full text-[12px]">
              <tbody>
                <tr>
                  <td className="px-4 py-2.5 text-[11px] text-slate-500 font-medium">Итого по всем</td>
                  <td className={`px-3 py-2.5 text-right font-bold tabular-nums whitespace-nowrap ${total < 0 ? 'text-rose-600' : 'text-slate-800'}`}>
                    {fmtFull(total)}
                  </td>
                  <td className="px-3 py-1.5" style={{ width: '140px' }}>
                    <input
                      type="text"
                      value={fmtInput(manualBalance)}
                      onChange={e => setManualBalance(rawInput(e.target.value))}
                      onBlur={() => onSaveTotalBalance(manualBalance)}
                      placeholder="—"
                      className="w-full text-[12px] tabular-nums border border-slate-200 rounded-md px-2.5 py-1 focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400 bg-white text-right transition-colors"
                    />
                  </td>
                  <td className="px-3 py-2.5 text-right" style={{ width: '110px' }}>
                    <BalanceCheck system={total} manual={manualBalance} />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

interface SearchSelectProps {
  options: { id: string; name: string }[];
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}
function SearchSelect({ options, value, onChange, placeholder }: SearchSelectProps) {
  const [q, setQ] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const selected = options.find(o => o.id === value);
  const filtered = q ? options.filter(o => o.name.toLowerCase().includes(q.toLowerCase())) : options;

  React.useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(!open)} className="w-full text-left px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white hover:border-slate-300 truncate">
        {selected ? selected.name : <span className="text-slate-400">{placeholder}</span>}
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-auto">
          <input
            autoFocus
            type="text"
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Поиск..."
            className="w-full px-3 py-1.5 text-sm border-b border-slate-100 outline-none"
          />
          {filtered.map(o => (
            <button key={o.id} type="button" onClick={() => { onChange(o.id); setOpen(false); setQ(''); }}
              className={`w-full text-left px-3 py-1.5 text-sm hover:bg-teal-50 ${o.id === value ? 'bg-teal-50 font-medium text-teal-700' : ''}`}
            >
              {o.name}
            </button>
          ))}
          {filtered.length === 0 && <div className="px-3 py-2 text-sm text-slate-400">Не найдено</div>}
        </div>
      )}
    </div>
  );
}

function NewPaymentRequestModal({ day, month, year, userId, onClose, onSuccess }: {
  day: number; month: number; year: number; userId: string;
  onClose: () => void; onSuccess: (msg: string) => void;
}) {
  const { categories, studios, contractors, accounts } = useFinance();
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [studioId, setStudioId] = useState('');
  const [contractorId, setContractorId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const pad2 = (n: number) => String(n).padStart(2, '0');
  const paymentDate = `${year}-${pad2(month)}-${pad2(day)}`;

  const expenseCategories = categories.filter(c => c.type === 'expense');

  React.useEffect(() => {
    if (!accountId && accounts.length > 0) setAccountId(accounts[0].id);
  }, [accounts, accountId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/payment-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
        body: JSON.stringify({
          userId,
          amount: parseFloat(amount),
          categoryId: categoryId || null,
          studioId: studioId || null,
          contractorId: contractorId || null,
          accountId: accountId || null,
          description,
          paymentDate,
          accrualDate: paymentDate,
        }),
      });
      if (res.ok) {
        onSuccess(`Запрос на ${pad2(day)}.${pad2(month)} создан`);
        onClose();
      }
    } catch {
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-[9999] flex items-center justify-center" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
          <h3 className="font-bold text-slate-800">Запрос на выплату — {pad2(day)}.{pad2(month)}.{year}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Сумма *</label>
            <input
              autoFocus
              type="number"
              step="0.01"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              onWheel={e => (e.target as HTMLInputElement).blur()}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500"
              placeholder="0.00"
              required
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Статья расхода</label>
            <SearchSelect
              options={expenseCategories.map(c => ({ id: c.id, name: c.name }))}
              value={categoryId}
              onChange={setCategoryId}
              placeholder="Выберите статью"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Студия</label>
              <SearchSelect
                options={studios.map(s => ({ id: s.id, name: s.name }))}
                value={studioId}
                onChange={setStudioId}
                placeholder="Студия"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Счёт</label>
              <SearchSelect
                options={accounts.map(a => ({ id: a.id, name: a.name }))}
                value={accountId}
                onChange={setAccountId}
                placeholder="Счёт"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Контрагент</label>
            <SearchSelect
              options={contractors.map(c => ({ id: c.id, name: c.name }))}
              value={contractorId}
              onChange={setContractorId}
              placeholder="Контрагент"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Описание</label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500"
              placeholder="Описание..."
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-3 py-2.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-200">
              Отмена
            </button>
            <button type="submit" disabled={submitting || !amount} className="flex-1 px-3 py-2.5 text-sm text-white bg-teal-600 hover:bg-teal-700 rounded-lg font-medium disabled:opacity-50">
              {submitting ? 'Создаю...' : 'Создать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export const PaymentCalendar: React.FC = () => {
  const { user } = useAuth();
  const today = getMoscowNow();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [data, setData] = useState<CalendarData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [catsOpen, setCatsOpen] = useState(true);
  const [accountsOpen, setAccountsOpen] = useState(false);
  const [manualBalance, setManualBalance] = useState('');
  const [perAccountBalances, setPerAccountBalances] = useState<Record<number, string>>({});
  const [dragState, setDragState] = useState<{ catId: string; day: number; entryIds: number[] } | null>(null);
  const [dragOverDay, setDragOverDay] = useState<number | null>(null);
  const [activeCell, setActiveCell] = useState<{ catName: string; catId: string; day: number; entries: PREntry[] } | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [incomePlanManual, setIncomePlanManual] = useState<Record<number, number>>({});
  const [newPRDay, setNewPRDay] = useState<number | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const todayColRef = useRef<HTMLTableCellElement>(null);
  const dragJustEndedRef = useRef(false);
  const toastIdRef = useRef(0);

  const monthStr = `${year}-${String(month).padStart(2, '0')}`;
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth() + 1;
  const todayDay = isCurrentMonth ? today.getDate() : -1;

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await fetch(`/api/payment-calendar?month=${monthStr}`, {
        headers: { 'x-user-id': String(user?.id || '') },
      });
      if (!r.ok) throw new Error('error');
      setData(await r.json());
    } catch {
      setError('Не удалось загрузить данные');
    } finally {
      setLoading(false);
    }
  }, [monthStr, user]);

  const silentLoad = useCallback(async () => {
    try {
      const r = await fetch(`/api/payment-calendar?month=${monthStr}`, {
        headers: { 'x-user-id': String(user?.id || '') },
      });
      if (r.ok) setData(await r.json());
    } catch {}
  }, [monthStr, user]);

  const loadCalendarBalances = useCallback(async () => {
    try {
      const r = await fetch(`/api/calendar-balances?month=${monthStr}`, {
        headers: { 'x-user-id': String(user?.id || '') },
      });
      if (r.ok) {
        const data = await r.json();
        const pa: Record<number, string> = {};
        for (const [accId, val] of Object.entries(data.accounts || {})) {
          pa[Number(accId)] = String(val);
        }
        setPerAccountBalances(pa);
        setManualBalance(data.total != null ? String(data.total) : '');
      }
    } catch {}
  }, [monthStr, user]);

  const saveCalendarBalance = useCallback(async (accountId: number | null, value: string, isTotal: boolean) => {
    try {
      await fetch('/api/calendar-balances', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-user-id': String(user?.id || '') },
        body: JSON.stringify({
          month: monthStr,
          accountId: isTotal ? null : accountId,
          value: value.trim() === '' ? null : parseNum(value),
          isTotal,
        }),
      });
    } catch {}
  }, [monthStr, user]);

  const loadIncomePlan = useCallback(async () => {
    try {
      const r = await fetch(`/api/income-plan?year=${year}&month=${month}`);
      if (r.ok) setIncomePlanManual(await r.json());
    } catch {}
  }, [year, month]);

  const saveIncomePlanDay = useCallback(async (day: number, amount: number) => {
    try {
      await fetch('/api/income-plan', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year, month, day, amount }),
      });
    } catch {}
  }, [year, month]);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    const id = ++toastIdRef.current;
    setToasts(prev => [...prev, { id, message, type, exiting: false }]);
    setTimeout(() => {
      setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 220);
    }, 2800);
  }, []);

  useEffect(() => { load(); loadIncomePlan(); loadCalendarBalances(); }, [load, loadIncomePlan, loadCalendarBalances]);

  useEffect(() => {
    if (data && todayDay > 0 && todayColRef.current) {
      setTimeout(() => {
        todayColRef.current?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }, 100);
    }
  }, [data, todayDay]);

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  };
  const goToday = () => {
    setYear(today.getFullYear());
    setMonth(today.getMonth() + 1);
  };

  const days = data ? Array.from({ length: data.daysInMonth }, (_, i) => i + 1) : [];

  function showTooltip(entries: PREntry[], catName: string, day: number, e: React.MouseEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    setTooltip({ entries, catName, day, cellLeft: r.left, cellRight: r.right, cellTop: r.top, cellBottom: r.bottom, cellWidth: r.width });
  }
  function hideTooltip() { setTooltip(null); }

  function handleChipClick(entries: PREntry[], catName: string, catId: string, day: number) {
    if (dragJustEndedRef.current) return;
    hideTooltip();
    setActiveCell({ catName, catId, day, entries });
  }

  function handleDragStart(e: React.DragEvent, catId: string, day: number, entries: PREntry[]) {
    const prOnly = entries.filter(en => en.source === 'pr');
    if (prOnly.length === 0) { e.preventDefault(); return; }
    hideTooltip();
    setDragState({ catId, day, entryIds: prOnly.map(en => en.id) });
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragEnd() {
    dragJustEndedRef.current = true;
    setTimeout(() => { dragJustEndedRef.current = false; }, 200);
    setDragState(null);
    setDragOverDay(null);
  }

  function handleDragOver(e: React.DragEvent, day: number) {
    if (!dragState) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverDay !== day) setDragOverDay(day);
  }

  async function handleDrop(e: React.DragEvent, targetDay: number) {
    e.preventDefault();
    if (!dragState) return;
    const { catId, day: srcDay, entryIds: ids } = dragState;
    setDragState(null);
    setDragOverDay(null);
    if (targetDay === srcDay) return;

    // Optimistic update — move chips instantly, no re-render flash
    setData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        expenseCategories: prev.expenseCategories.map(cat => {
          if (cat.id !== catId) return cat;
          const srcEntries = cat.days[srcDay] || [];
          const moving = srcEntries.filter(en => ids.includes(en.id));
          const remaining = srcEntries.filter(en => !ids.includes(en.id));
          const targetEntries = cat.days[targetDay] || [];
          const newDays = { ...cat.days, [srcDay]: remaining, [targetDay]: [...targetEntries, ...moving] };
          if (remaining.length === 0) delete newDays[srcDay];
          return { ...cat, days: newDays };
        }),
      };
    });

    const pad2 = (n: number) => String(n).padStart(2, '0');
    const targetDate = `${year}-${pad2(month)}-${pad2(targetDay)}`;
    try {
      const r = await fetch('/api/payment-calendar/move-payment', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-user-id': String(user?.id || '') },
        body: JSON.stringify({ ids, newDate: targetDate }),
      });
      if (!r.ok) throw new Error();
      showToast(`Перенесено на ${pad2(targetDay)}.${pad2(month)}`);
      silentLoad();
    } catch {
      showToast('Не удалось перенести операцию', 'error');
      load();
    }
  }

  async function exportXlsx() {
    if (!data) return;

    const pad2 = (n: number) => String(n).padStart(2, '0');
    const dateLabel = (d: number) => `${pad2(d)}.${pad2(month)}.${year}`;
    const numDays = days.length;
    const nv = (v: number) => (v !== 0 ? v : null);

    // Fetch all expense categories
    let allCats: { id: string; name: string }[] = [];
    try {
      const r2 = await fetch('/api/initial-data', { headers: { 'x-user-id': String(user?.id || '') } });
      if (r2.ok) {
        const d2 = await r2.json();
        allCats = (d2.categories || [])
          .filter((c: any) => c.type === 'expense')
          .sort((a: any, b: any) => a.name.localeCompare(b.name, 'ru'))
          .map((c: any) => ({ id: String(c.id), name: c.name }));
      }
    } catch {}
    if (allCats.length === 0) allCats = data.expenseCategories.map(c => ({ id: c.id, name: c.name }));

    const catMap: Record<string, CategoryRow> = {};
    for (const cat of data.expenseCategories) catMap[cat.id] = cat;

    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    wb.creator = 'ViVi Finance';
    wb.created = getMoscowNow();
    const ws = wb.addWorksheet('Платёжный календарь', {
      views: [{ state: 'frozen', xSplit: 2, ySplit: 1 }],
    });
    ws.columns = [{ width: 44 }, { width: 14 }, ...days.map(() => ({ width: 12 }))];

    // ── Style helpers ──────────────────────────────────────────────────────
    type Align = 'left' | 'center' | 'right';
    const bdr = (color: string) => ({
      top:    { style: 'thin' as const, color: { argb: 'FF' + color } },
      bottom: { style: 'thin' as const, color: { argb: 'FF' + color } },
      left:   { style: 'thin' as const, color: { argb: 'FF' + color } },
      right:  { style: 'thin' as const, color: { argb: 'FF' + color } },
    });
    const fill = (color: string): any => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + color } });

    const applyCell = (
      cell: any,
      opts: {
        fg: string; textColor: string; bold?: boolean; sz?: number;
        align?: Align; numFmt?: string; wrapText?: boolean; indent?: number;
        borderColor?: string;
      }
    ) => {
      cell.font = { bold: opts.bold, color: { argb: 'FF' + opts.textColor }, size: opts.sz ?? 10 };
      cell.fill = fill(opts.fg);
      cell.alignment = {
        horizontal: opts.align ?? 'left',
        vertical: 'middle',
        wrapText: opts.wrapText,
        indent: opts.indent,
      };
      cell.border = bdr(opts.borderColor ?? 'E2E8F0');
      if (opts.numFmt) cell.numFmt = opts.numFmt;
    };

    const styleRow = (
      row: any,
      height: number,
      fn: (cell: any, colIdx: number) => void
    ) => {
      row.height = height;
      row.eachCell({ includeEmpty: true }, (cell, col) => fn(cell, col - 1));
    };

    // ── Header ─────────────────────────────────────────────────────────────
    const headerRow = ws.addRow(['Статья', 'Итого', ...days.map(d => dateLabel(d))]);
    styleRow(headerRow, 30, (cell, i) =>
      applyCell(cell, {
        fg: i === 0 ? '253447' : i === 1 ? '1C2E42' : '2D3F54',
        textColor: 'FFFFFF', bold: true, sz: i < 2 ? 10 : 9,
        align: i === 0 ? 'left' : 'center', wrapText: true,
        borderColor: '1C2E42',
      })
    );

    // ── Section helper ─────────────────────────────────────────────────────
    const addSection = (label: string, fg: string, textColor: string, borderColor: string) => {
      const row = ws.addRow([label, null, ...Array(numDays).fill(null)]);
      styleRow(row, 20, (cell) =>
        applyCell(cell, { fg, textColor, bold: true, sz: 10, align: 'left', borderColor })
      );
    };

    // ── Plan / Fact helper ─────────────────────────────────────────────────
    const addDataRow = (
      label: string,
      values: (number | null)[],
      opts: { fg: string; fgTotal: string; textColor: string; bold?: boolean; borderColor?: string }
    ) => {
      const row = ws.addRow([label, ...values]);
      styleRow(row, 18, (cell, i) =>
        applyCell(cell, {
          fg: i === 1 ? opts.fgTotal : opts.fg,
          textColor: opts.textColor, bold: opts.bold, sz: 10,
          align: i === 0 ? 'left' : 'right',
          indent: i === 0 ? 1 : 0,
          numFmt: i > 0 ? '#,##0' : undefined,
          borderColor: opts.borderColor,
        })
      );
    };

    // ── ДОХОДЫ ─────────────────────────────────────────────────────────────
    addSection('▲ ДОХОДЫ', 'ECFDF5', '065F46', 'A7F3D0');
    addDataRow('  План', [nv(totalIncomePlan), ...days.map(d => nv(incomePlanManual[d] || 0))],
      { fg: 'FFFFFF', fgTotal: 'F0FDF4', textColor: '475569' });
    addDataRow('  Неподтвержд. факт', [nv(totalIncomeUnconfirmed), ...days.map(d => nv(data.incomePlan[d] || 0))],
      { fg: 'F8FAFC', fgTotal: 'D1FAE5', textColor: '059669', borderColor: 'D1FAE5' });
    addDataRow('  Факт', [nv(totalIncomeFact), ...days.map(d => nv(data.incomeFact[d] || 0))],
      { fg: 'F8FAFC', fgTotal: 'DCFCE7', textColor: '166534', bold: true, borderColor: 'CBD5E1' });

    // ── РАСХОДЫ ────────────────────────────────────────────────────────────
    addSection('▼ РАСХОДЫ', 'FFF1F2', '881337', 'FECDD3');
    addDataRow('  План', [nv(totalExpensePlan), ...days.map(d => nv(data.expensePlan[d] || 0))],
      { fg: 'FFFFFF', fgTotal: 'FFF5F5', textColor: '475569' });
    addDataRow('  Факт', [nv(totalExpenseFact), ...days.map(d => nv(data.expenseFact[d] || 0))],
      { fg: 'F8FAFC', fgTotal: 'FFE4E6', textColor: '9F1239', bold: true, borderColor: 'FECDD3' });

    // ── БАЛАНС ─────────────────────────────────────────────────────────────
    addSection('= БАЛАНС', 'EFF6FF', '1E3A5F', 'BFDBFE');
    addDataRow('  План', [nv(totalBalancePlan), ...days.map(d => nv(balancePlan[d] || 0))],
      { fg: 'FFFFFF', fgTotal: 'EFF6FF', textColor: '3B82F6' });
    addDataRow('  Факт', [nv(totalBalance), ...days.map(d => nv(data.balance[d] || 0))],
      { fg: 'EFF6FF', fgTotal: 'DBEAFE', textColor: '1D4ED8', bold: true, borderColor: 'BFDBFE' });

    // ── Категории ──────────────────────────────────────────────────────────
    addSection('По статьям расходов', 'F1F5F9', '334155', 'CBD5E1');
    for (const cat of allCats) {
      const cd = catMap[cat.id];
      const catTot = cd ? Object.values(cd.days).flat().reduce((s, e) => s + e.amount, 0) : 0;
      const catRow = ws.addRow([
        cat.name, nv(catTot),
        ...days.map(d => { const es = cd?.days[d]; return es ? nv(cellTotal(es)) : null; }),
      ]);
      styleRow(catRow, 18, (cell, i) =>
        applyCell(cell, {
          fg: i % 2 === 0 || i === 0 ? 'FFFFFF' : 'F8FAFC',
          fgTotal: 'F8FAFC',
          textColor: i === 1 ? '1E293B' : '334155',
          bold: i === 1,
          align: i === 0 ? 'left' : 'right',
          numFmt: i > 0 ? '#,##0' : undefined,
          wrapText: i === 0,
        } as any)
      );
    }

    // ── Лист «Детализация» ────────────────────────────────────────────────
    const ws2 = wb.addWorksheet('Детализация', {
      views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }],
    });
    ws2.columns = [
      { width: 14 },  // Дата
      { width: 36 },  // Статья
      { width: 14 },  // Сумма
      { width: 14 },  // Статус
      { width: 46 },  // Назначение / описание
      { width: 28 },  // Контрагент
      { width: 20 },  // Запросил
    ];

    const STATUS_RU: Record<string, string> = {
      pending: 'Ожидает',
      approved: 'Утверждено',
      paid: 'Оплачено',
    };

    const detHdrRow = ws2.addRow(['Дата', 'Статья', 'Сумма, ₽', 'Статус', 'Назначение', 'Контрагент', 'Запросил']);
    detHdrRow.height = 28;
    detHdrRow.eachCell({ includeEmpty: true }, (cell, col) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF253447' } };
      cell.alignment = { horizontal: col === 1 ? 'center' : col === 3 ? 'right' : 'left', vertical: 'middle' };
      cell.border = bdr('1C2E42');
    });

    // Auto-filter on the header row
    ws2.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 7 } };

    const STATUS_COLOR: Record<string, string> = {
      pending: 'FFDBEAFE',
      approved: 'FFFFEDD5',
      paid: 'FFD1FAE5',
    };
    const STATUS_TEXT: Record<string, string> = {
      pending: 'FF1D4ED8',
      approved: 'FFC2410C',
      paid: 'FF065F46',
    };

    let detRowIdx = 0;
    for (const cat of data.expenseCategories) {
      for (const d of days) {
        const entries = cat.days[d];
        if (!entries || entries.length === 0) continue;
        for (const e of entries) {
          const rowData = [
            `${pad2(d)}.${pad2(month)}.${year}`,
            cat.name,
            e.amount,
            STATUS_RU[e.status] ?? e.status,
            e.description || '',
            e.contractorName || '',
            e.username || '',
          ];
          const row = ws2.addRow(rowData);
          row.height = 18;
          const rowBgColor = detRowIdx % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC';
          const statusFg = STATUS_COLOR[e.status] ?? rowBgColor;
          const statusText = STATUS_TEXT[e.status] ?? 'FF334155';
          row.eachCell({ includeEmpty: true }, (cell, col) => {
            const isStatus = col === 4;
            cell.font = {
              bold: col === 3,
              color: { argb: isStatus ? statusText : 'FF334155' },
              size: 10,
            };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isStatus ? statusFg : rowBgColor } };
            cell.alignment = {
              horizontal: col === 1 ? 'center' : col === 3 ? 'right' : 'left',
              vertical: 'middle',
              wrapText: col === 5,
            };
            cell.border = bdr('E2E8F0');
            if (col === 3) cell.numFmt = '#,##0';
          });
          detRowIdx++;
        }
      }
    }

    if (detRowIdx === 0) {
      const emptyRow = ws2.addRow(['Нет данных за выбранный период', '', '', '', '', '', '']);
      emptyRow.height = 20;
      emptyRow.getCell(1).font = { italic: true, color: { argb: 'FF94A3B8' }, size: 10 };
      emptyRow.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
    }

    // ── Download ───────────────────────────────────────────────────────────
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `план-факт-${year}-${pad2(month)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const totalIncomeUnconfirmed = days.reduce((s, d) => s + (data?.incomePlan[d] || 0), 0);
  const totalIncomePlan = days.reduce((s, d) => s + (incomePlanManual[d] || 0), 0);
  const totalIncomeFact = days.reduce((s, d) => s + (data?.incomeFact[d] || 0), 0);
  const totalExpensePlan = days.reduce((s, d) => s + (data?.expensePlan[d] || 0), 0);
  const totalExpenseFact = days.reduce((s, d) => s + (data?.expenseFact[d] || 0), 0);
  const totalBalance = (data?.startingBalance ?? 0) + totalIncomeFact - totalExpenseFact;
  const totalBalancePlan = (data?.planStartingBalance ?? data?.startingBalance ?? 0) + totalIncomePlan - totalExpensePlan;

  const startingBalance = data?.startingBalance ?? 0;

  const planStartingBalance = data?.planStartingBalance ?? startingBalance;

  const balancePlan: Record<number, number> = (() => {
    let running = planStartingBalance;
    const result: Record<number, number> = {};
    for (const d of days) {
      running += (incomePlanManual[d] || 0) - (data?.expensePlan[d] || 0);
      result[d] = running;
    }
    return result;
  })();

  const isPast = (d: number) => isCurrentMonth && d < todayDay;
  const isFuture = (d: number) => isCurrentMonth && d > todayDay;

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] overflow-hidden">
      <div className="shrink-0 px-4 lg:px-6 pt-3 pb-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarDays size={17} className="text-teal-600" />
          <h1 className="text-sm font-bold text-slate-800">Платёжный календарь</h1>
        </div>
        <div className="flex items-center gap-2">
          {data && (
            <button
              onClick={exportXlsx}
              className="flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-white hover:bg-slate-50 border border-slate-200 px-3 py-1 rounded-lg transition-colors shadow-sm"
              title="Экспорт в Excel"
            >
              <Download size={13} />
              Excel
            </button>
          )}
          {!isCurrentMonth && (
            <button
              onClick={goToday}
              className="text-xs font-medium text-teal-600 bg-teal-50 hover:bg-teal-100 border border-teal-200 px-3 py-1 rounded-lg transition-colors"
            >
              Сегодня
            </button>
          )}
          <div className="flex items-center gap-0.5 bg-white border border-slate-200 rounded-lg px-1 py-0.5 shadow-sm">
            <button onClick={prevMonth} className="p-1 hover:text-teal-600 text-slate-400 hover:bg-slate-50 rounded transition-colors">
              <ChevronLeft size={14} />
            </button>
            <span className="text-sm font-bold text-slate-700 min-w-[120px] text-center">
              {MONTH_NAMES[month - 1]} {year}
            </span>
            <button onClick={nextMonth} className="p-1 hover:text-teal-600 text-slate-400 hover:bg-slate-50 rounded transition-colors">
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="mx-4 lg:mx-6 bg-rose-50 border border-rose-200 rounded-xl p-3 text-rose-700 text-sm shrink-0">{error}</div>
      )}

      {data && (
        <AccountBalancesPanel
          accounts={data.accountBalances ?? []}
          accountsOpen={accountsOpen}
          setAccountsOpen={setAccountsOpen}
          manualBalance={manualBalance}
          setManualBalance={setManualBalance}
          perAccount={perAccountBalances}
          setPerAccountValue={(id, v) => setPerAccountBalances(prev => ({ ...prev, [id]: v }))}
          onSaveAccountBalance={(accountId, value) => saveCalendarBalance(accountId, value, false)}
          onSaveTotalBalance={(value) => saveCalendarBalance(null, value, true)}
        />
      )}

      {data && !loading && (
        <div
          ref={tableRef}
          className="calendar-scroll flex-1 overflow-auto mx-4 lg:mx-6 mb-4 rounded-xl border border-slate-200 shadow-sm bg-white"
        >
          <table className="border-separate border-spacing-0 text-[11px]" style={{ minWidth: LABEL_W + TOTAL_W + days.length * COL_W }}>
            <thead>
              <tr>
                <th
                  className="text-left px-3 py-2.5 font-semibold border-b border-r text-slate-500 border-slate-200"
                  style={{ position: 'sticky', top: 0, left: 0, zIndex: 40, width: LABEL_W, minWidth: LABEL_W, background: '#f8fafc' }}
                >
                  Статья
                </th>
                <th
                  className="text-right px-2 py-2.5 font-semibold border-b border-r text-slate-400 border-slate-200"
                  style={{ position: 'sticky', top: 0, left: LABEL_W, zIndex: 40, width: TOTAL_W, minWidth: TOTAL_W, background: '#f1f5f9' }}
                >
                  Итого
                </th>
                {days.map(d => {
                  const dow = new Date(year, month - 1, d).getDay();
                  const isToday = d === todayDay;
                  const isWeekend = dow === 0 || dow === 6;
                  const past = isPast(d);
                  return (
                    <th
                      key={d}
                      ref={isToday ? todayColRef : undefined}
                      className={`text-center py-1.5 border-b border-r border-slate-200 select-none transition-colors
                        ${dragOverDay === d && dragState
                          ? 'bg-teal-400 text-white border-teal-300'
                          : isToday
                            ? 'bg-teal-600 text-white border-teal-500'
                            : isWeekend
                              ? 'bg-slate-100 text-slate-400'
                              : past
                                ? 'bg-white text-slate-300'
                                : 'bg-white text-slate-500'
                        }`}
                      style={{ position: 'sticky', top: 0, zIndex: 20, width: COL_W, minWidth: COL_W, cursor: dragState ? 'copy' : 'pointer' }}
                      onDragOver={e => handleDragOver(e, d)}
                      onDrop={e => handleDrop(e, d)}
                      onClick={() => !dragState && setNewPRDay(d)}
                      title="Нажмите для создания запроса на выплату"
                    >
                      <div className="font-bold" style={{ fontSize: 12 }}>{d}</div>
                      <div className="opacity-70" style={{ fontSize: 9 }}>{DAY_SHORT[dow]}</div>
                      {dragState && dragOverDay === d && <div className="text-[8px] mt-0.5 opacity-80">↓ сюда</div>}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              <GroupHeader label="ДОХОДЫ" icon="↑" colSpan={days.length + 2} accent="emerald" />

              <EditableSummaryRow
                label="План"
                total={totalIncomePlan}
                days={days}
                values={incomePlanManual}
                onChange={(day, val) => {
                  setIncomePlanManual(prev => ({ ...prev, [day]: val }));
                  saveIncomePlanDay(day, val);
                }}
                todayDay={todayDay}
                textClass="text-emerald-600"
                rowBg="#ffffff"
                todayBg="#ecfdf5"
                accentColor="#86efac"
                isPast={isPast}
                isFuture={isFuture}
                labelW={LABEL_W}
                totalW={TOTAL_W}
              />
              <SummaryRow
                label="Неподтвержд. факт"
                total={totalIncomeUnconfirmed}
                days={days}
                values={data.incomePlan}
                todayDay={todayDay}
                textClass="text-teal-600"
                rowBg="#f0fdfa"
                todayBg="#ccfbf1"
                accentColor="#5eead4"
                isPast={isPast}
                isFuture={isFuture}
                labelW={LABEL_W}
                totalW={TOTAL_W}
              />
              <SummaryRow
                label="Факт"
                total={totalIncomeFact}
                days={days}
                values={data.incomeFact}
                todayDay={todayDay}
                textClass="text-emerald-700"
                rowBg="#f7fef9"
                todayBg="#d1fae5"
                bold
                accentColor="#22c55e"
                isPast={isPast}
                isFuture={isFuture}
                labelW={LABEL_W}
                totalW={TOTAL_W}
              />

              <GroupHeader label="РАСХОДЫ" icon="↓" colSpan={days.length + 2} accent="rose" />

              <SummaryRow
                label="План"
                total={totalExpensePlan}
                days={days}
                values={data.expensePlan}
                todayDay={todayDay}
                textClass="text-slate-600"
                rowBg="#ffffff"
                todayBg="#fef2f2"
                accentColor="#fca5a5"
                isPast={isPast}
                isFuture={isFuture}
                labelW={LABEL_W}
                totalW={TOTAL_W}
              />
              <SummaryRow
                label="Факт"
                total={totalExpenseFact}
                days={days}
                values={data.expenseFact}
                todayDay={todayDay}
                textClass="text-slate-700"
                rowBg="#fefafa"
                todayBg="#fce8e8"
                bold
                accentColor="#e57373"
                isPast={isPast}
                isFuture={isFuture}
                labelW={LABEL_W}
                totalW={TOTAL_W}
              />

              <GroupHeader label="ОСТАТКИ НА СЧЕТАХ" icon="=" colSpan={days.length + 2} accent="sky" />
              <BalanceRow
                label="План"
                total={totalBalancePlan}
                days={days}
                values={balancePlan}
                todayDay={todayDay}
                labelW={LABEL_W}
                totalW={TOTAL_W}
                rowBg="#ffffff"
                todayBg="#eff6ff"
                accentColor="#93c5fd"
              />
              <BalanceRow
                label="Факт"
                total={totalBalance}
                days={days}
                values={data.balance}
                todayDay={todayDay}
                labelW={LABEL_W}
                totalW={TOTAL_W}
                rowBg="#f7fbff"
                todayBg="#dbeafe"
                accentColor="#3b82f6"
                bold
              />

              {data.expenseCategories.length > 0 && (
                <tr>
                  <td
                    colSpan={2}
                    className="border-b border-slate-200 cursor-pointer select-none"
                    style={{ position: 'sticky', left: 0, zIndex: 10, background: '#f8fafc' }}
                    onClick={() => setCatsOpen(o => !o)}
                  >
                    <div className="flex items-center gap-2 px-3 py-1.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        По статьям расходов
                      </span>
                      <span className="text-[10px] text-slate-400">({data.expenseCategories.length})</span>
                      <span className="ml-auto text-slate-400">
                        {catsOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      </span>
                    </div>
                  </td>
                  <td
                    colSpan={days.length}
                    className="border-b border-slate-200 cursor-pointer"
                    style={{ background: '#f8fafc' }}
                    onClick={() => setCatsOpen(o => !o)}
                  />
                </tr>
              )}

              {catsOpen && data.expenseCategories.map((cat, catIdx) => {
                const catTotal = Object.values(cat.days).flat().reduce((s, e) => s + e.amount, 0);
                return (
                  <tr
                    key={cat.id}
                    className="border-b border-slate-100 group"
                    style={{ background: catIdx % 2 === 0 ? '#ffffff' : '#fafafa' }}
                  >
                    <td
                      className="px-3 py-1.5 border-r border-slate-200 text-slate-600 font-medium"
                      style={{ position: 'sticky', left: 0, zIndex: 10, width: LABEL_W, minWidth: LABEL_W, maxWidth: LABEL_W, background: catIdx % 2 === 0 ? '#ffffff' : '#fafafa', wordBreak: 'break-word', lineHeight: '1.3', borderLeft: '3px solid #f97316' }}
                    >
                      {cat.name}
                    </td>
                    <td
                      className="border-r border-slate-200 text-right px-2 py-1.5 text-slate-500 font-semibold"
                      style={{ position: 'sticky', left: LABEL_W, zIndex: 10, width: TOTAL_W, minWidth: TOTAL_W, background: catIdx % 2 === 0 ? '#f8fafc' : '#f1f5f9' }}
                    >
                      {catTotal > 0 ? fmtCompact(catTotal) : ''}
                    </td>
                    {days.map(d => {
                      const entries = cat.days[d];
                      const isToday = d === todayDay;
                      const past = isPast(d);
                      const isDropTarget = dragOverDay === d && dragState;
                      if (!entries || entries.length === 0) {
                        return (
                          <td
                            key={d}
                            className={`border-r border-slate-100 transition-colors ${
                              isDropTarget ? 'bg-teal-100 border-teal-300' : isToday ? 'bg-teal-50/40' : ''
                            }`}
                            style={{ width: COL_W, minWidth: COL_W, cursor: dragState ? 'copy' : 'default' }}
                            onDragOver={e => handleDragOver(e, d)}
                            onDrop={e => handleDrop(e, d)}
                          />
                        );
                      }
                      const dom = dominantStatus(entries);
                      const cfg = STATUS_CFG[dom] || STATUS_FALLBACK;
                      const total = cellTotal(entries);
                      const statuses = [...new Set(entries.map(e => e.status))];
                      return (
                        <td
                          key={d}
                          className={`border-r border-slate-100 transition-colors ${
                            isDropTarget ? 'bg-teal-100 border-teal-300' : isToday ? 'bg-teal-50/40' : ''
                          }`}
                          style={{ width: COL_W, minWidth: COL_W, opacity: past ? 0.75 : 1, cursor: dragState ? 'copy' : 'default' }}
                          onDragOver={e => handleDragOver(e, d)}
                          onDrop={e => handleDrop(e, d)}
                        >
                          <div
                            className={`mx-0.5 my-0.5 rounded-md px-1 py-0.5 select-none
                              ${cfg.bg} border ${cfg.border} hover:shadow-md transition-shadow
                              ${dragState?.catId === cat.id && dragState?.day === d ? 'opacity-30 scale-95' : ''}
                            `}
                            style={{ cursor: dragState ? 'grabbing' : 'grab' }}
                            draggable
                            onDragStart={e => handleDragStart(e, cat.id, d, entries)}
                            onDragEnd={handleDragEnd}
                            onMouseEnter={e => !dragState && showTooltip(entries, cat.name, d, e)}
                            onMouseLeave={hideTooltip}
                            onClick={() => handleChipClick(entries, cat.name, cat.id, d)}
                          >
                            <div className={`font-bold text-center leading-tight ${cfg.text}`} style={{ fontSize: 10 }}>
                              {fmtCompact(total)}
                            </div>
                            <div className="flex justify-center items-center gap-0.5 mt-0.5">
                              {statuses.map(s => (
                                <span key={s} className={`w-1 h-1 rounded-full ${(STATUS_CFG[s] || STATUS_FALLBACK).dot}`} />
                              ))}
                              {entries.length > 1 && (
                                <span className={`text-[8px] font-bold leading-none opacity-70 ${cfg.text}`}>×{entries.length}</span>
                              )}
                            </div>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {loading && !data && (
        <div className="flex-1 mx-4 lg:mx-6 mb-4 rounded-xl border border-slate-200 bg-white overflow-hidden animate-pulse">
          <div className="h-10 bg-[#1e2a38]" />
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-9 border-b border-slate-100 flex">
              <div style={{ width: LABEL_W + TOTAL_W }} className="bg-slate-50 border-r border-slate-100" />
              <div className="flex-1" />
            </div>
          ))}
        </div>
      )}

      {activeCell && (
        <PaymentCalendarEntryModal
          catName={activeCell.catName}
          day={activeCell.day}
          month={month}
          year={year}
          entries={activeCell.entries}
          userId={user?.id || ''}
          onClose={() => setActiveCell(null)}
          onRefresh={silentLoad}
          onSuccess={showToast}
        />
      )}

      {newPRDay !== null && (
        <NewPaymentRequestModal
          day={newPRDay}
          month={month}
          year={year}
          userId={user?.id || ''}
          onClose={() => setNewPRDay(null)}
          onSuccess={(msg) => { showToast(msg); silentLoad(); }}
        />
      )}

      {toasts.length > 0 && (
        <div className="fixed bottom-5 right-5 flex flex-col gap-2 z-[99999] pointer-events-none">
          {toasts.map(t => (
            <div
              key={t.id}
              className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl shadow-lg border text-sm font-medium
                ${t.type === 'success'
                  ? 'bg-white border-emerald-200 text-emerald-800'
                  : 'bg-white border-rose-200 text-rose-700'}
                ${t.exiting ? 'toast-exit' : 'toast-enter'}
              `}
            >
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${t.type === 'success' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
              {t.message}
            </div>
          ))}
        </div>
      )}

      {tooltip && (() => {
        const TIP_W = 260;
        const TIP_MAX_H = 300;
        const GAP = 6;
        const spaceBelow = window.innerHeight - tooltip.cellBottom - GAP;
        const spaceAbove = tooltip.cellTop - GAP;
        const showBelow = spaceBelow >= 120 || spaceBelow >= spaceAbove;
        const tipTop = showBelow
          ? tooltip.cellBottom + GAP
          : tooltip.cellTop - GAP - Math.min(TIP_MAX_H, spaceAbove);
        const tipCenter = tooltip.cellLeft + tooltip.cellWidth / 2;
        const tipLeft = Math.max(8, Math.min(tipCenter - TIP_W / 2, window.innerWidth - TIP_W - 8));
        return (
        <div
          className="fixed z-[9999] bg-white border border-slate-200 rounded-xl shadow-xl pointer-events-none flex flex-col tooltip-popup"
          style={{
            left: tipLeft,
            top: tipTop,
            width: TIP_W,
            maxHeight: showBelow ? Math.min(TIP_MAX_H, spaceBelow) : Math.min(TIP_MAX_H, spaceAbove),
          }}
        >
          <div className="px-3 py-2 border-b border-slate-100 bg-slate-50 rounded-t-xl flex-shrink-0">
            <div className="text-[11px] font-bold text-slate-600">{tooltip.catName}</div>
            <div className="text-[10px] text-slate-400">{tooltip.day} {MONTH_NAMES_GEN[month - 1]} {year}</div>
          </div>
          <div className="p-3 space-y-2 overflow-y-auto flex-1 min-h-0">
            {tooltip.entries.slice(0, 5).map((entry, i) => {
              const cfg = STATUS_CFG[entry.status] || STATUS_FALLBACK;
              return (
                <div key={`${entry.source}:${entry.id}`} className={`${i > 0 ? 'pt-2 border-t border-slate-100' : ''}`}>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${cfg.pill}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                      {cfg.label}
                    </span>
                    <span className="text-xs font-bold text-slate-800">{fmtFull(entry.amount)}</span>
                  </div>
                  {entry.description && (
                    <p className="text-[11px] text-slate-600 leading-snug">{entry.description}</p>
                  )}
                  <div className="flex gap-2 mt-0.5 flex-wrap">
                    {entry.contractorName && (
                      <span className="text-[10px] text-slate-400">{entry.contractorName}</span>
                    )}
                    {entry.username && (
                      <span className="text-[10px] text-slate-400">· {entry.username}</span>
                    )}
                  </div>
                </div>
              );
            })}
            {tooltip.entries.length > 5 && (
              <div className="pt-2 border-t border-slate-100 text-center">
                <span className="text-[10px] text-slate-400 italic">и ещё {tooltip.entries.length - 5} операций…</span>
              </div>
            )}
            {tooltip.entries.length > 1 && (
              <div className="pt-2 border-t border-slate-100 flex justify-between items-center">
                <span className="text-[10px] text-slate-400">Итого</span>
                <span className="text-xs font-bold text-slate-700">{fmtFull(cellTotal(tooltip.entries))}</span>
              </div>
            )}
          </div>
        </div>
        );
      })()}
    </div>
  );
};

interface GroupHeaderProps {
  label: string;
  icon: string;
  colSpan: number;
  accent: 'emerald' | 'rose' | 'sky';
}
const GROUP_ACCENT = {
  emerald: { color: '#34d399' },
  rose:    { color: '#fb7185' },
  sky:     { color: '#60a5fa' },
};
const GroupHeader: React.FC<GroupHeaderProps> = ({ label, icon, colSpan, accent }) => (
  <tr>
    <td
      colSpan={2}
      className="text-[10px] font-bold uppercase tracking-widest"
      style={{
        position: 'sticky', left: 0, zIndex: 10,
        background: '#f8fafc',
        borderLeft: `3px solid ${GROUP_ACCENT[accent].color}`,
        borderBottom: '1px solid #e2e8f0',
        borderTop: '1px solid #e2e8f0',
        padding: '5px 10px',
        color: '#64748b',
      }}
    >
      <span style={{ color: GROUP_ACCENT[accent].color, marginRight: 4 }}>{icon}</span>{label}
    </td>
    <td
      colSpan={colSpan - 2}
      style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', borderTop: '1px solid #e2e8f0' }}
    />
  </tr>
);

interface SummaryRowProps {
  label: string;
  total: number;
  days: number[];
  values: Record<number, number>;
  todayDay: number;
  textClass: string;
  rowBg: string;
  todayBg: string;
  bold?: boolean;
  accentColor: string;
  isPast: (d: number) => boolean;
  isFuture: (d: number) => boolean;
  labelW: number;
  totalW: number;
}
const SummaryRow: React.FC<SummaryRowProps> = ({
  label, total, days, values, todayDay, textClass, rowBg, todayBg, bold, accentColor, isPast, labelW, totalW
}) => (
  <tr className="border-b border-slate-100" style={{ background: rowBg }}>
    <td
      className="px-3 py-1.5 border-r border-slate-200 text-slate-600"
      style={{ position: 'sticky', left: 0, zIndex: 10, width: labelW, minWidth: labelW, fontWeight: bold ? 600 : 400, background: rowBg, borderLeft: `3px solid ${accentColor}` }}
    >
      {label}
    </td>
    <td
      className="border-r border-slate-200 text-right px-2 py-1.5"
      style={{ position: 'sticky', left: labelW, zIndex: 10, width: totalW, minWidth: totalW, background: rowBg }}
    >
      {total ? <FmtWithCents v={total} className={`${textClass} ${bold ? 'font-bold' : 'font-medium'}`} /> : <span className="text-slate-400">—</span>}
    </td>
    {days.map(d => {
      const v = values[d] || 0;
      const isToday = d === todayDay;
      const past = isPast(d);
      return (
        <td
          key={d}
          className="border-r border-slate-100 text-center py-1.5 px-0.5"
          style={{ background: isToday ? todayBg : rowBg, opacity: past && !v ? 0.4 : 1 }}
        >
          {v > 0 && (
            <FmtWithCents v={v} className={`${textClass} ${bold ? 'font-bold' : 'font-medium'}`} />
          )}
        </td>
      );
    })}
  </tr>
);

interface EditableSummaryRowProps extends SummaryRowProps {
  onChange: (day: number, value: number) => void;
}
const EditableSummaryRow: React.FC<EditableSummaryRowProps> = ({
  label, total, days, values, todayDay, textClass, rowBg, todayBg, bold, accentColor, isPast, labelW, totalW, onChange
}) => {
  const [editing, setEditing] = React.useState<number | null>(null);
  const [draft, setDraft] = React.useState('');

  function startEdit(d: number) {
    setEditing(d);
    setDraft(values[d] ? String(values[d]) : '');
  }
  function commit(d: number) {
    const v = parseFloat(draft.replace(/\s/g, '').replace(',', '.')) || 0;
    onChange(d, v);
    setEditing(null);
  }
  return (
    <tr className="border-b border-slate-100" style={{ background: rowBg }}>
      <td
        className="px-3 py-1.5 border-r border-slate-200 text-slate-600"
        style={{ position: 'sticky', left: 0, zIndex: 10, width: labelW, minWidth: labelW, fontWeight: bold ? 600 : 400, background: rowBg, borderLeft: `3px solid ${accentColor}` }}
      >
        {label}
      </td>
      <td
        className="border-r border-slate-200 text-right px-2 py-1.5"
        style={{ position: 'sticky', left: labelW, zIndex: 10, width: totalW, minWidth: totalW, background: rowBg }}
      >
        <span className={`${textClass} ${bold ? 'font-bold' : 'font-medium'}`}>
          {total ? fmtCompact(total) : '—'}
        </span>
      </td>
      {days.map(d => {
        const v = values[d] || 0;
        const isToday = d === todayDay;
        const past = isPast(d);
        const isEdit = editing === d;
        return (
          <td
            key={d}
            className="border-r border-slate-100 text-center py-1 px-0.5"
            style={{ background: isToday ? todayBg : rowBg, opacity: past && !v ? 0.4 : 1 }}
          >
            {isEdit ? (
              <input
                autoFocus
                type="text"
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onBlur={() => commit(d)}
                onKeyDown={e => { if (e.key === 'Enter') commit(d); if (e.key === 'Escape') setEditing(null); }}
                className="w-full text-center border-0 border-b border-emerald-400 outline-none bg-emerald-50 rounded text-emerald-700 font-medium"
                style={{ fontSize: 10, padding: '1px 2px' }}
              />
            ) : (
              <button
                onClick={() => startEdit(d)}
                className="w-full text-center rounded hover:bg-emerald-50 transition-colors group"
                style={{ minHeight: 20 }}
                title="Нажмите для ввода плана"
              >
                {v > 0 ? (
                  <span className={`${textClass} ${bold ? 'font-bold' : 'font-medium'}`} style={{ fontSize: 11 }}>
                    {fmtCompact(v)}
                  </span>
                ) : (
                  <span className="text-slate-200 group-hover:text-emerald-300 transition-colors" style={{ fontSize: 10 }}>+</span>
                )}
              </button>
            )}
          </td>
        );
      })}
    </tr>
  );
};

interface BalanceRowProps {
  label: string;
  total: number;
  days: number[];
  values: Record<number, number>;
  todayDay: number;
  labelW: number;
  totalW: number;
  rowBg?: string;
  todayBg?: string;
  accentColor?: string;
  bold?: boolean;
}
const BalanceRow: React.FC<BalanceRowProps> = ({
  label, total, days, values, todayDay, labelW, totalW,
  rowBg = '#f8fafc', todayBg = '#e0f2fe', accentColor = '#64748b', bold = false
}) => (
  <tr className="border-b border-slate-200" style={{ background: rowBg }}>
    <td
      className="px-3 py-1.5 border-r border-slate-200 text-slate-700"
      style={{ position: 'sticky', left: 0, zIndex: 10, width: labelW, minWidth: labelW, background: rowBg, fontWeight: bold ? 700 : 400, borderLeft: `3px solid ${accentColor}` }}
    >
      {label}
    </td>
    <td
      className="border-r border-slate-200 text-right px-2 py-1.5"
      style={{ position: 'sticky', left: labelW, zIndex: 10, width: totalW, minWidth: totalW, background: rowBg, fontWeight: bold ? 700 : 600 }}
    >
      <FmtWithCents v={total} className={total >= 0 ? 'text-slate-700' : 'text-slate-700'} />
    </td>
    {days.map(d => {
      const v = values[d] ?? 0;
      const isToday = d === todayDay;
      return (
        <td
          key={d}
          className="border-r border-slate-100 text-center py-1.5 px-0.5"
          style={{ background: isToday ? todayBg : rowBg }}
        >
          {v !== 0 && (
            <FmtWithCents
              v={v}
              className={`text-[11px] ${v >= 0 ? 'text-slate-600' : 'text-rose-500'}`}
            />
          )}
        </td>
      );
    })}
  </tr>
);
