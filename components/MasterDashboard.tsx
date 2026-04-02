import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Loader2, ChevronLeft, ChevronRight, Sparkles, Users, Star, Wallet, Calendar, TrendingUp, Tag, CreditCard } from 'lucide-react';
import { formatCurrency } from '../utils/format';

interface StatsData {
  summary: {
    totalAmount: number;
    totalEntries: number;
    uniqueClients: number;
    avgCheck: number;
    primaryAmount: number;
    regularAmount: number;
    primaryCount: number;
    regularCount: number;
    totalVisits: number;
    zeroVisits: number;
    abonementAmount: number;
    abonementCount: number;
    abonementPrimaryAmount: number;
    abonementPrimaryCount: number;
    abonementRegularAmount: number;
    abonementRegularCount: number;
  };
  daily: { date: string; amount: number; entries: number }[];
  byPayment: { type: string; amount: number; count: number }[];
  byCategory: { id: number | null; name: string; amount: number; count: number }[];
}

type PeriodKey = 'today' | 'week' | 'month' | 'custom';

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Наличные',
  card: 'Карта',
  sbp: 'СБП',
  ukassa: 'Ю-Касса',
  installment: 'Рассрочка',
};

const PERIOD_OPTIONS: { key: PeriodKey; label: string }[] = [
  { key: 'today', label: 'Сегодня' },
  { key: 'week', label: 'Неделя' },
  { key: 'month', label: 'Месяц' },
  { key: 'custom', label: 'Период' },
];

const MONTH_NAMES = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];

const WEEKDAY_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

function fmt(d: Date) { return d.toISOString().split('T')[0]; }

function getDateRange(period: PeriodKey, customStart?: string, customEnd?: string): { startDate: string; endDate: string } {
  const today = new Date();
  switch (period) {
    case 'today':
      return { startDate: fmt(today), endDate: fmt(today) };
    case 'week': {
      const start = new Date(today);
      const day = start.getDay();
      start.setDate(start.getDate() - (day === 0 ? 6 : day - 1));
      return { startDate: fmt(start), endDate: fmt(today) };
    }
    case 'month': {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      return { startDate: fmt(start), endDate: fmt(today) };
    }
    case 'custom':
      return { startDate: customStart || fmt(today), endDate: customEnd || fmt(today) };
  }
}

function formatShortDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }).replace('.', '');
}

