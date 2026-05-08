import React, { useState, useMemo } from 'react';
import { useFinance } from '../context/FinanceContext';
import { formatCurrency } from '../utils/format';
import { getMoscowNow } from '../utils/moscow';
import { ChevronDown, ChevronRight, Download, Calendar } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
  LineChart, Line,
} from 'recharts';

const MONTH_NAMES = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const STUDIO_COLORS = ['#0d9488', '#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899', '#10b981', '#ef4444', '#06b6d4'];

type Preset = 'month' | 'prev_month' | '3m' | '6m' | 'year' | 'custom';
type ChartView = 'comparison' | 'trend';

const fmtNum = (val: number) => {
  if (val === 0) return '—';
  return new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val);
};

const fmtPct = (val: number) => {
  if (!isFinite(val) || isNaN(val)) return '—';
  return val.toFixed(1) + '%';
};

function applyPreset(preset: Preset, now: Date): { sm: number; sy: number; em: number; ey: number } {
  const cm = now.getMonth();
  const cy = now.getFullYear();
  if (preset === 'month') return { sm: cm, sy: cy, em: cm, ey: cy };
  if (preset === 'prev_month') {
    const pm = cm === 0 ? 11 : cm - 1;
    const py = cm === 0 ? cy - 1 : cy;
    return { sm: pm, sy: py, em: pm, ey: py };
  }
  if (preset === '3m') {
    let sm = cm - 2; let sy = cy;
    if (sm < 0) { sm += 12; sy--; }
    return { sm, sy, em: cm, ey: cy };
  }
  if (preset === '6m') {
    let sm = cm - 5; let sy = cy;
    if (sm < 0) { sm += 12; sy--; }
    return { sm, sy, em: cm, ey: cy };
  }
  if (preset === 'year') return { sm: 0, sy: cy, em: cm, ey: cy };
  return { sm: cm, sy: cy, em: cm, ey: cy };
}

