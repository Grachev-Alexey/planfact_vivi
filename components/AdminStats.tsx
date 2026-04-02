import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import {
  Loader2, ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  Building2, User, TrendingUp, Users, Calendar, CreditCard, Tag, Sparkles, RefreshCw
} from 'lucide-react';
import { formatCurrency } from '../utils/format';

type PeriodKey = 'today' | 'week' | 'month' | 'custom';

const PERIOD_OPTIONS: { key: PeriodKey; label: string }[] = [
  { key: 'today', label: 'Сегодня' },
  { key: 'week', label: 'Неделя' },
  { key: 'month', label: 'Месяц' },
  { key: 'custom', label: 'Произвольный' },
];

const MONTH_NAMES = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const WEEKDAY_SHORT = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Наличные', card: 'Карта', sbp: 'СБП', ukassa: 'Ю-Касса', installment: 'Рассрочка',
};

const PAYMENT_COLORS: Record<string, string> = {
  cash: '#64748b', card: '#0ea5e9', sbp: '#10b981', ukassa: '#8b5cf6', installment: '#f59e0b',
};

function fmt(d: Date) { return d.toISOString().split('T')[0]; }

function getDateRange(period: PeriodKey, customStart?: string, customEnd?: string) {
  const today = new Date();
  switch (period) {
    case 'today': return { startDate: fmt(today), endDate: fmt(today) };
    case 'week': {
      const start = new Date(today);
      const day = start.getDay();
      start.setDate(start.getDate() - (day === 0 ? 6 : day - 1));
      return { startDate: fmt(start), endDate: fmt(today) };
    }
    case 'month': return { startDate: fmt(new Date(today.getFullYear(), today.getMonth(), 1)), endDate: fmt(today) };
    case 'custom': return { startDate: customStart || fmt(today), endDate: customEnd || fmt(today) };
  }
}

function formatShortDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }).replace('.', '');
}

function pluralClients(n: number) {
  if (n % 10 === 1 && n % 100 !== 11) return `${n} клиент`;
  if ([2,3,4].includes(n % 10) && ![12,13,14].includes(n % 100)) return `${n} клиента`;
  return `${n} клиентов`;
}

interface Summary {
  totalAmount: number; totalEntries: number; uniqueClients: number; avgCheck: number;
  primaryAmount: number; regularAmount: number; primaryCount: number; regularCount: number;
  totalVisits: number; zeroVisits: number;
  abonementAmount: number; abonementCount: number;
  abonementPrimaryAmount: number; abonementPrimaryCount: number;
  abonementRegularAmount: number; abonementRegularCount: number;
}

interface PaymentRow { type: string; amount: number; count: number; }
interface CategoryRow { id: number | null; name: string; amount: number; count: number; }
interface DailyRow { date: string; amount: number; }

interface MasterData {
  id: number; name: string; summary: Summary;
  daily: DailyRow[]; byPayment: PaymentRow[]; byCategory: CategoryRow[];
}
interface StudioData {
  id: number; name: string; summary: Summary;
  masters: MasterData[]; daily: DailyRow[];
}
interface AdminStatsData { overall: Summary; studios: StudioData[]; }

