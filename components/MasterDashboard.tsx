import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Loader2, TrendingUp, Users, Receipt, CreditCard, Banknote, ChevronLeft, ChevronRight } from 'lucide-react';
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

const CHART_COLORS = ['#0d9488', '#14b8a6', '#5eead4', '#99f6e4', '#ccfbf1'];

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

  const prevMonth = () => {
    setViewMonth(v => v.month === 0 ? { year: v.year - 1, month: 11 } : { year: v.year, month: v.month - 1 });
  };
  const nextMonth = () => {
    setViewMonth(v => v.month === 11 ? { year: v.year + 1, month: 0 } : { year: v.year, month: v.month + 1 });
  };

  const handleDayClick = (day: number) => {
    const dateStr = `${viewMonth.year}-${String(viewMonth.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    if (!selecting || selecting === 'start') {
      setTempStart(dateStr);
      setTempEnd('');
      setSelecting('end');
    } else {
      let s = tempStart, e = dateStr;
      if (s > e) [s, e] = [e, s];
      setTempStart(s);
      setTempEnd(e);
      setSelecting(null);
      onSelect(s, e);
    }
  };

  const isInRange = (day: number) => {
    const dateStr = `${viewMonth.year}-${String(viewMonth.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const s = tempStart || startDate;
    const e = tempEnd || endDate;
    if (!s || !e) return false;
    return dateStr >= s && dateStr <= e;
  };

  const isStart = (day: number) => {
    const dateStr = `${viewMonth.year}-${String(viewMonth.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return dateStr === (tempStart || startDate);
  };

  const isEnd = (day: number) => {
    const dateStr = `${viewMonth.year}-${String(viewMonth.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return dateStr === (tempEnd || endDate);
  };

  const isToday = (day: number) => {
    const today = new Date();
    return day === today.getDate() && viewMonth.month === today.getMonth() && viewMonth.year === today.getFullYear();
  };

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <button onClick={prevMonth} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500 transition-colors">
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm font-semibold text-slate-700">{MONTH_NAMES[viewMonth.month]} {viewMonth.year}</span>
        <button onClick={nextMonth} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500 transition-colors">
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0 mb-1">
        {WEEKDAY_SHORT.map(wd => (
          <div key={wd} className="text-center text-[10px] font-medium text-slate-400 py-1">{wd}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0">
        {cells.map((day, i) => {
          if (day === null) return <div key={i} />;
          const inRange = isInRange(day);
          const start = isStart(day);
          const end = isEnd(day);
          const td = isToday(day);

          return (
            <button
              key={i}
              onClick={() => handleDayClick(day)}
              className={`
                h-9 text-xs font-medium relative flex items-center justify-center transition-all
                ${inRange && !start && !end ? 'bg-teal-50 text-teal-700' : ''}
                ${start || end ? 'bg-teal-600 text-white rounded-full z-10' : ''}
                ${!inRange && !start && !end ? 'text-slate-600 hover:bg-slate-50 rounded-full' : ''}
                ${td && !start && !end && !inRange ? 'ring-1 ring-teal-400 rounded-full' : ''}
              `}
            >
              {day}
            </button>
          );
        })}
      </div>

      {selecting === 'end' && (
        <div className="mt-2 text-center text-xs text-teal-600 font-medium">
          Выберите конечную дату
        </div>
      )}

      {(tempStart || startDate) && (tempEnd || endDate) && !selecting && (
        <div className="mt-2 text-center text-xs text-slate-500">
          {formatShortDate(tempStart || startDate)} — {formatShortDate(tempEnd || endDate)}
        </div>
      )}
    </div>
  );
};

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
      if (res.ok) {
        setStats(await res.json());
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, [user, period, customStart, customEnd]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const handlePeriodChange = (key: PeriodKey) => {
    setPeriod(key);
    if (key === 'custom') {
      setShowCustom(true);
      if (!customStart || !customEnd) {
        const today = new Date();
        const monthAgo = new Date(today);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        setCustomStart(fmt(monthAgo));
        setCustomEnd(fmt(today));
      }
    } else {
      setShowCustom(false);
    }
  };

  const handleCalendarSelect = (start: string, end: string) => {
    setCustomStart(start);
    setCustomEnd(end);
  };

  const s = stats?.summary;
  const totalClients = (s?.primaryCount || 0) + (s?.regularCount || 0);
  const primaryPct = totalClients > 0 ? Math.round(((s?.primaryCount || 0) / totalClients) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {PERIOD_OPTIONS.map(opt => (
          <button
            key={opt.key}
            onClick={() => handlePeriodChange(opt.key)}
            className={`px-3 py-2 rounded-full text-xs font-medium border transition-all ${period === opt.key ? 'bg-teal-600 text-white border-teal-600 shadow-sm' : 'bg-white text-slate-600 border-slate-300 hover:border-teal-400'}`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {showCustom && (
        <CustomCalendar
          startDate={customStart}
          endDate={customEnd}
          onSelect={handleCalendarSelect}
        />
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Loader2 size={20} className="animate-spin mr-2" /> Загрузка...
        </div>
      ) : !stats ? (
        <div className="text-center py-12 text-slate-400 text-sm">Нет данных</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="bg-white rounded-2xl border border-slate-200 p-3.5">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-7 h-7 rounded-lg bg-teal-50 flex items-center justify-center">
                  <TrendingUp size={14} className="text-teal-600" />
                </div>
                <span className="text-xs text-slate-500">Выручка</span>
              </div>
              <div className="text-lg font-bold text-slate-800">{formatCurrency(s?.totalAmount || 0)}</div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-3.5">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Users size={14} className="text-blue-600" />
                </div>
                <span className="text-xs text-slate-500">Клиенты</span>
              </div>
              <div className="text-lg font-bold text-slate-800">{s?.uniqueClients || 0}</div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-3.5">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center">
                  <Receipt size={14} className="text-amber-600" />
                </div>
                <span className="text-xs text-slate-500">Средний чек</span>
              </div>
              <div className="text-lg font-bold text-slate-800">{formatCurrency(s?.avgCheck || 0)}</div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-3.5">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center">
                  <Banknote size={14} className="text-violet-600" />
                </div>
                <span className="text-xs text-slate-500">Визитов</span>
              </div>
              <div className="text-lg font-bold text-slate-800">{s?.totalVisits || 0}</div>
              {(s?.zeroVisits || 0) > 0 && (
                <div className="text-[10px] text-slate-400 mt-0.5">без оплаты: {s?.zeroVisits}</div>
              )}
            </div>
          </div>

          {totalClients > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <div className="text-xs font-medium text-slate-500 mb-2.5">Первичные / Постоянные</div>
              <div className="flex gap-3 items-center">
                <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden flex">
                  <div className="h-full bg-orange-400 rounded-l-full transition-all" style={{ width: `${primaryPct}%` }} />
                  <div className="h-full bg-teal-500 rounded-r-full transition-all" style={{ width: `${100 - primaryPct}%` }} />
                </div>
              </div>
              <div className="flex justify-between mt-2 text-xs">
                <span className="text-orange-600 font-medium">{s?.primaryCount || 0} перв. · {formatCurrency(s?.primaryAmount || 0)}</span>
                <span className="text-teal-600 font-medium">{s?.regularCount || 0} пост. · {formatCurrency(s?.regularAmount || 0)}</span>
              </div>
            </div>
          )}

          {(s?.abonementCount || 0) > 0 && (() => {
            const abPrimaryAvg = (s?.abonementPrimaryCount || 0) > 0 ? Math.round((s?.abonementPrimaryAmount || 0) / (s?.abonementPrimaryCount || 1)) : 0;
            const abRegularAvg = (s?.abonementRegularCount || 0) > 0 ? Math.round((s?.abonementRegularAmount || 0) / (s?.abonementRegularCount || 1)) : 0;
            const abTotalAvg = (s?.abonementCount || 0) > 0 ? Math.round((s?.abonementAmount || 0) / (s?.abonementCount || 1)) : 0;
            const conversionPrimary = (s?.primaryCount || 0) > 0 ? Math.round(((s?.abonementPrimaryCount || 0) / (s?.primaryCount || 1)) * 100) : 0;
            const conversionRegular = (s?.regularCount || 0) > 0 ? Math.round(((s?.abonementRegularCount || 0) / (s?.regularCount || 1)) * 100) : 0;
            const conversionTotal = (s?.uniqueClients || 0) > 0 ? Math.round(((s?.abonementCount || 0) / (s?.uniqueClients || 1)) * 100) : 0;
            return (
              <div className="bg-white rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center">
                      <Receipt size={14} className="text-violet-600" />
                    </div>
                    <span className="text-xs font-medium text-slate-500">Продажи абонементов</span>
                  </div>
                  {conversionTotal > 0 && (
                    <span className="text-[11px] font-semibold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full">
                      {conversionTotal}% конверсия
                    </span>
                  )}
                </div>
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-lg font-bold text-violet-700">{formatCurrency(s?.abonementAmount || 0)}</span>
                  <span className="text-xs text-slate-400">{s?.abonementCount} {(s?.abonementCount || 0) === 1 ? 'продажа' : (s?.abonementCount || 0) < 5 ? 'продажи' : 'продаж'}</span>
                </div>
                {abTotalAvg > 0 && (
                  <div className="text-xs text-slate-400 mb-3">ср. чек {formatCurrency(abTotalAvg)}</div>
                )}
                {((s?.abonementPrimaryCount || 0) > 0 || (s?.abonementRegularCount || 0) > 0) && (
                  <div className="border-t border-slate-100 pt-2.5 flex gap-3">
                    {(s?.abonementPrimaryCount || 0) > 0 && (
                      <div className="flex-1 bg-orange-50 rounded-xl p-2.5">
                        <div className="flex items-center justify-between mb-0.5">
                          <div className="text-xs text-orange-500 font-medium">Первичные</div>
                          {conversionPrimary > 0 && <div className="text-[10px] font-semibold text-orange-400">{conversionPrimary}%</div>}
                        </div>
                        <div className="text-sm font-bold text-orange-700">{formatCurrency(s?.abonementPrimaryAmount || 0)}</div>
                        <div className="text-xs text-orange-400">{s?.abonementPrimaryCount} {(s?.abonementPrimaryCount || 0) === 1 ? 'прод.' : 'прод.'} · ср. {formatCurrency(abPrimaryAvg)}</div>
                      </div>
                    )}
                    {(s?.abonementRegularCount || 0) > 0 && (
                      <div className="flex-1 bg-teal-50 rounded-xl p-2.5">
                        <div className="flex items-center justify-between mb-0.5">
                          <div className="text-xs text-teal-500 font-medium">Постоянные</div>
                          {conversionRegular > 0 && <div className="text-[10px] font-semibold text-teal-400">{conversionRegular}%</div>}
                        </div>
                        <div className="text-sm font-bold text-teal-700">{formatCurrency(s?.abonementRegularAmount || 0)}</div>
                        <div className="text-xs text-teal-400">{s?.abonementRegularCount} {(s?.abonementRegularCount || 0) === 1 ? 'прод.' : 'прод.'} · ср. {formatCurrency(abRegularAvg)}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          {stats.daily.length > 1 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <div className="text-xs font-medium text-slate-500 mb-3">Выручка по дням</div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={stats.daily} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatShortDate}
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={(v: number) => v >= 1000 ? `${Math.round(v / 1000)}к` : String(v)}
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(value: number) => [formatCurrency(value), 'Выручка']}
                    labelFormatter={(label: string) => {
                      const d = new Date(label + 'T00:00:00');
                      return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'short' });
                    }}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                  />
                  <Bar dataKey="amount" radius={[4, 4, 0, 0]} maxBarSize={32}>
                    {stats.daily.map((_, i) => (
                      <Cell key={i} fill={i === stats.daily.length - 1 ? '#0d9488' : '#99f6e4'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {stats.byPayment.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <div className="text-xs font-medium text-slate-500 mb-2.5">По типу оплаты</div>
              <div className="space-y-2">
                {stats.byPayment.map((p, i) => {
                  const pct = s?.totalAmount ? Math.round((p.amount / s.totalAmount) * 100) : 0;
                  return (
                    <div key={i}>
                      <div className="flex justify-between text-xs mb-0.5">
                        <span className="text-slate-700 font-medium flex items-center gap-1.5">
                          <CreditCard size={12} className="text-slate-400" />
                          {PAYMENT_LABELS[p.type] || p.type}
                        </span>
                        <span className="text-slate-500">{formatCurrency(p.amount)} ({pct}%)</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {stats.byCategory.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <div className="text-xs font-medium text-slate-500 mb-2.5">По статьям</div>
              <div className="space-y-1.5">
                {stats.byCategory.map((cat, i) => {
                  const pct = s?.totalAmount ? Math.round((cat.amount / s.totalAmount) * 100) : 0;
                  return (
                    <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-slate-50 last:border-0">
                      <span className="text-slate-700">{cat.name}</span>
                      <span className="text-slate-500 font-medium tabular-nums">{formatCurrency(cat.amount)} <span className="text-slate-400">({pct}%)</span></span>
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