export const StudioProfitability: React.FC = () => {
  const { transactions, studios } = useFinance();
  const now = getMoscowNow();

  const [preset, setPreset] = useState<Preset>('month');
  const [customStart, setCustomStart] = useState({ m: now.getMonth(), y: now.getFullYear() });
  const [customEnd, setCustomEnd] = useState({ m: now.getMonth(), y: now.getFullYear() });
  const [chartView, setChartView] = useState<ChartView>('comparison');
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());

  const { sm: startMonth, sy: startYear, em: endMonth, ey: endYear } = useMemo(() => {
    if (preset === 'custom') return { sm: customStart.m, sy: customStart.y, em: customEnd.m, ey: customEnd.y };
    return applyPreset(preset, now);
  }, [preset, customStart, customEnd]);

  const yearOptions = useMemo(() => {
    const years = new Set<number>();
    transactions.forEach(t => {
      const ed = (t.type === 'income' && t.creditDate) ? t.creditDate : t.date;
      years.add(new Date(ed).getFullYear());
    });
    years.add(now.getFullYear());
    return [...years].sort();
  }, [transactions]);

  const months = useMemo(() => {
    const result: { month: number; year: number; label: string; key: string }[] = [];
    let m = startMonth, y = startYear;
    while (y < endYear || (y === endYear && m <= endMonth)) {
      result.push({ month: m, year: y, label: MONTH_NAMES[m].slice(0, 3) + ' ' + y, key: `${y}-${m}` });
      m++; if (m > 11) { m = 0; y++; }
    }
    return result;
  }, [startMonth, startYear, endMonth, endYear]);

  const filteredTx = useMemo(() => {
    const start = new Date(startYear, startMonth, 1);
    const end = new Date(endYear, endMonth + 1, 0, 23, 59, 59);
    return transactions.filter(t => {
      if (t.type === 'transfer') return false;
      const isActive = t.type === 'expense'
        ? (t.status === 'paid' || t.status === 'verified' || t.confirmed)
        : t.confirmed;
      if (!isActive) return false;
      const ed = (t.type === 'income' && t.creditDate) ? t.creditDate : t.date;
      const d = new Date(ed);
      return d >= start && d <= end;
    });
  }, [transactions, startMonth, startYear, endMonth, endYear]);

  const studioStats = useMemo(() => {
    return studios.map(studio => {
      const sTx = filteredTx.filter(t => t.studioId === studio.id);
      const incomeTx = sTx.filter(t => t.type === 'income');
      const income = incomeTx.reduce((s, t) => s + t.amount, 0);
      const expense = sTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
      const profit = income - expense;
      const margin = income > 0 ? (profit / income) * 100 : 0;
      const incomeCount = incomeTx.length;
      const avgCheck = incomeCount > 0 ? income / incomeCount : 0;

      const monthlyData = months.map(m => {
        const mTx = sTx.filter(t => {
          const ed = (t.type === 'income' && t.creditDate) ? t.creditDate : t.date;
          const d = new Date(ed);
          return d.getMonth() === m.month && d.getFullYear() === m.year;
        });
        const mIncome = mTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
        const mExpense = mTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
        const mProfit = mIncome - mExpense;
        return { ...m, income: mIncome, expense: mExpense, profit: mProfit, margin: mIncome > 0 ? (mProfit / mIncome) * 100 : 0 };
      });

      return { ...studio, income, expense, profit, margin, incomeCount, avgCheck, monthlyData };
    });
  }, [studios, filteredTx, months]);

  const activeStudios = studioStats.filter(s => s.income > 0 || s.expense > 0);

  const totalStats = useMemo(() => {
    const income = activeStudios.reduce((s, st) => s + st.income, 0);
    const expense = activeStudios.reduce((s, st) => s + st.expense, 0);
    const profit = income - expense;
    const margin = income > 0 ? (profit / income) * 100 : 0;
    const incomeCount = activeStudios.reduce((s, st) => s + st.incomeCount, 0);
    const avgCheck = incomeCount > 0 ? income / incomeCount : 0;
    return { income, expense, profit, margin, incomeCount, avgCheck };
  }, [activeStudios]);

  const comparisonChartData = activeStudios.map(s => ({
    name: s.name.length > 12 ? s.name.slice(0, 12) + '…' : s.name,
    fullName: s.name,
    Выручка: s.income,
    Расходы: s.expense,
    Прибыль: s.profit,
  }));

  const trendChartData = months.map(m => {
    const row: Record<string, any> = { label: m.label };
    activeStudios.forEach(s => {
      const md = s.monthlyData.find(d => d.key === m.key);
      row[s.name] = md?.profit ?? 0;
    });
    return row;
  });

  const toggleMonth = (key: string) => {
    setExpandedMonths(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const handleExport = async () => {
    const XLSX = await import('xlsx');
    const rows: any[] = [];
    rows.push({ 'Студия': 'ИТОГО', 'Выручка': totalStats.income, 'Расходы': totalStats.expense, 'Прибыль': totalStats.profit, 'Маржа': fmtPct(totalStats.margin), 'Операций': totalStats.incomeCount, 'Средний чек': fmtNum(totalStats.avgCheck) });
    activeStudios.forEach(s => {
      const share = totalStats.income > 0 ? (s.income / totalStats.income * 100).toFixed(1) + '%' : '—';
      rows.push({ 'Студия': s.name, 'Выручка': s.income, 'Расходы': s.expense, 'Прибыль': s.profit, 'Маржа': fmtPct(s.margin), 'Операций': s.incomeCount, 'Средний чек': fmtNum(s.avgCheck), 'Доля выручки': share });
      s.monthlyData.forEach(m => {
        if (m.income > 0 || m.expense > 0)
          rows.push({ 'Студия': `  ${s.name} — ${m.label}`, 'Выручка': m.income, 'Расходы': m.expense, 'Прибыль': m.profit, 'Маржа': fmtPct(m.margin) });
      });
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Рентабельность');
    XLSX.writeFile(wb, 'vivi_studio_profitability.xlsx');
  };

  const marginColor = (m: number) => {
    if (m >= 30) return 'text-emerald-600';
    if (m >= 10) return 'text-teal-600';
    if (m >= 0) return 'text-amber-600';
    return 'text-rose-600';
  };

  const marginBg = (m: number) => {
    if (m >= 30) return 'bg-emerald-50 border-emerald-200';
    if (m >= 10) return 'bg-teal-50 border-teal-200';
    if (m >= 0) return 'bg-amber-50 border-amber-200';
    return 'bg-rose-50 border-rose-200';
  };

  const PRESETS: { key: Preset; label: string }[] = [
    { key: 'month', label: 'Месяц' },
    { key: 'prev_month', label: 'Прошлый' },
    { key: '3m', label: '3 мес.' },
    { key: '6m', label: '6 мес.' },
    { key: 'year', label: 'Год' },
    { key: 'custom', label: 'Период' },
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] fade-enter">
      <div className="px-3 sm:px-5 py-3 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 sm:gap-3">
        <h1 className="text-base font-bold text-slate-800">Рентабельность студий</h1>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-0.5 bg-slate-100 rounded-lg p-0.5">
            {PRESETS.map(p => (
              <button
                key={p.key}
                type="button"
                onClick={() => setPreset(p.key)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  preset === p.key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {p.key === 'custom' && <Calendar size={11} />}
                {p.label}
              </button>
            ))}
          </div>

          {preset === 'custom' && (
            <div className="flex items-center gap-1 text-xs text-slate-500">
              <select value={customStart.m} onChange={e => setCustomStart(s => ({ ...s, m: +e.target.value }))} className="px-2 py-1 border border-slate-200 rounded text-xs bg-white">
                {MONTH_NAMES.map((m, i) => <option key={i} value={i}>{m}</option>)}
              </select>
              <select value={customStart.y} onChange={e => setCustomStart(s => ({ ...s, y: +e.target.value }))} className="px-2 py-1 border border-slate-200 rounded text-xs bg-white">
                {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <span className="text-slate-400">—</span>
              <select value={customEnd.m} onChange={e => setCustomEnd(s => ({ ...s, m: +e.target.value }))} className="px-2 py-1 border border-slate-200 rounded text-xs bg-white">
                {MONTH_NAMES.map((m, i) => <option key={i} value={i}>{m}</option>)}
              </select>
              <select value={customEnd.y} onChange={e => setCustomEnd(s => ({ ...s, y: +e.target.value }))} className="px-2 py-1 border border-slate-200 rounded text-xs bg-white">
                {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          )}

          <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-600 hover:bg-slate-50">
            <Download size={13} /> Экспорт
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">

        {/* KPI cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {activeStudios.map(studio => {
            const revenueShare = totalStats.income > 0 ? (studio.income / totalStats.income) * 100 : 0;
            return (
              <div key={studio.id} className={`bg-white rounded-xl border p-4 ${marginBg(studio.margin)}`}>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="text-sm font-bold text-slate-800 leading-tight">{studio.name}</div>
                  <div className={`text-sm font-bold px-2 py-0.5 rounded-full whitespace-nowrap bg-white/70 ${marginColor(studio.margin)}`}>
                    {fmtPct(studio.margin)}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase mb-0.5">Выручка</div>
                    <div className="text-xs font-bold text-slate-700 tabular-nums">{fmtNum(studio.income)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase mb-0.5">Расходы</div>
                    <div className="text-xs font-bold text-rose-500 tabular-nums">{fmtNum(studio.expense)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase mb-0.5">Прибыль</div>
                    <div className={`text-xs font-bold tabular-nums ${studio.profit < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{fmtNum(studio.profit)}</div>
                  </div>
                </div>
                <div className="border-t border-white/60 pt-2.5 grid grid-cols-3 gap-3">
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase mb-0.5">Операций</div>
                    <div className="text-xs font-semibold text-slate-600 tabular-nums">{studio.incomeCount || '—'}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase mb-0.5">Средний чек</div>
                    <div className="text-xs font-semibold text-slate-600 tabular-nums">{studio.avgCheck > 0 ? fmtNum(studio.avgCheck) : '—'}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase mb-0.5">Доля выручки</div>
                    <div className="text-xs font-semibold text-slate-600 tabular-nums">{totalStats.income > 0 ? fmtPct(revenueShare) : '—'}</div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Total card */}
          {activeStudios.length > 1 && (
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="text-sm font-bold text-white leading-tight">Все студии</div>
                <div className={`text-sm font-bold px-2 py-0.5 rounded-full whitespace-nowrap bg-white/10 ${totalStats.margin >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {fmtPct(totalStats.margin)}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div>
                  <div className="text-[10px] text-slate-400 uppercase mb-0.5">Выручка</div>
                  <div className="text-xs font-bold text-white tabular-nums">{fmtNum(totalStats.income)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 uppercase mb-0.5">Расходы</div>
                  <div className="text-xs font-bold text-rose-400 tabular-nums">{fmtNum(totalStats.expense)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 uppercase mb-0.5">Прибыль</div>
                  <div className={`text-xs font-bold tabular-nums ${totalStats.profit < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>{fmtNum(totalStats.profit)}</div>
                </div>
              </div>
              <div className="border-t border-white/10 pt-2.5 grid grid-cols-3 gap-3">
                <div>
                  <div className="text-[10px] text-slate-400 uppercase mb-0.5">Операций</div>
                  <div className="text-xs font-semibold text-slate-300 tabular-nums">{totalStats.incomeCount || '—'}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 uppercase mb-0.5">Средний чек</div>
                  <div className="text-xs font-semibold text-slate-300 tabular-nums">{totalStats.avgCheck > 0 ? fmtNum(totalStats.avgCheck) : '—'}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 uppercase mb-0.5">Доля</div>
                  <div className="text-xs font-semibold text-slate-300">100%</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {activeStudios.length === 0 && (
          <div className="bg-white rounded-lg border border-slate-200 p-12 text-center text-slate-400 text-sm">
            Нет данных за выбранный период
          </div>
        )}

        {/* Chart */}
        {activeStudios.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-700">
                {chartView === 'comparison' ? 'Сравнение студий' : 'Динамика прибыли по месяцам'}
              </h2>
              <div className="flex items-center gap-0.5 bg-slate-100 rounded-lg p-0.5">
                {([['comparison', 'Сравнение'], ['trend', 'Динамика']] as const).map(([key, label]) => (
                  <button key={key} type="button" onClick={() => setChartView(key)}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${chartView === key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                {chartView === 'comparison' ? (
                  <BarChart data={comparisonChartData} barGap={3} barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                    <YAxis hide />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} labelFormatter={(l, p) => p?.[0]?.payload?.fullName ?? l} contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                    <Bar dataKey="Выручка" fill="#10b981" radius={[3, 3, 0, 0]} barSize={20} />
                    <Bar dataKey="Расходы" fill="#f43f5e" radius={[3, 3, 0, 0]} barSize={20} />
                    <Bar dataKey="Прибыль" fill="#0d9488" radius={[3, 3, 0, 0]} barSize={20} />
                  </BarChart>
                ) : (
                  <LineChart data={trendChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                    <YAxis hide />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                    {activeStudios.map((s, i) => (
                      <Line key={s.id} type="monotone" dataKey={s.name} stroke={STUDIO_COLORS[i % STUDIO_COLORS.length]} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                    ))}
                  </LineChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Monthly breakdown table */}
        {activeStudios.length > 0 && months.length > 1 && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
            <table className="w-full border-collapse min-w-[600px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="py-2 px-3 text-left text-[11px] font-semibold text-slate-500 uppercase sticky left-0 bg-slate-50 min-w-[110px]">Месяц</th>
                  {activeStudios.map(s => (
                    <th key={s.id} className="py-2 px-2 text-center text-[11px] font-semibold text-slate-500 uppercase min-w-[130px]" colSpan={2}>{s.name}</th>
                  ))}
                  <th className="py-2 px-2 text-center text-[11px] font-semibold text-slate-500 uppercase min-w-[130px]" colSpan={2}>Итого</th>
                </tr>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="py-1 px-3 sticky left-0 bg-slate-50/50" />
                  {activeStudios.map(s => (
                    <React.Fragment key={s.id}>
                      <th className="py-1 px-2 text-right text-[10px] text-slate-400 font-normal">Прибыль</th>
                      <th className="py-1 px-2 text-right text-[10px] text-slate-400 font-normal">Маржа</th>
                    </React.Fragment>
                  ))}
                  <th className="py-1 px-2 text-right text-[10px] text-slate-400 font-normal">Прибыль</th>
                  <th className="py-1 px-2 text-right text-[10px] text-slate-400 font-normal">Маржа</th>
                </tr>
              </thead>
              <tbody>
                {months.map(m => {
                  const isExp = expandedMonths.has(m.key);
                  const rowInc = activeStudios.reduce((s, st) => s + (st.monthlyData.find(d => d.key === m.key)?.income ?? 0), 0);
                  const rowExp = activeStudios.reduce((s, st) => s + (st.monthlyData.find(d => d.key === m.key)?.expense ?? 0), 0);
                  const rowProfit = rowInc - rowExp;
                  const rowMargin = rowInc > 0 ? (rowProfit / rowInc) * 100 : 0;

                  return (
                    <React.Fragment key={m.key}>
                      <tr className="border-b border-slate-100 hover:bg-slate-50/50 cursor-pointer group" onClick={() => toggleMonth(m.key)}>
                        <td className="py-2 px-3 text-xs font-medium text-slate-700 sticky left-0 bg-white group-hover:bg-slate-50/50">
                          <div className="flex items-center gap-1">
                            {isExp ? <ChevronDown size={12} className="text-slate-400" /> : <ChevronRight size={12} className="text-slate-400" />}
                            {m.label}
                          </div>
                        </td>
                        {activeStudios.map(s => {
                          const md = s.monthlyData.find(d => d.key === m.key);
                          const p = md?.profit ?? 0; const mg = md?.margin ?? 0;
                          return (
                            <React.Fragment key={s.id}>
                              <td className={`py-2 px-2 text-xs text-right tabular-nums font-medium ${p < 0 ? 'text-rose-600' : p > 0 ? 'text-slate-700' : 'text-slate-300'}`}>{p !== 0 ? fmtNum(p) : '—'}</td>
                              <td className={`py-2 px-2 text-xs text-right tabular-nums font-medium ${marginColor(mg)}`}>{md && (md.income > 0 || md.expense > 0) ? fmtPct(mg) : '—'}</td>
                            </React.Fragment>
                          );
                        })}
                        <td className={`py-2 px-2 text-xs text-right tabular-nums font-bold ${rowProfit < 0 ? 'text-rose-600' : rowProfit > 0 ? 'text-slate-800' : 'text-slate-300'}`}>{rowProfit !== 0 ? fmtNum(rowProfit) : '—'}</td>
                        <td className={`py-2 px-2 text-xs text-right tabular-nums font-bold ${marginColor(rowMargin)}`}>{rowInc > 0 ? fmtPct(rowMargin) : '—'}</td>
                      </tr>

                      {isExp && (
                        <tr className="border-b border-slate-100 bg-slate-50/40">
                          <td className="py-2 px-3 sticky left-0 bg-slate-50/40">
                            <div className="space-y-1 pl-4">
                              <div className="text-[11px] text-slate-500">Выручка</div>
                              <div className="text-[11px] text-slate-500">Расходы</div>
                            </div>
                          </td>
                          {activeStudios.map(s => {
                            const md = s.monthlyData.find(d => d.key === m.key);
                            return (
                              <td key={s.id} colSpan={2} className="py-2 px-2">
                                <div className="space-y-1 text-right">
                                  <div className="text-[11px] text-slate-600 tabular-nums">{md && md.income > 0 ? fmtNum(md.income) : '—'}</div>
                                  <div className="text-[11px] text-rose-500 tabular-nums">{md && md.expense > 0 ? fmtNum(md.expense) : '—'}</div>
                                </div>
                              </td>
                            );
                          })}
                          <td colSpan={2} className="py-2 px-2">
                            <div className="space-y-1 text-right">
                              <div className="text-[11px] text-slate-600 tabular-nums">{rowInc > 0 ? fmtNum(rowInc) : '—'}</div>
                              <div className="text-[11px] text-rose-500 tabular-nums">{rowExp > 0 ? fmtNum(rowExp) : '—'}</div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}

                <tr className="border-t-2 border-slate-200 bg-slate-50">
                  <td className="py-2.5 px-3 text-xs font-bold text-slate-800 sticky left-0 bg-slate-50">Итого</td>
                  {activeStudios.map(s => (
                    <React.Fragment key={s.id}>
                      <td className={`py-2.5 px-2 text-xs text-right tabular-nums font-bold ${s.profit < 0 ? 'text-rose-600' : 'text-slate-800'}`}>{fmtNum(s.profit)}</td>
                      <td className={`py-2.5 px-2 text-xs text-right tabular-nums font-bold ${marginColor(s.margin)}`}>{s.income > 0 ? fmtPct(s.margin) : '—'}</td>
                    </React.Fragment>
                  ))}
                  <td className={`py-2.5 px-2 text-xs text-right tabular-nums font-bold ${totalStats.profit < 0 ? 'text-rose-600' : 'text-slate-800'}`}>{fmtNum(totalStats.profit)}</td>
                  <td className={`py-2.5 px-2 text-xs text-right tabular-nums font-bold ${marginColor(totalStats.margin)}`}>{totalStats.income > 0 ? fmtPct(totalStats.margin) : '—'}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
