import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
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
  pending:  { label: 'Ожидает',   text: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-200',   dot: 'bg-blue-500'   },
  approved: { label: 'Утверждён', text: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200', dot: 'bg-orange-500' },
  paid:     { label: 'Оплачен',   text: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-200',  dot: 'bg-green-500'  },
};

const MONTH_NAMES = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const DAY_NAMES = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];

function fmt(v: number | undefined): string {
  if (!v) return '';
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

const COL_W = 68;
const LABEL_W = 148;

interface TooltipState {
  entries: PREntry[];
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
  const tableRef = useRef<HTMLDivElement>(null);

  const monthStr = `${year}-${String(month).padStart(2, '0')}`;

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await fetch(`/api/payment-calendar?month=${monthStr}`, {
        headers: { 'x-user-id': String(user?.id || '') },
      });
      if (!r.ok) throw new Error('Ошибка загрузки');
      setData(await r.json());
    } catch {
      setError('Не удалось загрузить данные');
    } finally {
      setLoading(false);
    }
  }, [monthStr, user]);

  useEffect(() => { load(); }, [load]);

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  };

  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth() + 1;
  const todayDay = isCurrentMonth ? today.getDate() : -1;

  const days = data ? Array.from({ length: data.daysInMonth }, (_, i) => i + 1) : [];

  function showTooltip(entries: PREntry[], e: React.MouseEvent) {
    setTooltip({ entries, clientX: e.clientX, clientY: e.clientY });
  }
  function hideTooltip() { setTooltip(null); }

  const totalIncomePlan = days.reduce((s, d) => s + (data?.incomePlan[d] || 0), 0);
  const totalIncomeFact = days.reduce((s, d) => s + (data?.incomeFact[d] || 0), 0);
  const totalExpensePlan = days.reduce((s, d) => s + (data?.expensePlan[d] || 0), 0);
  const totalExpenseFact = days.reduce((s, d) => s + (data?.expenseFact[d] || 0), 0);
  const totalBalance = totalIncomeFact - totalExpenseFact;

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <CalendarDays size={20} className="text-teal-600" />
          <h1 className="text-lg font-bold text-slate-800">Платёжный календарь</h1>
        </div>
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow-sm">
          <button onClick={prevMonth} className="p-1 hover:text-teal-600 text-slate-400 transition-colors">
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-semibold text-slate-700 min-w-[140px] text-center">
            {MONTH_NAMES[month - 1]} {year}
          </span>
          <button onClick={nextMonth} className="p-1 hover:text-teal-600 text-slate-400 transition-colors">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20 text-slate-400 text-sm">
          Загрузка...
        </div>
      )}
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-rose-700 text-sm">{error}</div>
      )}

      {data && !loading && (
        <>
          <div className="flex flex-wrap gap-3 mb-1">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
              Ожидает
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-500 inline-block" />
              Утверждён
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" />
              Оплачен
            </div>
          </div>

          <div
            ref={tableRef}
            className="relative overflow-auto rounded-xl border border-slate-200 shadow-sm bg-white"
            style={{ maxHeight: 'calc(100vh - 200px)' }}
          >
            <table className="border-collapse text-xs" style={{ minWidth: LABEL_W + days.length * COL_W }}>
              <thead>
                <tr className="sticky top-0 z-20">
                  <th
                    className="sticky left-0 z-30 bg-[#1e2a38] text-slate-300 text-left px-3 py-2 font-semibold border-b border-slate-600 border-r border-slate-600"
                    style={{ width: LABEL_W, minWidth: LABEL_W }}
                  >
                    Статья / День
                  </th>
                  <th
                    className="sticky left-0 z-30 bg-slate-100 text-slate-500 text-right px-2 py-2 font-semibold border-b border-r border-slate-200"
                    style={{ width: 80, minWidth: 80, left: LABEL_W }}
                  >
                    Итого
                  </th>
                  {days.map(d => {
                    const dayOfWeek = new Date(year, month - 1, d).getDay();
                    const isToday = d === todayDay;
                    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                    return (
                      <th
                        key={d}
                        className={`text-center py-1 font-medium border-b border-r border-slate-200
                          ${isToday ? 'bg-teal-600 text-white' : isWeekend ? 'bg-slate-100 text-slate-400' : 'bg-white text-slate-500'}`}
                        style={{ width: COL_W, minWidth: COL_W }}
                      >
                        <div className="text-[11px] font-bold">{d}</div>
                        <div className="text-[9px] opacity-70">{DAY_NAMES[dayOfWeek]}</div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                <SectionRow label="ДОХОДЫ" cols={days.length} />

                <SummaryRow
                  label="Доходы (план)"
                  total={totalIncomePlan}
                  days={days}
                  values={data.incomePlan}
                  todayDay={todayDay}
                  textClass="text-emerald-600"
                  bgClass="bg-emerald-50/40"
                />
                <SummaryRow
                  label="Доходы (факт)"
                  total={totalIncomeFact}
                  days={days}
                  values={data.incomeFact}
                  todayDay={todayDay}
                  textClass="text-emerald-700 font-semibold"
                  bgClass="bg-emerald-50"
                />

                <SectionRow label="РАСХОДЫ" cols={days.length} />

                <SummaryRow
                  label="Расходы (план)"
                  total={totalExpensePlan}
                  days={days}
                  values={data.expensePlan}
                  todayDay={todayDay}
                  textClass="text-rose-500"
                  bgClass="bg-rose-50/30"
                />
                <SummaryRow
                  label="Расходы (факт)"
                  total={totalExpenseFact}
                  days={days}
                  values={data.expenseFact}
                  todayDay={todayDay}
                  textClass="text-rose-700 font-semibold"
                  bgClass="bg-rose-50"
                />

                <BalanceRow
                  label="Остаток"
                  total={totalBalance}
                  days={days}
                  values={data.balance}
                  todayDay={todayDay}
                />

                {data.expenseCategories.length > 0 && (
                  <SectionRow label="ПО СТАТЬЯМ" cols={days.length} />
                )}

                {data.expenseCategories.map(cat => (
                  <tr key={cat.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                    <td
                      className="sticky left-0 z-10 bg-white px-3 py-1.5 border-r border-slate-200 text-slate-600 font-medium truncate"
                      style={{ width: LABEL_W, minWidth: LABEL_W, maxWidth: LABEL_W }}
                      title={cat.name}
                    >
                      {cat.name}
                    </td>
                    <td
                      className="sticky z-10 bg-slate-50 border-r border-slate-200 text-right px-2 py-1.5 text-slate-500"
                      style={{ left: LABEL_W, width: 80, minWidth: 80 }}
                    >
                      {fmt(Object.values(cat.days).flat().reduce((s, e) => s + e.amount, 0))}
                    </td>
                    {days.map(d => {
                      const entries = cat.days[d];
                      const isToday = d === todayDay;
                      if (!entries || entries.length === 0) {
                        return (
                          <td
                            key={d}
                            className={`border-r border-slate-100 ${isToday ? 'bg-teal-50/30' : ''}`}
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
                          className={`border-r border-slate-100 ${isToday ? 'bg-teal-50/30' : ''}`}
                          style={{ width: COL_W, minWidth: COL_W }}
                        >
                          <div
                            className={`mx-0.5 my-0.5 rounded-lg px-1.5 py-1 cursor-default ${cfg.bg} border ${cfg.border} hover:shadow-md transition-shadow`}
                            onMouseMove={e => showTooltip(entries, e)}
                            onMouseLeave={hideTooltip}
                          >
                            <div className={`font-semibold text-center leading-tight ${cfg.text}`} style={{ fontSize: 10 }}>
                              {fmt(total)}
                            </div>
                            {statuses.length > 1 && (
                              <div className="flex justify-center gap-0.5 mt-0.5">
                                {statuses.map(s => (
                                  <span key={s} className={`w-1.5 h-1.5 rounded-full ${STATUS_CFG[s as keyof typeof STATUS_CFG].dot}`} />
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>

            {tooltip && (
              <div
                className="fixed z-[9999] bg-white border border-slate-200 rounded-xl shadow-xl p-3 pointer-events-none"
                style={{
                  left: Math.min(tooltip.clientX + 14, window.innerWidth - 250),
                  top: Math.min(tooltip.clientY + 14, window.innerHeight - 200),
                  width: 230,
                }}
              >
                {tooltip.entries.map((entry, i) => {
                  const cfg = STATUS_CFG[entry.status];
                  return (
                    <div key={entry.id} className={`${i > 0 ? 'mt-2 pt-2 border-t border-slate-100' : ''}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded ${cfg.bg} ${cfg.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                          {cfg.label}
                        </span>
                        <span className="text-xs font-bold text-slate-700">{fmtFull(entry.amount)}</span>
                      </div>
                      {entry.description && (
                        <p className="text-[11px] text-slate-600 mt-1 leading-snug">{entry.description}</p>
                      )}
                      {entry.contractorName && (
                        <p className="text-[10px] text-slate-400 mt-0.5">{entry.contractorName}</p>
                      )}
                      {entry.username && (
                        <p className="text-[10px] text-slate-400">от {entry.username}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

const SectionRow: React.FC<{ label: string; cols: number }> = ({ label, cols }) => (
  <tr>
    <td
      colSpan={cols + 2}
      className="sticky left-0 bg-slate-100 text-slate-500 text-[10px] font-bold uppercase tracking-widest px-3 py-1 border-b border-slate-200"
    >
      {label}
    </td>
  </tr>
);

interface SummaryRowProps {
  label: string;
  total: number;
  days: number[];
  values: Record<number, number>;
  todayDay: number;
  textClass: string;
  bgClass: string;
}
const SummaryRow: React.FC<SummaryRowProps> = ({ label, total, days, values, todayDay, textClass, bgClass }) => (
  <tr className={`border-b border-slate-200 ${bgClass}`}>
    <td
      className="sticky left-0 z-10 px-3 py-2 border-r border-slate-200 font-semibold text-slate-600"
      style={{ width: LABEL_W, minWidth: LABEL_W, background: 'inherit' }}
    >
      {label}
    </td>
    <td
      className="sticky z-10 border-r border-slate-200 text-right px-2 py-2 font-bold"
      style={{ left: LABEL_W, width: 80, minWidth: 80, background: 'inherit' }}
    >
      <span className={textClass}>{total ? fmt(total) : '—'}</span>
    </td>
    {days.map(d => {
      const v = values[d] || 0;
      const isToday = d === todayDay;
      return (
        <td
          key={d}
          className={`border-r border-slate-100 text-center py-2 px-1 ${isToday ? 'ring-1 ring-inset ring-teal-300' : ''}`}
        >
          {v > 0 && <span className={`font-medium ${textClass}`} style={{ fontSize: 11 }}>{fmt(v)}</span>}
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
}
const BalanceRow: React.FC<BalanceRowProps> = ({ label, total, days, values, todayDay }) => (
  <tr className="border-b-2 border-slate-300 bg-slate-50">
    <td
      className="sticky left-0 z-10 bg-slate-50 px-3 py-2 border-r border-slate-200 font-bold text-slate-700"
      style={{ width: LABEL_W, minWidth: LABEL_W }}
    >
      {label}
    </td>
    <td
      className="sticky z-10 bg-slate-50 border-r border-slate-200 text-right px-2 py-2 font-bold"
      style={{ left: LABEL_W, width: 80, minWidth: 80 }}
    >
      <span className={total >= 0 ? 'text-emerald-700' : 'text-rose-700'}>{fmt(Math.abs(total))}</span>
    </td>
    {days.map(d => {
      const v = values[d] ?? 0;
      const isToday = d === todayDay;
      return (
        <td
          key={d}
          className={`border-r border-slate-100 text-center py-2 px-1 ${isToday ? 'ring-1 ring-inset ring-teal-300' : ''}`}
        >
          {v !== 0 && (
            <span className={`font-semibold text-[11px] ${v >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
              {v < 0 ? '-' : ''}{fmt(Math.abs(v))}
            </span>
          )}
        </td>
      );
    })}
  </tr>
);
