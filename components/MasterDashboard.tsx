import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Loader2, TrendingUp, Users, Receipt, CreditCard, Banknote, ChevronDown } from 'lucide-react';
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

function getDateRange(period: PeriodKey, customStart?: string, customEnd?: string): { startDate: string; endDate: string } {
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().split('T')[0];

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
        setCustomStart(monthAgo.toISOString().split('T')[0]);
        setCustomEnd(today.toISOString().split('T')[0]);
      }
    } else {
      setShowCustom(false);
    }
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
            {opt.key === 'custom' && period === 'custom' && <ChevronDown size={12} className="inline ml-1" />}
          </button>
        ))}
      </div>

      {showCustom && (
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="block text-xs text-slate-500 mb-1">С</label>
            <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
              className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-slate-500 mb-1">По</label>
            <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
              className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
          </div>
        </div>
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
                <span className="text-xs text-slate-500">Записей</span>
              </div>
              <div className="text-lg font-bold text-slate-800">{s?.totalEntries || 0}</div>
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
