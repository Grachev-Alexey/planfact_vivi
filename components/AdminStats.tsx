import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Loader2, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Wallet, Users, Calendar, TrendingUp, Sparkles, Building2 } from 'lucide-react';
import { formatCurrency } from '../utils/format';

type PeriodKey = 'today' | 'week' | 'month' | 'custom';

const PERIOD_OPTIONS: { key: PeriodKey; label: string }[] = [
  { key: 'today', label: 'Сегодня' },
  { key: 'week', label: 'Неделя' },
  { key: 'month', label: 'Месяц' },
  { key: 'custom', label: 'Период' },
];

const MONTH_NAMES = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const WEEKDAY_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

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

function pluralSales(n: number) {
  if (n === 1) return '1 продажа'; if (n >= 2 && n <= 4) return `${n} продажи`; return `${n} продаж`;
}

interface Summary {
  totalAmount: number; totalEntries: number; uniqueClients: number; avgCheck: number;
  primaryAmount: number; regularAmount: number; primaryCount: number; regularCount: number;
  totalVisits: number; zeroVisits: number;
  abonementAmount: number; abonementCount: number;
  abonementPrimaryAmount: number; abonementPrimaryCount: number;
  abonementRegularAmount: number; abonementRegularCount: number;
}

interface MasterData { id: number; name: string; summary: Summary; }
interface StudioData { id: number; name: string; summary: Summary; masters: MasterData[]; daily: { date: string; amount: number }[]; }
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
    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => setViewMonth(v => v.month === 0 ? { year: v.year - 1, month: 11 } : { year: v.year, month: v.month - 1 })} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500"><ChevronLeft size={16} /></button>
        <span className="text-sm font-semibold text-slate-700">{MONTH_NAMES[viewMonth.month]} {viewMonth.year}</span>
        <button onClick={() => setViewMonth(v => v.month === 11 ? { year: v.year + 1, month: 0 } : { year: v.year, month: v.month + 1 })} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500"><ChevronRight size={16} /></button>
      </div>
      <div className="grid grid-cols-7 mb-1">{WEEKDAY_SHORT.map(w => <div key={w} className="text-center text-[10px] font-medium text-slate-400 py-1">{w}</div>)}</div>
      <div className="grid grid-cols-7">
        {cells.map((day, i) => {
          if (day === null) return <div key={i} />;
          const d = getDateStr(day), s = tempStart || startDate, e = tempEnd || endDate;
          const inRange = !!(s && e && d >= s && d <= e);
          const isS = d === s, isE = d === e;
          const isToday = (() => { const t = new Date(); return day === t.getDate() && viewMonth.month === t.getMonth() && viewMonth.year === t.getFullYear(); })();
          return (
            <button key={i} onClick={() => handleDay(day)} className={`h-9 text-xs font-medium flex items-center justify-center transition-all ${inRange && !isS && !isE ? 'bg-teal-50 text-teal-700' : ''} ${isS || isE ? 'bg-teal-500 text-white rounded-full shadow-sm' : ''} ${!inRange && !isS && !isE ? 'text-slate-600 hover:bg-slate-50 rounded-full' : ''} ${isToday && !isS && !isE && !inRange ? 'ring-1 ring-teal-400 rounded-full' : ''}`}>{day}</button>
          );
        })}
      </div>
      {selecting === 'end' && <div className="mt-2 text-center text-xs text-teal-600 font-medium">Выберите конечную дату</div>}
      {(tempStart || startDate) && (tempEnd || endDate) && !selecting && <div className="mt-2 text-center text-xs text-slate-500">{formatShortDate(tempStart || startDate)} — {formatShortDate(tempEnd || endDate)}</div>}
    </div>
  );
};