const MiniCalendar: React.FC<{ startDate: string; endDate: string; onSelect: (s: string, e: string) => void }> = ({ startDate, endDate, onSelect }) => {
  const [viewMonth, setViewMonth] = useState(() => {
    const d = startDate ? new Date(startDate + 'T00:00:00') : new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [selecting, setSelecting] = useState<'start' | 'end' | null>(null);
  const [tempStart, setTempStart] = useState(startDate);
  const [tempEnd, setTempEnd] = useState(endDate);

  const daysInMonth = new Date(viewMonth.year, viewMonth.month + 1, 0).getDate();
  const firstDayOfWeek = (new Date(viewMonth.year, viewMonth.month, 1).getDay() + 6) % 7;
  const getDateStr = (day: number) => `${viewMonth.year}-${String(viewMonth.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const handleDay = (day: number) => {
    const dateStr = getDateStr(day);
    if (!selecting || selecting === 'start') { setTempStart(dateStr); setTempEnd(''); setSelecting('end'); }
    else { let s = tempStart, e = dateStr; if (s > e) [s, e] = [e, s]; setTempStart(s); setTempEnd(e); setSelecting(null); onSelect(s, e); }
  };

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm max-w-xs">
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => setViewMonth(v => v.month === 0 ? { year: v.year-1, month: 11 } : { year: v.year, month: v.month-1 })} className="w-7 h-7 flex items-center justify-center rounded hover:bg-slate-100 text-slate-500"><ChevronLeft size={14} /></button>
        <span className="text-sm font-semibold text-slate-700">{MONTH_NAMES[viewMonth.month]} {viewMonth.year}</span>
        <button onClick={() => setViewMonth(v => v.month === 11 ? { year: v.year+1, month: 0 } : { year: v.year, month: v.month+1 })} className="w-7 h-7 flex items-center justify-center rounded hover:bg-slate-100 text-slate-500"><ChevronRight size={14} /></button>
      </div>
      <div className="grid grid-cols-7 mb-1">{WEEKDAY_SHORT.map(w => <div key={w} className="text-center text-[10px] font-medium text-slate-400 py-0.5">{w}</div>)}</div>
      <div className="grid grid-cols-7">
        {cells.map((day, i) => {
          if (day === null) return <div key={i} />;
          const d = getDateStr(day), s = tempStart || startDate, e = tempEnd || endDate;
          const inRange = !!(s && e && d >= s && d <= e);
          const isS = d === s, isE = d === e;
          const isToday = (() => { const t = new Date(); return day === t.getDate() && viewMonth.month === t.getMonth() && viewMonth.year === t.getFullYear(); })();
          return (
            <button key={i} onClick={() => handleDay(day)} className={`h-8 text-xs font-medium flex items-center justify-center transition-all ${inRange && !isS && !isE ? 'bg-slate-100 text-slate-700' : ''} ${isS || isE ? 'bg-slate-700 text-white rounded' : ''} ${!inRange && !isS && !isE ? 'text-slate-600 hover:bg-slate-50 rounded' : ''} ${isToday && !isS && !isE && !inRange ? 'ring-1 ring-slate-400 rounded' : ''}`}>{day}</button>
          );
        })}
      </div>
      {selecting === 'end' && <div className="mt-2 text-center text-xs text-slate-500">Выберите конечную дату</div>}
      {(tempStart || startDate) && (tempEnd || endDate) && !selecting && <div className="mt-2 text-center text-xs text-slate-500 font-medium">{formatShortDate(tempStart || startDate)} — {formatShortDate(tempEnd || endDate)}</div>}
    </div>
  );
};

const MetricCell: React.FC<{ label: string; value: string | number; sub?: string; accent?: boolean }> = ({ label, value, sub, accent }) => (
  <div className={`px-4 py-3 ${accent ? 'bg-slate-50' : ''}`}>
    <div className={`text-sm font-bold tabular-nums ${accent ? 'text-slate-900' : 'text-slate-800'}`}>{value}</div>
    <div className="text-[11px] text-slate-400 mt-0.5">{label}</div>
    {sub && <div className="text-[10px] text-slate-400">{sub}</div>}
  </div>
);

const MasterDetail: React.FC<{ master: MasterData }> = ({ master }) => {
  const s = master.summary;
  const totalClients = s.primaryCount + s.regularCount;
  const primaryPct = totalClients > 0 ? Math.round((s.primaryCount / totalClients) * 100) : 0;
  const conversionTotal = s.uniqueClients > 0 ? Math.round((s.abonementCount / s.uniqueClients) * 100) : 0;
  const abAvg = s.abonementCount > 0 ? Math.round(s.abonementAmount / s.abonementCount) : 0;
  const convPrimary = s.primaryCount > 0 ? Math.round((s.abonementPrimaryCount / s.primaryCount) * 100) : 0;
  const convRegular = s.regularCount > 0 ? Math.round((s.abonementRegularCount / s.regularCount) * 100) : 0;
  const abPrimaryAvg = s.abonementPrimaryCount > 0 ? Math.round(s.abonementPrimaryAmount / s.abonementPrimaryCount) : 0;
  const abRegularAvg = s.abonementRegularCount > 0 ? Math.round(s.abonementRegularAmount / s.abonementRegularCount) : 0;

  return (
    <div className="bg-slate-50/60 border-t border-slate-100">

      {/* Key metrics row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-slate-100 border-b border-slate-100">
        <MetricCell label="Выручка" value={formatCurrency(s.totalAmount)} accent />
        <MetricCell label="Средний чек" value={formatCurrency(s.avgCheck)} />
        <MetricCell label="Клиентов" value={s.uniqueClients} sub={`${s.totalVisits} визитов`} accent />
        <MetricCell label="Записей" value={s.totalEntries} sub={s.zeroVisits > 0 ? `${s.zeroVisits} без оплаты` : undefined} />
      </div>

      <div className="p-4 space-y-4">

        {/* New / Regular clients */}
        {totalClients > 0 && (
          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Новые и постоянные клиенты</div>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div className="bg-white border border-slate-100 rounded-lg p-3">
                <div className="flex justify-between items-start mb-1">
                  <span className="text-[11px] text-slate-500 font-medium">Новые</span>
                  <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{primaryPct}%</span>
                </div>
                <div className="text-base font-bold text-slate-800">{s.primaryCount}</div>
                <div className="text-xs text-slate-400 mt-0.5">{formatCurrency(s.primaryAmount)}</div>
              </div>
              <div className="bg-white border border-slate-100 rounded-lg p-3">
                <div className="flex justify-between items-start mb-1">
                  <span className="text-[11px] text-slate-500 font-medium">Постоянные</span>
                  <span className="text-[10px] font-bold text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded">{100 - primaryPct}%</span>
                </div>
                <div className="text-base font-bold text-slate-800">{s.regularCount}</div>
                <div className="text-xs text-slate-400 mt-0.5">{formatCurrency(s.regularAmount)}</div>
              </div>
            </div>
            <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden flex">
              <div className="h-full bg-slate-500 transition-all" style={{ width: `${primaryPct}%` }} />
              <div className="h-full bg-teal-500 transition-all" style={{ width: `${100 - primaryPct}%` }} />
            </div>
          </div>
        )}

        {/* Abonements */}
        {s.abonementCount > 0 && (
          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Sparkles size={11} className="text-violet-400" /> Абонементы
              {conversionTotal > 0 && <span className="ml-auto text-[10px] font-bold text-violet-600 bg-violet-50 border border-violet-100 px-2 py-0.5 rounded">{conversionTotal}% конв.</span>}
            </div>
            <div className="bg-white border border-slate-100 rounded-lg overflow-hidden">
              <div className="px-3 py-2.5 border-b border-slate-50">
                <span className="text-sm font-bold text-slate-800">{formatCurrency(s.abonementAmount)}</span>
                <span className="text-xs text-slate-400 ml-2">{s.abonementCount} шт.{abAvg > 0 ? ` · ср. ${formatCurrency(abAvg)}` : ''}</span>
              </div>
              {(s.abonementPrimaryCount > 0 || s.abonementRegularCount > 0) && (
                <div className="grid grid-cols-2 divide-x divide-slate-50">
                  {s.abonementPrimaryCount > 0 && (
                    <div className="px-3 py-2">
                      <div className="flex justify-between items-center mb-0.5">
                        <span className="text-[10px] text-slate-500">Новым</span>
                        {convPrimary > 0 && <span className="text-[10px] font-bold text-slate-500">{convPrimary}%</span>}
                      </div>
                      <div className="text-xs font-bold text-slate-700">{formatCurrency(s.abonementPrimaryAmount)}</div>
                      {abPrimaryAvg > 0 && <div className="text-[10px] text-slate-400">ср. {formatCurrency(abPrimaryAvg)}</div>}
                    </div>
                  )}
                  {s.abonementRegularCount > 0 && (
                    <div className="px-3 py-2">
                      <div className="flex justify-between items-center mb-0.5">
                        <span className="text-[10px] text-slate-500">Постоянным</span>
                        {convRegular > 0 && <span className="text-[10px] font-bold text-teal-600">{convRegular}%</span>}
                      </div>
                      <div className="text-xs font-bold text-slate-700">{formatCurrency(s.abonementRegularAmount)}</div>
                      {abRegularAvg > 0 && <div className="text-[10px] text-slate-400">ср. {formatCurrency(abRegularAvg)}</div>}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Payment methods */}
        {master.byPayment.length > 0 && (
          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <CreditCard size={11} /> Способы оплаты
            </div>
            <div className="bg-white border border-slate-100 rounded-lg overflow-hidden divide-y divide-slate-50">
              {master.byPayment.map((p, i) => {
                const pct = s.totalAmount > 0 ? Math.round((p.amount / s.totalAmount) * 100) : 0;
                const color = PAYMENT_COLORS[p.type] || '#94a3b8';
                return (
                  <div key={i} className="px-3 py-2">
                    <div className="flex justify-between items-center mb-1">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: color }} />
                        <span className="text-xs text-slate-700">{PAYMENT_LABELS[p.type] || p.type}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-semibold text-slate-700 tabular-nums">{formatCurrency(p.amount)}</span>
                        <span className="text-slate-400 w-7 text-right">{pct}%</span>
                      </div>
                    </div>
                    <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Categories */}
        {master.byCategory.length > 0 && (
          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Tag size={11} /> По услугам
            </div>
            <div className="bg-white border border-slate-100 rounded-lg overflow-hidden divide-y divide-slate-50">
              {master.byCategory.map((cat, i) => {
                const pct = s.totalAmount > 0 ? Math.round((cat.amount / s.totalAmount) * 100) : 0;
                return (
                  <div key={i} className="flex items-center justify-between px-3 py-2">
                    <span className="text-xs text-slate-700 flex-1 min-w-0 truncate">{cat.name}</span>
                    <div className="flex items-center gap-2 text-xs ml-3 shrink-0">
                      <span className="font-semibold text-slate-700 tabular-nums">{formatCurrency(cat.amount)}</span>
                      <span className="text-slate-400 w-7 text-right">{pct}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Daily chart */}
        {master.daily.length > 1 && (
          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <TrendingUp size={11} /> Выручка по дням
            </div>
            <ResponsiveContainer width="100%" height={100}>
              <BarChart data={master.daily} margin={{ top: 2, right: 0, left: -32, bottom: 0 }}>
                <XAxis dataKey="date" tickFormatter={formatShortDate} tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v: number) => v >= 1000 ? `${Math.round(v/1000)}к` : String(v)} tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v: number) => [formatCurrency(v), 'Выручка']} labelFormatter={(l: string) => formatShortDate(l)} contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
                <Bar dataKey="amount" radius={[3, 3, 0, 0]} maxBarSize={20}>
                  {master.daily.map((_, i) => <Cell key={i} fill={i === master.daily.length - 1 ? '#475569' : '#cbd5e1'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

      </div>
    </div>
  );
};

const MasterRow: React.FC<{ master: MasterData; studioTotal: number }> = ({ master, studioTotal }) => {
  const [open, setOpen] = useState(false);
  const s = master.summary;
  const sharePct = studioTotal > 0 ? Math.round((s.totalAmount / studioTotal) * 100) : 0;

  return (
    <div className="border-t border-slate-100">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left">
        <div className="w-7 h-7 rounded bg-slate-200 flex items-center justify-center text-slate-600 font-bold text-xs shrink-0">
          {master.name[0]?.toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-800">{master.name}</span>
            {s.abonementCount > 0 && (
              <span className="text-[10px] font-semibold text-violet-500 bg-violet-50 border border-violet-100 px-1.5 py-0.5 rounded">
                <Sparkles size={8} className="inline mr-0.5" />{s.abonementCount} або.
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2">
            <span>{pluralClients(s.uniqueClients)}</span>
            <span>·</span>
            <span>{s.totalVisits} визитов</span>
            <span>·</span>
            <span>ср. чек {formatCurrency(s.avgCheck)}</span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-sm font-bold text-slate-800 tabular-nums">{formatCurrency(s.totalAmount)}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">{sharePct}% студии</div>
        </div>
        <div className="text-slate-400 shrink-0">
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </button>
      {open && <MasterDetail master={master} />}
    </div>
  );
};

const StudioSection: React.FC<{ studio: StudioData }> = ({ studio }) => {
  const [open, setOpen] = useState(true);
  const s = studio.summary;
  const convTotal = s.uniqueClients > 0 ? Math.round((s.abonementCount / s.uniqueClients) * 100) : 0;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Studio header */}
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-3 p-4 hover:bg-slate-50 transition-colors">
        <div className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center shrink-0">
          <Building2 size={16} className="text-white" />
        </div>
        <div className="flex-1 min-w-0 text-left">
          <div className="text-sm font-bold text-slate-800">{studio.name}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">{studio.masters.length} мастеров · {s.uniqueClients} клиентов · {s.totalVisits} визитов</div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-base font-bold text-slate-900 tabular-nums">{formatCurrency(s.totalAmount)}</div>
          <div className="flex items-center justify-end gap-1.5 mt-0.5">
            {s.abonementAmount > 0 && <span className="text-[10px] text-violet-500 font-medium">або. {formatCurrency(s.abonementAmount)}</span>}
            {convTotal > 0 && <span className="text-[10px] text-slate-400">{convTotal}% конв.</span>}
          </div>
        </div>
        {open ? <ChevronUp size={15} className="text-slate-400 shrink-0" /> : <ChevronDown size={15} className="text-slate-400 shrink-0" />}
      </button>

      {open && (
        <>
          {/* Studio summary metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-slate-100 border-t border-b border-slate-100 bg-slate-50/50">
            <MetricCell label="Средний чек" value={formatCurrency(s.avgCheck)} />
            <MetricCell label="Новые / Постоянные" value={`${s.primaryCount} / ${s.regularCount}`} />
            <MetricCell label="Абонементы" value={s.abonementCount > 0 ? formatCurrency(s.abonementAmount) : '—'} />
            <MetricCell label="Записей" value={s.totalEntries} />
          </div>

          {/* Studio daily chart */}
          {studio.daily.length > 1 && (
            <div className="px-4 py-3 border-b border-slate-100">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <TrendingUp size={11} /> Выручка студии по дням
              </div>
              <ResponsiveContainer width="100%" height={110}>
                <BarChart data={studio.daily} margin={{ top: 2, right: 0, left: -28, bottom: 0 }}>
                  <XAxis dataKey="date" tickFormatter={formatShortDate} tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(v: number) => v >= 1000 ? `${Math.round(v/1000)}к` : String(v)} tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v: number) => [formatCurrency(v), 'Выручка']} labelFormatter={(l: string) => formatShortDate(l)} contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
                  <Bar dataKey="amount" radius={[3, 3, 0, 0]} maxBarSize={22}>
                    {studio.daily.map((_, i) => <Cell key={i} fill={i === studio.daily.length - 1 ? '#334155' : '#cbd5e1'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Masters list */}
          <div>
            <div className="px-4 py-2 bg-slate-50 border-b border-slate-100">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <User size={11} /> Мастера
              </span>
            </div>
            {studio.masters.map(m => <MasterRow key={m.id} master={m} studioTotal={s.totalAmount} />)}
          </div>
        </>
      )}
    </div>
  );
};

export const AdminStats: React.FC = () => {
  const { user } = useAuth();
  const [period, setPeriod] = useState<PeriodKey>('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [data, setData] = useState<AdminStatsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [showCustom, setShowCustom] = useState(false);

  const fetchStats = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { startDate, endDate } = getDateRange(period, customStart, customEnd);
      const res = await fetch(`/api/admin-stats?startDate=${startDate}&endDate=${endDate}`, {
        headers: { 'x-user-id': String(user.id) },
      });
      if (res.ok) setData(await res.json());
    } catch { } finally { setLoading(false); }
  }, [user, period, customStart, customEnd]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const handlePeriod = (key: PeriodKey) => {
    setPeriod(key);
    if (key === 'custom') {
      setShowCustom(true);
      if (!customStart || !customEnd) {
        const today = new Date(), monthAgo = new Date(today);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        setCustomStart(fmt(monthAgo)); setCustomEnd(fmt(today));
      }
    } else { setShowCustom(false); }
  };

  const periodLabel = period === 'today' ? 'за сегодня' : period === 'week' ? 'за неделю' : period === 'month' ? 'за месяц' : 'за период';
  const o = data?.overall;

  return (
    <div className="max-w-3xl mx-auto px-4 py-5 space-y-4 pb-8">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Показатели мастеров</h1>
          <p className="text-xs text-slate-400 mt-0.5">Выручка, клиенты и абонементы по студиям</p>
        </div>
        <button onClick={fetchStats} disabled={loading} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 bg-white border border-slate-200 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          Обновить
        </button>
      </div>

      {/* Period selector */}
      <div className="flex gap-1.5 flex-wrap">
        {PERIOD_OPTIONS.map(opt => (
          <button key={opt.key} onClick={() => handlePeriod(opt.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${period === opt.key ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'}`}>
            {opt.label}
          </button>
        ))}
      </div>

      {showCustom && (
        <MiniCalendar startDate={customStart} endDate={customEnd} onSelect={(s, e) => { setCustomStart(s); setCustomEnd(e); }} />
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
          <Loader2 size={24} className="animate-spin" />
          <span className="text-sm">Загружаю данные...</span>
        </div>
      ) : !data || !o ? (
        <div className="text-center py-16 text-slate-400 text-sm bg-white rounded-xl border border-slate-200">
          Нет данных за выбранный период
        </div>
      ) : (
        <>
          {/* Overall KPI summary */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Итого {periodLabel}</span>
              <span className="text-lg font-bold text-slate-900 tabular-nums">{formatCurrency(o.totalAmount)}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-slate-100">
              <div className="px-4 py-3">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Users size={13} className="text-slate-400" />
                  <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wide">Клиентов</span>
                </div>
                <div className="text-xl font-bold text-slate-800">{o.uniqueClients}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">{o.totalVisits} визитов</div>
              </div>
              <div className="px-4 py-3">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <TrendingUp size={13} className="text-slate-400" />
                  <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wide">Ср. чек</span>
                </div>
                <div className="text-xl font-bold text-slate-800">{formatCurrency(o.avgCheck)}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">{o.totalEntries} записей</div>
              </div>
              <div className="px-4 py-3">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Calendar size={13} className="text-slate-400" />
                  <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wide">Новые / Пост.</span>
                </div>
                <div className="text-xl font-bold text-slate-800">{o.primaryCount} / {o.regularCount}</div>
                {o.primaryCount + o.regularCount > 0 && (
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {Math.round((o.primaryCount / (o.primaryCount + o.regularCount)) * 100)}% новых
                  </div>
                )}
              </div>
              <div className="px-4 py-3">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Sparkles size={13} className="text-violet-400" />
                  <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wide">Абонементы</span>
                </div>
                {o.abonementCount > 0 ? (
                  <>
                    <div className="text-xl font-bold text-slate-800">{formatCurrency(o.abonementAmount)}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {o.abonementCount} шт. · {o.uniqueClients > 0 ? Math.round((o.abonementCount / o.uniqueClients) * 100) : 0}% конв.
                    </div>
                  </>
                ) : (
                  <div className="text-xl font-bold text-slate-400">—</div>
                )}
              </div>
            </div>
          </div>

          {/* Studios */}
          <div className="space-y-3">
            {data.studios.map(studio => <StudioSection key={studio.id} studio={studio} />)}
          </div>
        </>
      )}
    </div>
  );
};
