import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface PREntry {
  id: number;
  amount: number;
  status: 'pending' | 'approved' | 'paid';
  description: string;
  username: string;
  contractorName: string;
  createdAt: string;
}

interface CategoryRow {
  id: string;
  name: string;
  days: Record<number, PREntry[]>;
}

interface CalendarData {
  daysInMonth: number;
  incomePlan: Record<number, number>;
  incomeFact: Record<number, number>;
  expensePlan: Record<number, number>;
  expenseFact: Record<number, number>;
  balance: Record<number, number>;
  expenseCategories: CategoryRow[];
}

const STATUS_CFG = {
  pending:  { label: 'Ожидает',   text: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-200',   dot: 'bg-blue-500',   pill: 'bg-blue-100 text-blue-700'   },
  approved: { label: 'Утверждён', text: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200', dot: 'bg-orange-500', pill: 'bg-orange-100 text-orange-700' },
  paid:     { label: 'Оплачен',   text: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-200',  dot: 'bg-green-500',  pill: 'bg-green-100 text-green-700'   },
};

const MONTH_NAMES_GEN = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
const MONTH_NAMES = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const DAY_SHORT = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];

function fmtCompact(v: number | undefined): string {
  if (!v || v === 0) return '';
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(v);
}

function fmtFull(v: number): string {
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(v);
}


function dominantStatus(entries: PREntry[]): 'pending' | 'approved' | 'paid' {
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
  clientX: number;
  clientY: number;
}


export const PaymentCalendar: React.FC = () => {
  const { user } = useAuth();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [data, setData] = useState<CalendarData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [catsOpen, setCatsOpen] = useState(true);
  const tableRef = useRef<HTMLDivElement>(null);
  const todayColRef = useRef<HTMLTableCellElement>(null);

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

  useEffect(() => { load(); }, [load]);

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

  function showTooltip(entries: PREntry[], catName: string, day: number, e: React.MouseEvent) {
    setTooltip({ entries, catName, day, clientX: e.clientX, clientY: e.clientY });
  }
  function moveTooltip(e: React.MouseEvent) {
    if (tooltip) setTooltip(t => t ? { ...t, clientX: e.clientX, clientY: e.clientY } : null);
  }
  function hideTooltip() { setTooltip(null); }

  const totalIncomePlan = days.reduce((s, d) => s + (data?.incomePlan[d] || 0), 0);
  const totalIncomeFact = days.reduce((s, d) => s + (data?.incomeFact[d] || 0), 0);
  const totalExpensePlan = days.reduce((s, d) => s + (data?.expensePlan[d] || 0), 0);
  const totalExpenseFact = days.reduce((s, d) => s + (data?.expenseFact[d] || 0), 0);
  const totalBalance = totalIncomeFact - totalExpenseFact;

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

      {data && !loading && (
        <div
          ref={tableRef}
          className="flex-1 overflow-auto mx-4 lg:mx-6 mb-4 rounded-xl border border-slate-200 shadow-sm bg-white"
        >
          <table className="border-separate border-spacing-0 text-[11px]" style={{ minWidth: LABEL_W + TOTAL_W + days.length * COL_W }}>
            <thead>
              <tr className="sticky top-0 z-20">
                <th
                  className="sticky left-0 z-30 text-left px-3 py-2.5 font-semibold border-b border-r text-slate-200 border-slate-600"
                  style={{ width: LABEL_W, minWidth: LABEL_W, background: '#1e2a38' }}
                >
                  Статья
                </th>
                <th
                  className="sticky z-30 text-right px-2 py-2.5 font-semibold border-b border-r text-slate-300 border-slate-600"
                  style={{ left: LABEL_W, width: TOTAL_W, minWidth: TOTAL_W, background: '#253244' }}
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
                      className={`text-center py-1.5 border-b border-r border-slate-200 select-none
                        ${isToday
                          ? 'bg-teal-600 text-white border-teal-500'
                          : isWeekend
                            ? 'bg-slate-100 text-slate-400'
                            : past
                              ? 'bg-white text-slate-300'
                              : 'bg-white text-slate-500'
                        }`}
                      style={{ width: COL_W, minWidth: COL_W }}
                    >
                      <div className="font-bold" style={{ fontSize: 12 }}>{d}</div>
                      <div className="opacity-70" style={{ fontSize: 9 }}>{DAY_SHORT[dow]}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              <GroupHeader label="ДОХОДЫ" icon="↑" colSpan={days.length + 2} accent="emerald" />

              <SummaryRow
                label="План"
                total={totalIncomePlan}
                days={days}
                values={data.incomePlan}
                todayDay={todayDay}
                textClass="text-emerald-500"
                rowBg="#f0fdf4"
                todayBg="#bbf7d0"
                accentColor="#4ade80"
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
                rowBg="#dcfce7"
                todayBg="#86efac"
                bold
                accentColor="#16a34a"
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
                textClass="text-rose-400"
                rowBg="#fff1f2"
                todayBg="#fecdd3"
                accentColor="#f87171"
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
                textClass="text-rose-700"
                rowBg="#ffe4e6"
                todayBg="#fda4af"
                bold
                accentColor="#dc2626"
                isPast={isPast}
                isFuture={isFuture}
                labelW={LABEL_W}
                totalW={TOTAL_W}
              />

              <BalanceRow
                label="Остаток"
                total={totalBalance}
                days={days}
                values={data.balance}
                todayDay={todayDay}
                labelW={LABEL_W}
                totalW={TOTAL_W}
              />

              {data.expenseCategories.length > 0 && (
                <tr>
                  <td
                    colSpan={2}
                    className="sticky left-0 z-10 border-b border-slate-200 cursor-pointer select-none"
                    style={{ background: '#f8fafc' }}
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
                      className="sticky left-0 z-10 px-3 py-1.5 border-r border-slate-200 text-slate-600 font-medium"
                      style={{ width: LABEL_W, minWidth: LABEL_W, maxWidth: LABEL_W, background: catIdx % 2 === 0 ? '#ffffff' : '#fafafa', wordBreak: 'break-word', lineHeight: '1.3', borderLeft: '3px solid #f97316' }}
                    >
                      {cat.name}
                    </td>
                    <td
                      className="sticky z-10 border-r border-slate-200 text-right px-2 py-1.5 text-slate-500 font-semibold"
                      style={{ left: LABEL_W, width: TOTAL_W, minWidth: TOTAL_W, background: catIdx % 2 === 0 ? '#f8fafc' : '#f1f5f9' }}
                    >
                      {catTotal > 0 ? fmtCompact(catTotal) : ''}
                    </td>
                    {days.map(d => {
                      const entries = cat.days[d];
                      const isToday = d === todayDay;
                      const past = isPast(d);
                      if (!entries || entries.length === 0) {
                        return (
                          <td
                            key={d}
                            className={`border-r border-slate-100 ${isToday ? 'bg-teal-50/40' : ''}`}
                            style={{ width: COL_W, minWidth: COL_W }}
                          />
                        );
                      }
                      const dom = dominantStatus(entries);
                      const cfg = STATUS_CFG[dom];
                      const total = cellTotal(entries);
                      const statuses = [...new Set(entries.map(e => e.status))];
                      return (
                        <td
                          key={d}
                          className={`border-r border-slate-100 ${isToday ? 'bg-teal-50/40' : ''}`}
                          style={{ width: COL_W, minWidth: COL_W, opacity: past ? 0.75 : 1 }}
                        >
                          <div
                            className={`mx-0.5 my-0.5 rounded-md px-1 py-0.5 cursor-default select-none
                              ${cfg.bg} border ${cfg.border} hover:shadow-md hover:scale-105 transition-all`}
                            onMouseEnter={e => showTooltip(entries, cat.name, d, e)}
                            onMouseMove={moveTooltip}
                            onMouseLeave={hideTooltip}
                          >
                            <div className={`font-bold text-center leading-tight ${cfg.text}`} style={{ fontSize: 10 }}>
                              {fmtCompact(total)}
                            </div>
                            {statuses.length > 1 && (
                              <div className="flex justify-center gap-0.5 mt-0.5">
                                {statuses.map(s => (
                                  <span key={s} className={`w-1 h-1 rounded-full ${STATUS_CFG[s as keyof typeof STATUS_CFG].dot}`} />
                                ))}
                              </div>
                            )}
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

      {tooltip && (
        <div
          className="fixed z-[9999] bg-white border border-slate-200 rounded-xl shadow-2xl pointer-events-none"
          style={{
            left: Math.min(tooltip.clientX + 14, window.innerWidth - 260),
            top: Math.min(tooltip.clientY + 14, window.innerHeight - 220),
            width: 248,
          }}
        >
          <div className="px-3 py-2 border-b border-slate-100 bg-slate-50 rounded-t-xl">
            <div className="text-[11px] font-bold text-slate-600">{tooltip.catName}</div>
            <div className="text-[10px] text-slate-400">{tooltip.day} {MONTH_NAMES_GEN[month - 1]} {year}</div>
          </div>
          <div className="p-3 space-y-2">
            {tooltip.entries.map((entry, i) => {
              const cfg = STATUS_CFG[entry.status];
              return (
                <div key={entry.id} className={`${i > 0 ? 'pt-2 border-t border-slate-100' : ''}`}>
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
            {tooltip.entries.length > 1 && (
              <div className="pt-2 border-t border-slate-100 flex justify-between items-center">
                <span className="text-[10px] text-slate-400">Итого</span>
                <span className="text-xs font-bold text-slate-700">{fmtFull(cellTotal(tooltip.entries))}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

interface GroupHeaderProps {
  label: string;
  icon: string;
  colSpan: number;
  accent: 'emerald' | 'rose';
}
const GroupHeader: React.FC<GroupHeaderProps> = ({ label, icon, colSpan, accent }) => (
  <tr>
    <td
      colSpan={2}
      className={`sticky left-0 z-10 border-b border-t px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest
        ${accent === 'emerald'
          ? 'bg-emerald-600 text-white border-emerald-700'
          : 'bg-rose-600 text-white border-rose-700'}`}
    >
      {icon} {label}
    </td>
    <td
      colSpan={colSpan - 2}
      className={`border-b border-t
        ${accent === 'emerald'
          ? 'bg-emerald-600 border-emerald-700'
          : 'bg-rose-600 border-rose-700'}`}
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
      className="sticky left-0 z-10 px-3 py-2 border-r border-slate-200 text-slate-600"
      style={{ width: labelW, minWidth: labelW, fontWeight: bold ? 600 : 400, background: rowBg, borderLeft: `3px solid ${accentColor}` }}
    >
      {label}
    </td>
    <td
      className="sticky z-10 border-r border-slate-200 text-right px-2 py-2"
      style={{ left: labelW, width: totalW, minWidth: totalW, background: rowBg }}
    >
      <span className={`${textClass} ${bold ? 'font-bold' : 'font-medium'}`}>
        {total ? fmtCompact(total) : '—'}
      </span>
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
            <span className={`${textClass} ${bold ? 'font-bold' : 'font-medium'}`} style={{ fontSize: 11 }}>
              {fmtCompact(v)}
            </span>
          )}
        </td>
      );
    })}
  </tr>
);

interface BalanceRowProps {
  label: string;
  total: number;
  days: number[];
  values: Record<number, number>;
  todayDay: number;
  labelW: number;
  totalW: number;
}
const BalanceRow: React.FC<BalanceRowProps> = ({ label, total, days, values, todayDay, labelW, totalW }) => (
  <tr className="border-b-2 border-slate-300" style={{ background: '#f8fafc' }}>
    <td
      className="sticky left-0 z-10 px-3 py-2 border-r border-slate-200 font-bold text-slate-700"
      style={{ width: labelW, minWidth: labelW, background: '#f1f5f9' }}
    >
      {label}
    </td>
    <td
      className="sticky z-10 border-r border-slate-200 text-right px-2 py-2 font-bold"
      style={{ left: labelW, width: totalW, minWidth: totalW, background: '#e2e8f0' }}
    >
      <span className={total >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
        {total < 0 ? '−' : ''}{fmtCompact(Math.abs(total))}
      </span>
    </td>
    {days.map(d => {
      const v = values[d] ?? 0;
      const isToday = d === todayDay;
      return (
        <td
          key={d}
          className="border-r border-slate-100 text-center py-1.5 px-0.5"
          style={{ background: isToday ? '#e0f2fe' : '#f8fafc' }}
        >
          {v !== 0 && (
            <span
              className={`font-bold text-[11px] ${v >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}
            >
              {v < 0 ? '−' : ''}{fmtCompact(Math.abs(v))}
            </span>
          )}
        </td>
      );
    })}
  </tr>
);
