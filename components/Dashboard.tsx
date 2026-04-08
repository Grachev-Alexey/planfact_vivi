import React, { useState, useMemo } from 'react';
import { useFinance } from '../context/FinanceContext';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Legend, CartesianGrid, BarChart,
} from 'recharts';

const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

const formatCompact = (v: number): string => {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)} млн`;
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(0)} тыс`;
  return String(v);
};

const formatNumber = (v: number): string => {
  const hasDecimals = v % 1 !== 0;
  return new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: hasDecimals ? 2 : 0,
  }).format(v);
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-sm">
      <div className="font-medium text-slate-700 mb-1.5">{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2 py-0.5">
          <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: p.color }} />
          <span className="text-slate-500">{p.name}:</span>
          <span className="font-medium text-slate-800">{formatNumber(p.value)} ₽</span>
        </div>
      ))}
    </div>
  );
};

export const Dashboard: React.FC = () => {
  const { transactions, accounts, studios } = useFinance();
  const [year, setYear] = useState(new Date().getFullYear());



  const totalBalance = useMemo(() => accounts.reduce((s, a) => s + a.balance, 0), [accounts]);

  const yearTx = useMemo(() =>
    transactions.filter(t => {
      const effectiveDate = (t.type === 'income' && t.creditDate) ? t.creditDate : t.date;
      const d = new Date(effectiveDate);
      if (d.getFullYear() !== year) return false;
      if (t.type === 'expense') return t.status === 'paid' || t.status === 'verified' || t.confirmed;
      return t.confirmed;
    }),
    [transactions, year]
  );

  const monthlyData = useMemo(() => {
    return MONTHS_SHORT.map((name, i) => {
      const monthTx = yearTx.filter(t => {
        const effectiveDate = (t.type === 'income' && t.creditDate) ? t.creditDate : t.date;
        return new Date(effectiveDate).getMonth() === i;
      });
      const income = monthTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
      const expense = monthTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
      const profit = income - expense;
      const profitability = income > 0 ? (profit / income) * 100 : 0;
      const inflows = income;
      const outflows = expense;
      return { name, income, expense, profit, profitability, inflows, outflows, diff: inflows - outflows };
    });
  }, [yearTx]);

  const totals = useMemo(() => {
    const income = yearTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expense = yearTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const profit = income - expense;
    const profitability = income > 0 ? (profit / income) * 100 : 0;
    const inflows = income;
    const outflows = expense;
    const diff = inflows - outflows;
    return { income, expense, profit, profitability, inflows, outflows, diff };
  }, [yearTx]);

  const cashFlowData = useMemo(() => {
    return monthlyData.map(m => ({
      name: m.name,
      inflows: m.inflows,
      outflows: -m.outflows,
    }));
  }, [monthlyData]);

  const profitChartData = useMemo(() => {
    return monthlyData.map(m => ({
      name: m.name,
      income: m.income,
      expense: m.expense,
      profit: m.profit,
    }));
  }, [monthlyData]);

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 fade-enter bg-slate-50 min-h-full">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-slate-800">Показатели</h1>
          <div className="text-xs sm:text-sm text-slate-400 mt-0.5">
            {new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-1 py-0.5">
            <button onClick={() => setYear(y => y - 1)} className="p-1.5 hover:bg-slate-50 rounded text-slate-500">
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs sm:text-sm font-medium text-slate-700 px-1 sm:px-2 min-w-[100px] sm:min-w-[120px] text-center">
              Янв '{String(year).slice(2)}—Дек '{String(year).slice(2)}
            </span>
            <button onClick={() => setYear(y => y + 1)} className="p-1.5 hover:bg-slate-50 rounded text-slate-500">
              <ChevronRight size={16} />
            </button>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg px-3 sm:px-4 py-2 text-xs sm:text-sm">
            <span className="text-slate-500">На счетах </span>
            <span className={`font-bold ${totalBalance >= 0 ? 'text-teal-600' : 'text-rose-600'}`}>
              {formatNumber(totalBalance)} ₽
            </span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="p-3 sm:p-5 pb-0 flex items-center gap-6 border-b border-slate-100">
          <h2 className="text-sm sm:text-base font-bold text-slate-800">Прибыль, ₽</h2>
          <div className="flex-1" />
        </div>

        <div className="flex flex-col lg:flex-row">
          <div className="p-3 sm:p-5 lg:w-[260px] flex-shrink-0 space-y-3 sm:space-y-4 border-b lg:border-b-0 lg:border-r border-slate-100">
            <MetricRow label="Доходы" value={totals.income} color="text-slate-800" />
            <MetricRow label="Расходы" value={totals.expense} color="text-slate-800" />
            <MetricRow label="Чистая прибыль" value={totals.profit} color={totals.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'} />
            <div className="pt-2 border-t border-slate-100">
              <div className="text-sm text-slate-400 mb-0.5">Рентабельность, %</div>
              <div className={`text-2xl font-bold ${totals.profitability >= 0 ? 'text-slate-800' : 'text-rose-600'}`}>
                {totals.profitability.toFixed(2)}%
              </div>
            </div>
          </div>

          <div className="flex-1 p-2 sm:p-4 min-h-[250px] sm:min-h-[300px]">
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={profitChartData} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                  dy={8}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  tickFormatter={formatCompact}
                  width={60}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  iconType="square"
                  iconSize={10}
                  wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
                />
                <Bar dataKey="income" name="Доходы" fill="#38bdf8" radius={[2, 2, 0, 0]} barSize={20} />
                <Bar dataKey="expense" name="Расходы" fill="#fb923c" radius={[2, 2, 0, 0]} barSize={20} />
                <Line
                  dataKey="profit"
                  name="Чистая прибыль"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#10b981', stroke: '#fff', strokeWidth: 1 }}
                  activeDot={{ r: 5 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="p-3 sm:p-5 pb-0 border-b border-slate-100">
          <h2 className="text-sm sm:text-base font-bold text-slate-800">Денежный поток, ₽</h2>
        </div>

        <div className="flex flex-col lg:flex-row">
          <div className="p-3 sm:p-5 lg:w-[260px] flex-shrink-0 space-y-3 sm:space-y-4 border-b lg:border-b-0 lg:border-r border-slate-100">
            <MetricRow label="Поступления" value={totals.inflows} color="text-slate-800" />
            <MetricRow label="Выплаты" value={totals.outflows} color="text-slate-800" />
            <div className="pt-2 border-t border-slate-100">
              <div className="text-sm text-slate-400 mb-0.5">Разница</div>
              <div className={`text-2xl font-bold ${totals.diff >= 0 ? 'text-slate-800' : 'text-rose-600'}`}>
                {formatNumber(totals.diff)}
              </div>
            </div>
          </div>

          <div className="flex-1 p-2 sm:p-4 min-h-[220px] sm:min-h-[260px]">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={cashFlowData} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                  dy={8}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  tickFormatter={formatCompact}
                  width={60}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="inflows" name="Поступления" fill="#38bdf8" radius={[2, 2, 0, 0]} barSize={24} />
                <Bar dataKey="outflows" name="Выплаты" fill="#fb923c" radius={[2, 2, 0, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {studios.length > 0 && <StudioBreakdown yearTx={yearTx} studios={studios} />}
    </div>
  );
};

const MetricRow: React.FC<{ label: string; value: number; color?: string }> = ({ label, value, color = 'text-slate-800' }) => (
  <div>
    <div className="text-xs sm:text-sm text-slate-400 mb-0.5">{label}</div>
    <div className={`text-xl sm:text-2xl font-bold tracking-tight ${color}`}>
      {formatNumber(value)}
    </div>
  </div>
);

const StudioBreakdown: React.FC<{ yearTx: any[]; studios: any[] }> = ({ yearTx, studios }) => {
  const studioData = useMemo(() => {
    return studios.map(studio => {
      const txs = yearTx.filter(t => t.studioId === studio.id);
      const income = txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
      const expense = txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
      return { name: studio.name, income, expense, profit: income - expense };
    }).filter(s => s.income > 0 || s.expense > 0);
  }, [yearTx, studios]);

  if (studioData.length === 0) return null;

  const maxVal = Math.max(...studioData.map(s => Math.max(s.income, s.expense, Math.abs(s.profit))), 1);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 sm:p-5">
      <h2 className="text-sm sm:text-base font-bold text-slate-800 mb-3 sm:mb-4">Прибыль по студиям</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {studioData.map(s => (
          <div key={s.name} className="border border-slate-100 rounded-lg p-4">
            <div className="text-sm font-medium text-slate-600 mb-3">{s.name}</div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-slate-400">
                <span>Доход</span>
                <span className="font-medium text-slate-700">{formatNumber(s.income)} ₽</span>
              </div>
              <div className="w-full bg-slate-50 rounded-full h-1.5">
                <div className="h-full bg-sky-400 rounded-full" style={{ width: `${(s.income / maxVal) * 100}%` }} />
              </div>
              <div className="flex justify-between text-xs text-slate-400">
                <span>Расход</span>
                <span className="font-medium text-slate-700">{formatNumber(s.expense)} ₽</span>
              </div>
              <div className="w-full bg-slate-50 rounded-full h-1.5">
                <div className="h-full bg-orange-400 rounded-full" style={{ width: `${(s.expense / maxVal) * 100}%` }} />
              </div>
              <div className="flex justify-between text-xs text-slate-400 pt-1 border-t border-slate-50">
                <span>Прибыль</span>
                <span className={`font-bold ${s.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {formatNumber(s.profit)} ₽
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