const SummaryStats: React.FC<{ s: Summary; compact?: boolean }> = ({ s, compact }) => {
  const abPrimaryAvg = s.abonementPrimaryCount > 0 ? Math.round(s.abonementPrimaryAmount / s.abonementPrimaryCount) : 0;
  const abRegularAvg = s.abonementRegularCount > 0 ? Math.round(s.abonementRegularAmount / s.abonementRegularCount) : 0;
  const abTotalAvg = s.abonementCount > 0 ? Math.round(s.abonementAmount / s.abonementCount) : 0;
  const conversionPrimary = s.primaryCount > 0 ? Math.round((s.abonementPrimaryCount / s.primaryCount) * 100) : 0;
  const conversionRegular = s.regularCount > 0 ? Math.round((s.abonementRegularCount / s.regularCount) * 100) : 0;
  const conversionTotal = s.uniqueClients > 0 ? Math.round((s.abonementCount / s.uniqueClients) * 100) : 0;
  const totalClients = s.primaryCount + s.regularCount;
  const primaryPct = totalClients > 0 ? Math.round((s.primaryCount / totalClients) * 100) : 0;

  if (compact) {
    return (
      <div className="space-y-3 pt-3">
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-slate-50 rounded-xl p-2.5 text-center">
            <div className="text-base font-bold text-slate-800">{s.uniqueClients}</div>
            <div className="text-[10px] text-slate-400">клиентов</div>
          </div>
          <div className="bg-slate-50 rounded-xl p-2.5 text-center">
            <div className="text-base font-bold text-slate-800">{s.totalVisits}</div>
            <div className="text-[10px] text-slate-400">визитов</div>
          </div>
          <div className="bg-slate-50 rounded-xl p-2.5 text-center">
            <div className="text-base font-bold text-slate-800">{formatCurrency(s.avgCheck)}</div>
            <div className="text-[10px] text-slate-400">ср. чек</div>
          </div>
        </div>

        {totalClients > 0 && (
          <div className="flex gap-2">
            <div className="flex-1 bg-orange-50 rounded-xl p-2.5">
              <div className="text-[10px] text-orange-400 font-medium">🌱 Новые</div>
              <div className="text-sm font-bold text-orange-600">{s.primaryCount}</div>
              <div className="text-[10px] text-orange-400">{formatCurrency(s.primaryAmount)}</div>
            </div>
            <div className="flex-1 bg-teal-50 rounded-xl p-2.5">
              <div className="text-[10px] text-teal-500 font-medium">💎 Постоянные</div>
              <div className="text-sm font-bold text-teal-600">{s.regularCount}</div>
              <div className="text-[10px] text-teal-400">{formatCurrency(s.regularAmount)}</div>
            </div>
          </div>
        )}

        {s.abonementCount > 0 && (
          <div className="bg-violet-50 rounded-xl p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] text-violet-500 font-semibold flex items-center gap-1"><Sparkles size={11} /> Абонементы</span>
              {conversionTotal > 0 && <span className="text-[10px] font-bold text-violet-500 bg-violet-100 px-1.5 py-0.5 rounded-full">{conversionTotal}% конв.</span>}
            </div>
            <div className="text-base font-bold text-violet-700">{formatCurrency(s.abonementAmount)}</div>
            <div className="text-[11px] text-violet-400">{pluralSales(s.abonementCount)}{abTotalAvg > 0 ? ` · ср. ${formatCurrency(abTotalAvg)}` : ''}</div>
            {(s.abonementPrimaryCount > 0 || s.abonementRegularCount > 0) && (
              <div className="flex gap-2 mt-2">
                {s.abonementPrimaryCount > 0 && (
                  <div className="flex-1 bg-orange-50 rounded-lg p-1.5">
                    <div className="flex justify-between"><span className="text-[10px] text-orange-500">🌱 Новым</span>{conversionPrimary > 0 && <span className="text-[10px] font-bold text-orange-400">{conversionPrimary}%</span>}</div>
                    <div className="text-xs font-bold text-orange-700">{formatCurrency(s.abonementPrimaryAmount)}</div>
                    {abPrimaryAvg > 0 && <div className="text-[10px] text-orange-400">ср. {formatCurrency(abPrimaryAvg)}</div>}
                  </div>
                )}
                {s.abonementRegularCount > 0 && (
                  <div className="flex-1 bg-teal-50 rounded-lg p-1.5">
                    <div className="flex justify-between"><span className="text-[10px] text-teal-500">💎 Пост.</span>{conversionRegular > 0 && <span className="text-[10px] font-bold text-teal-500">{conversionRegular}%</span>}</div>
                    <div className="text-xs font-bold text-teal-700">{formatCurrency(s.abonementRegularAmount)}</div>
                    {abRegularAvg > 0 && <div className="text-[10px] text-teal-400">ср. {formatCurrency(abRegularAvg)}</div>}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: 'Клиентов', value: s.uniqueClients, icon: <Users size={14} className="text-blue-400" />, bg: 'bg-blue-50' },
          { label: 'Визитов', value: s.totalVisits, icon: <Calendar size={14} className="text-violet-400" />, bg: 'bg-violet-50' },
          { label: 'Средний чек', value: formatCurrency(s.avgCheck), icon: <TrendingUp size={14} className="text-amber-400" />, bg: 'bg-amber-50' },
          { label: 'Записей', value: s.totalEntries, icon: <TrendingUp size={14} className="text-slate-400" />, bg: 'bg-slate-50' },
        ].map((item, i) => (
          <div key={i} className="bg-white border border-slate-100 rounded-xl p-3 text-center shadow-sm">
            <div className={`w-8 h-8 ${item.bg} rounded-xl flex items-center justify-center mx-auto mb-1.5`}>{item.icon}</div>
            <div className="text-base font-bold text-slate-800">{item.value}</div>
            <div className="text-[11px] text-slate-400">{item.label}</div>
          </div>
        ))}
      </div>

      {totalClients > 0 && (
        <div className="bg-white border border-slate-100 rounded-xl p-3 shadow-sm">
          <div className="flex gap-2 mb-2">
            <div className="flex-1 bg-orange-50 rounded-lg p-2.5">
              <div className="text-[11px] text-orange-400 font-medium">🌱 Новые</div>
              <div className="text-lg font-bold text-orange-600">{s.primaryCount}</div>
              <div className="text-xs text-orange-400">{formatCurrency(s.primaryAmount)}</div>
            </div>
            <div className="flex-1 bg-teal-50 rounded-lg p-2.5">
              <div className="text-[11px] text-teal-500 font-medium">💎 Постоянные</div>
              <div className="text-lg font-bold text-teal-600">{s.regularCount}</div>
              <div className="text-xs text-teal-400">{formatCurrency(s.regularAmount)}</div>
            </div>
          </div>
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden flex">
            <div className="h-full bg-orange-400" style={{ width: `${primaryPct}%` }} />
            <div className="h-full bg-teal-400" style={{ width: `${100 - primaryPct}%` }} />
          </div>
        </div>
      )}

      {s.abonementCount > 0 && (
        <div className="bg-white border border-slate-100 rounded-xl p-3 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-violet-500 flex items-center gap-1"><Sparkles size={12} /> Абонементы</span>
            {conversionTotal > 0 && <span className="text-[11px] font-bold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full">{conversionTotal}% конверсия</span>}
          </div>
          <div className="bg-violet-50 rounded-lg p-2.5 mb-2">
            <div className="text-xl font-bold text-violet-700">{formatCurrency(s.abonementAmount)}</div>
            <div className="text-xs text-violet-400">{pluralSales(s.abonementCount)}{abTotalAvg > 0 ? ` · ср. ${formatCurrency(abTotalAvg)}` : ''}</div>
          </div>
          {(s.abonementPrimaryCount > 0 || s.abonementRegularCount > 0) && (
            <div className="flex gap-2">
              {s.abonementPrimaryCount > 0 && (
                <div className="flex-1 bg-orange-50 rounded-lg p-2">
                  <div className="flex justify-between items-center mb-1"><span className="text-[10px] text-orange-500 font-semibold">🌱 Новым</span>{conversionPrimary > 0 && <span className="text-[10px] font-bold text-orange-400 bg-orange-100 px-1 py-0.5 rounded-full">{conversionPrimary}%</span>}</div>
                  <div className="text-sm font-bold text-orange-700">{formatCurrency(s.abonementPrimaryAmount)}</div>
                  <div className="text-[10px] text-orange-400">{pluralSales(s.abonementPrimaryCount)}{abPrimaryAvg > 0 ? ` · ср. ${formatCurrency(abPrimaryAvg)}` : ''}</div>
                </div>
              )}
              {s.abonementRegularCount > 0 && (
                <div className="flex-1 bg-teal-50 rounded-lg p-2">
                  <div className="flex justify-between items-center mb-1"><span className="text-[10px] text-teal-500 font-semibold">💎 Постоянным</span>{conversionRegular > 0 && <span className="text-[10px] font-bold text-teal-500 bg-teal-100 px-1 py-0.5 rounded-full">{conversionRegular}%</span>}</div>
                  <div className="text-sm font-bold text-teal-700">{formatCurrency(s.abonementRegularAmount)}</div>
                  <div className="text-[10px] text-teal-400">{pluralSales(s.abonementRegularCount)}{abRegularAvg > 0 ? ` · ср. ${formatCurrency(abRegularAvg)}` : ''}</div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const MasterCard: React.FC<{ master: MasterData }> = ({ master }) => {
  const [open, setOpen] = useState(false);
  const s = master.summary;
  return (
    <div className="border border-slate-100 rounded-xl overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between p-3 hover:bg-slate-50 transition-colors">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center text-white font-bold text-xs shadow-sm">
            {master.name[0]?.toUpperCase()}
          </div>
          <div className="text-left">
            <div className="text-sm font-semibold text-slate-800">{master.name}</div>
            <div className="text-[11px] text-slate-400">{formatCurrency(s.totalAmount)} · {s.uniqueClients} кл.</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {s.abonementCount > 0 && (
            <span className="text-[10px] font-bold text-violet-500 bg-violet-50 px-1.5 py-0.5 rounded-full">
              <Sparkles size={9} className="inline mr-0.5" />{s.abonementCount} або.
            </span>
          )}
          {open ? <ChevronUp size={15} className="text-slate-400" /> : <ChevronDown size={15} className="text-slate-400" />}
        </div>
      </button>
      {open && (
        <div className="px-3 pb-3 border-t border-slate-100">
          <SummaryStats s={s} compact />
        </div>
      )}
    </div>
  );
};

const StudioCard: React.FC<{ studio: StudioData }> = ({ studio }) => {
  const [open, setOpen] = useState(true);
  const s = studio.summary;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center shadow-sm">
            <Building2 size={16} className="text-white" />
          </div>
          <div className="text-left">
            <div className="text-sm font-bold text-slate-800">{studio.name}</div>
            <div className="text-xs text-slate-400">{s.uniqueClients} клиентов · {studio.masters.length} мастеров</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right">
            <div className="text-base font-bold text-teal-600">{formatCurrency(s.totalAmount)}</div>
            {s.abonementAmount > 0 && <div className="text-[10px] text-violet-400">або. {formatCurrency(s.abonementAmount)}</div>}
          </div>
          {open ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-slate-100">
          <div className="p-4 bg-slate-50/50">
            <SummaryStats s={s} />
          </div>

          {studio.daily.length > 1 && (
            <div className="px-4 pb-4">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Выручка по дням</div>
              <ResponsiveContainer width="100%" height={120}>
                <BarChart data={studio.daily} margin={{ top: 2, right: 0, left: -28, bottom: 0 }}>
                  <XAxis dataKey="date" tickFormatter={formatShortDate} tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(v: number) => v >= 1000 ? `${Math.round(v / 1000)}к` : String(v)} tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v: number) => [formatCurrency(v), 'Выручка']} labelFormatter={(l: string) => formatShortDate(l)} contentStyle={{ fontSize: 11, borderRadius: 10, border: '1px solid #e2e8f0' }} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
                  <Bar dataKey="amount" radius={[4, 4, 0, 0]} maxBarSize={22}>
                    {studio.daily.map((_, i) => <Cell key={i} fill={i === studio.daily.length - 1 ? '#14b8a6' : '#ccfbf1'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="px-4 pb-4 space-y-2">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Мастера</div>
            {studio.masters.map(m => <MasterCard key={m.id} master={m} />)}
          </div>
        </div>
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

  return (
    <div className="space-y-3 pb-4">
      <div className="flex gap-1.5 flex-wrap">
        {PERIOD_OPTIONS.map(opt => (
          <button key={opt.key} onClick={() => handlePeriod(opt.key)}
            className={`px-4 py-2 rounded-full text-xs font-semibold transition-all ${period === opt.key ? 'bg-teal-500 text-white shadow-md shadow-teal-200' : 'bg-white text-slate-500 border border-slate-200 hover:border-teal-300'}`}>
            {opt.label}
          </button>
        ))}
      </div>

      {showCustom && <MiniCalendar startDate={customStart} endDate={customEnd} onSelect={(s, e) => { setCustomStart(s); setCustomEnd(e); }} />}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
          <Loader2 size={28} className="animate-spin text-teal-400" />
          <span className="text-sm">Загружаю данные...</span>
        </div>
      ) : !data ? (
        <div className="text-center py-16 text-slate-400 text-sm">Нет данных за этот период</div>
      ) : (
        <>
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal-500 to-teal-600 p-5 shadow-lg shadow-teal-200">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-8 translate-x-8" />
            <div className="absolute bottom-0 left-0 w-20 h-20 bg-white/5 rounded-full translate-y-6 -translate-x-6" />
            <div className="relative">
              <div className="flex items-center gap-1.5 mb-1">
                <Wallet size={13} className="text-teal-200" />
                <span className="text-teal-100 text-xs font-medium">Общая выручка {periodLabel}</span>
              </div>
              <div className="text-3xl font-bold text-white tracking-tight">{formatCurrency(data.overall.totalAmount)}</div>
              <div className="flex gap-4 mt-2">
                <span className="text-teal-100 text-xs">{data.overall.uniqueClients} клиентов</span>
                <span className="text-teal-100 text-xs">{data.overall.totalVisits} визитов</span>
                {data.overall.abonementCount > 0 && <span className="text-teal-100 text-xs"><Sparkles size={10} className="inline mr-0.5" />{pluralSales(data.overall.abonementCount)}</span>}
              </div>
            </div>
          </div>

          {data.overall.abonementCount > 0 && (() => {
            const convTotal = data.overall.uniqueClients > 0 ? Math.round((data.overall.abonementCount / data.overall.uniqueClients) * 100) : 0;
            const abAvg = data.overall.abonementCount > 0 ? Math.round(data.overall.abonementAmount / data.overall.abonementCount) : 0;
            return (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-violet-500 flex items-center gap-1.5"><Sparkles size={13} /> Абонементы — итого</span>
                  {convTotal > 0 && <span className="text-[11px] font-bold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full">{convTotal}% конверсия</span>}
                </div>
                <div className="text-2xl font-bold text-violet-700 mb-0.5">{formatCurrency(data.overall.abonementAmount)}</div>
                <div className="text-xs text-violet-400">{pluralSales(data.overall.abonementCount)}{abAvg > 0 ? ` · ср. чек ${formatCurrency(abAvg)}` : ''}</div>
              </div>
            );
          })()}

          <div className="space-y-3">
            {data.studios.map(studio => <StudioCard key={studio.id} studio={studio} />)}
          </div>
        </>
      )}
    </div>
  );
};