const CustomCalendar: React.FC<{
  startDate: string;
  endDate: string;
  onSelect: (start: string, end: string) => void;
}> = ({ startDate, endDate, onSelect }) => {
  const [viewMonth, setViewMonth] = useState(() => {
    const d = startDate ? new Date(startDate + 'T00:00:00') : new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [selecting, setSelecting] = useState<'start' | 'end' | null>(null);
  const [tempStart, setTempStart] = useState(startDate);
  const [tempEnd, setTempEnd] = useState(endDate);

  const daysInMonth = new Date(viewMonth.year, viewMonth.month + 1, 0).getDate();
  const firstDayOfWeek = (new Date(viewMonth.year, viewMonth.month, 1).getDay() + 6) % 7;

  const prevMonth = () => setViewMonth(v => v.month === 0 ? { year: v.year - 1, month: 11 } : { year: v.year, month: v.month - 1 });
  const nextMonth = () => setViewMonth(v => v.month === 11 ? { year: v.year + 1, month: 0 } : { year: v.year, month: v.month + 1 });

  const handleDayClick = (day: number) => {
    const dateStr = `${viewMonth.year}-${String(viewMonth.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (!selecting || selecting === 'start') {
      setTempStart(dateStr); setTempEnd(''); setSelecting('end');
    } else {
      let s = tempStart, e = dateStr;
      if (s > e) [s, e] = [e, s];
      setTempStart(s); setTempEnd(e); setSelecting(null); onSelect(s, e);
    }
  };

  const getDateStr = (day: number) => `${viewMonth.year}-${String(viewMonth.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const isInRange = (day: number) => { const d = getDateStr(day), s = tempStart || startDate, e = tempEnd || endDate; return !!(s && e && d >= s && d <= e); };
  const isStart = (day: number) => getDateStr(day) === (tempStart || startDate);
  const isEnd = (day: number) => getDateStr(day) === (tempEnd || endDate);
  const isToday = (day: number) => { const t = new Date(); return day === t.getDate() && viewMonth.month === t.getMonth() && viewMonth.year === t.getFullYear(); };

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <button onClick={prevMonth} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500 transition-colors"><ChevronLeft size={16} /></button>
        <span className="text-sm font-semibold text-slate-700">{MONTH_NAMES[viewMonth.month]} {viewMonth.year}</span>
        <button onClick={nextMonth} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500 transition-colors"><ChevronRight size={16} /></button>
      </div>
      <div className="grid grid-cols-7 gap-0 mb-1">
        {WEEKDAY_SHORT.map(wd => <div key={wd} className="text-center text-[10px] font-medium text-slate-400 py-1">{wd}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-0">
        {cells.map((day, i) => {
          if (day === null) return <div key={i} />;
          const inRange = isInRange(day), start = isStart(day), end = isEnd(day), td = isToday(day);
          return (
            <button key={i} onClick={() => handleDayClick(day)}
              className={`h-9 text-xs font-medium relative flex items-center justify-center transition-all
                ${inRange && !start && !end ? 'bg-teal-50 text-teal-700' : ''}
                ${start || end ? 'bg-teal-500 text-white rounded-full z-10 shadow-sm' : ''}
                ${!inRange && !start && !end ? 'text-slate-600 hover:bg-slate-50 rounded-full' : ''}
                ${td && !start && !end && !inRange ? 'ring-1 ring-teal-400 rounded-full' : ''}`}
            >{day}</button>
          );
        })}
      </div>
      {selecting === 'end' && <div className="mt-2 text-center text-xs text-teal-600 font-medium">Выберите конечную дату</div>}
      {(tempStart || startDate) && (tempEnd || endDate) && !selecting && (
        <div className="mt-2 text-center text-xs text-slate-500">{formatShortDate(tempStart || startDate)} — {formatShortDate(tempEnd || endDate)}</div>
      )}
    </div>
  );
};

function pluralSales(n: number) {
  if (n === 1) return '1 продажа';
  if (n >= 2 && n <= 4) return `${n} продажи`;
  return `${n} продаж`;
}

export const MasterDashboard: React.FC = () => {
  const { user } = useAuth();
  const [period, setPeriod] = useState<PeriodKey>('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [showCustom, setShowCustom] = useState(false);

  const fetchStats = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { startDate, endDate } = getDateRange(period, customStart, customEnd);
      const res = await fetch(`/api/master-incomes/stats?startDate=${startDate}&endDate=${endDate}`, {
        headers: { 'x-user-id': String(user.id) },
      });
      if (res.ok) setStats(await res.json());
    } catch { } finally { setLoading(false); }
  }, [user, period, customStart, customEnd]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const handlePeriodChange = (key: PeriodKey) => {
    setPeriod(key);
    if (key === 'custom') {
      setShowCustom(true);
      if (!customStart || !customEnd) {
        const today = new Date(), monthAgo = new Date(today);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        setCustomStart(fmt(monthAgo)); setCustomEnd(fmt(today));
      }
    } else {
      setShowCustom(false);
    }
  };

  const s = stats?.summary;
  const totalClients = (s?.primaryCount || 0) + (s?.regularCount || 0);
  const primaryPct = totalClients > 0 ? Math.round(((s?.primaryCount || 0) / totalClients) * 100) : 0;

  const abPrimaryAvg = (s?.abonementPrimaryCount || 0) > 0 ? Math.round((s?.abonementPrimaryAmount || 0) / (s?.abonementPrimaryCount || 1)) : 0;
  const abRegularAvg = (s?.abonementRegularCount || 0) > 0 ? Math.round((s?.abonementRegularAmount || 0) / (s?.abonementRegularCount || 1)) : 0;
  const abTotalAvg = (s?.abonementCount || 0) > 0 ? Math.round((s?.abonementAmount || 0) / (s?.abonementCount || 1)) : 0;
  const conversionPrimary = (s?.primaryCount || 0) > 0 ? Math.round(((s?.abonementPrimaryCount || 0) / (s?.primaryCount || 1)) * 100) : 0;
  const conversionRegular = (s?.regularCount || 0) > 0 ? Math.round(((s?.abonementRegularCount || 0) / (s?.regularCount || 1)) * 100) : 0;
  const conversionTotal = (s?.uniqueClients || 0) > 0 ? Math.round(((s?.abonementCount || 0) / (s?.uniqueClients || 1)) * 100) : 0;

  const periodLabel = period === 'today' ? 'за сегодня' : period === 'week' ? 'за неделю' : period === 'month' ? 'за месяц' : 'за период';

  return (
    <div className="space-y-3 pb-4">

      <div className="flex gap-1.5 flex-wrap">
        {PERIOD_OPTIONS.map(opt => (
          <button
            key={opt.key}
            onClick={() => handlePeriodChange(opt.key)}
            className={`px-4 py-2 rounded-full text-xs font-semibold transition-all ${
              period === opt.key
                ? 'bg-teal-500 text-white shadow-md shadow-teal-200'
                : 'bg-white text-slate-500 border border-slate-200 hover:border-teal-300'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {showCustom && (
        <CustomCalendar startDate={customStart} endDate={customEnd} onSelect={(s, e) => { setCustomStart(s); setCustomEnd(e); }} />
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
          <Loader2 size={28} className="animate-spin text-teal-400" />
          <span className="text-sm">Загружаю данные...</span>
        </div>
      ) : !stats ? (
        <div className="text-center py-16 text-slate-400 text-sm">Нет данных за этот период</div>
      ) : (
        <>
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal-500 to-teal-600 p-5 shadow-lg shadow-teal-200">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-8 translate-x-8" />
            <div className="absolute bottom-0 left-0 w-20 h-20 bg-white/5 rounded-full translate-y-6 -translate-x-6" />
            <div className="relative">
              <div className="flex items-center gap-1.5 mb-1">
                <Wallet size={13} className="text-teal-200" />
                <span className="text-teal-100 text-xs font-medium">Выручка {periodLabel}</span>
              </div>
              <div className="text-3xl font-bold text-white tracking-tight">{formatCurrency(s?.totalAmount || 0)}</div>
              {(s?.avgCheck || 0) > 0 && (
                <div className="mt-2 text-teal-100 text-xs">средний чек — {formatCurrency(s?.avgCheck || 0)}</div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white rounded-2xl border border-slate-100 p-3 shadow-sm text-center">
              <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center mx-auto mb-1.5">
                <Users size={15} className="text-blue-500" />
              </div>
              <div className="text-xl font-bold text-slate-800">{s?.uniqueClients || 0}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">клиентов</div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 p-3 shadow-sm text-center">
              <div className="w-8 h-8 rounded-xl bg-violet-50 flex items-center justify-center mx-auto mb-1.5">
                <Calendar size={15} className="text-violet-500" />
              </div>
              <div className="text-xl font-bold text-slate-800">{s?.totalVisits || 0}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                визитов{(s?.zeroVisits || 0) > 0 ? ` (${s?.zeroVisits} без опл.)` : ''}
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 p-3 shadow-sm text-center">
              <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center mx-auto mb-1.5">
                <TrendingUp size={15} className="text-amber-500" />
              </div>
              <div className="text-xl font-bold text-slate-800">{s?.totalEntries || 0}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">записей</div>
            </div>
          </div>

          {totalClients > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <Star size={14} className="text-slate-400" />
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Новые и постоянные</span>
              </div>
              <div className="flex gap-3">
                <div className="flex-1 bg-orange-50 rounded-xl p-3">
                  <div className="text-[11px] text-orange-400 font-medium mb-1">🌱 Новые</div>
                  <div className="text-lg font-bold text-orange-600">{s?.primaryCount || 0}</div>
                  <div className="text-xs text-orange-400 mt-0.5">{formatCurrency(s?.primaryAmount || 0)}</div>
                </div>
                <div className="flex-1 bg-teal-50 rounded-xl p-3">
                  <div className="text-[11px] text-teal-500 font-medium mb-1">💎 Постоянные</div>
                  <div className="text-lg font-bold text-teal-600">{s?.regularCount || 0}</div>
                  <div className="text-xs text-teal-400 mt-0.5">{formatCurrency(s?.regularAmount || 0)}</div>
                </div>
              </div>
              <div className="mt-3 h-2 bg-slate-100 rounded-full overflow-hidden flex">
                <div className="h-full bg-orange-400 rounded-l-full transition-all" style={{ width: `${primaryPct}%` }} />
                <div className="h-full bg-teal-400 rounded-r-full transition-all" style={{ width: `${100 - primaryPct}%` }} />
              </div>
              <div className="flex justify-between mt-1.5">
                <span className="text-[10px] text-orange-400">{primaryPct}%</span>
                <span className="text-[10px] text-teal-500">{100 - primaryPct}%</span>
              </div>
            </div>
          )}

          {(s?.abonementCount || 0) > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Sparkles size={14} className="text-violet-400" />
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Абонементы</span>
                </div>
                {conversionTotal > 0 && (
                  <span className="text-[11px] font-bold text-violet-600 bg-violet-50 px-2.5 py-1 rounded-full">
                    {conversionTotal}% конверсия
                  </span>
                )}
              </div>

              <div className="bg-gradient-to-r from-violet-50 to-purple-50 rounded-xl p-3 mb-3">
                <div className="text-[11px] text-violet-400 font-medium mb-0.5">Всего продано</div>
                <div className="text-2xl font-bold text-violet-700">{formatCurrency(s?.abonementAmount || 0)}</div>
                <div className="text-xs text-violet-400 mt-0.5">
                  {pluralSales(s?.abonementCount || 0)}{abTotalAvg > 0 ? ` · ср. чек ${formatCurrency(abTotalAvg)}` : ''}
                </div>
              </div>

              {((s?.abonementPrimaryCount || 0) > 0 || (s?.abonementRegularCount || 0) > 0) && (
                <div className="flex gap-2">
                  {(s?.abonementPrimaryCount || 0) > 0 && (
                    <div className="flex-1 bg-orange-50 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] text-orange-500 font-semibold">🌱 Новым</span>
                        {conversionPrimary > 0 && (
                          <span className="text-[10px] font-bold text-orange-400 bg-orange-100 px-1.5 py-0.5 rounded-full">{conversionPrimary}%</span>
                        )}
                      </div>
                      <div className="text-base font-bold text-orange-700">{formatCurrency(s?.abonementPrimaryAmount || 0)}</div>
                      <div className="text-[11px] text-orange-400 mt-0.5">{pluralSales(s?.abonementPrimaryCount || 0)}</div>
                      {abPrimaryAvg > 0 && <div className="text-[11px] text-orange-400">ср. {formatCurrency(abPrimaryAvg)}</div>}
                    </div>
                  )}
                  {(s?.abonementRegularCount || 0) > 0 && (
                    <div className="flex-1 bg-teal-50 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] text-teal-500 font-semibold">💎 Постоянным</span>
                        {conversionRegular > 0 && (
                          <span className="text-[10px] font-bold text-teal-500 bg-teal-100 px-1.5 py-0.5 rounded-full">{conversionRegular}%</span>
                        )}
                      </div>
                      <div className="text-base font-bold text-teal-700">{formatCurrency(s?.abonementRegularAmount || 0)}</div>
                      <div className="text-[11px] text-teal-400 mt-0.5">{pluralSales(s?.abonementRegularCount || 0)}</div>
                      {abRegularAvg > 0 && <div className="text-[11px] text-teal-400">ср. {formatCurrency(abRegularAvg)}</div>}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {stats.daily.length > 1 && (
            <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp size={14} className="text-slate-400" />
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Выручка по дням</span>
              </div>
              <ResponsiveContainer width="100%" height={170}>
                <BarChart data={stats.daily} margin={{ top: 4, right: 0, left: -24, bottom: 0 }}>
                  <XAxis dataKey="date" tickFormatter={formatShortDate} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(v: number) => v >= 1000 ? `${Math.round(v / 1000)}к` : String(v)} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(value: number) => [formatCurrency(value), 'Выручка']}
                    labelFormatter={(label: string) => new Date(label + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'short' })}
                    contentStyle={{ fontSize: 12, borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                    cursor={{ fill: 'rgba(0,0,0,0.03)' }}
                  />
                  <Bar dataKey="amount" radius={[6, 6, 0, 0]} maxBarSize={28}>
                    {stats.daily.map((_, i) => (
                      <Cell key={i} fill={i === stats.daily.length - 1 ? '#14b8a6' : '#ccfbf1'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {stats.byPayment.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <CreditCard size={14} className="text-slate-400" />
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Как оплачивали</span>
              </div>
              <div className="space-y-2.5">
                {stats.byPayment.map((p, i) => {
                  const pct = s?.totalAmount ? Math.round((p.amount / s.totalAmount) * 100) : 0;
                  const colors = ['#14b8a6', '#f97316', '#8b5cf6', '#06b6d4', '#10b981'];
                  return (
                    <div key={i}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-600 font-medium">{PAYMENT_LABELS[p.type] || p.type}</span>
                        <span className="text-slate-500">{formatCurrency(p.amount)} <span className="text-slate-300">·</span> <span className="text-slate-400">{pct}%</span></span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: colors[i % colors.length] }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {stats.byCategory.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <Tag size={14} className="text-slate-400" />
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">По услугам</span>
              </div>
              <div className="space-y-2">
                {stats.byCategory.map((cat, i) => {
                  const pct = s?.totalAmount ? Math.round((cat.amount / s.totalAmount) * 100) : 0;
                  return (
                    <div key={i} className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
                      <span className="text-sm text-slate-700">{cat.name}</span>
                      <div className="text-right">
                        <span className="text-sm font-semibold text-slate-700 tabular-nums">{formatCurrency(cat.amount)}</span>
                        <span className="text-xs text-slate-400 ml-1.5">{pct}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
