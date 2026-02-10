import React, { useState, useMemo } from 'react';
import { useFinance } from '../context/FinanceContext';
import { formatCurrency } from '../utils/format';
import { Download, ChevronDown, ChevronRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import * as XLSX from 'xlsx';

type ReportTab = 'pnl' | 'dds' | 'categories' | 'studios';

const MONTH_NAMES = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const COLORS = ['#0d9488', '#10b981', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899', '#ef4444', '#06b6d4', '#84cc16', '#f97316'];

export const ReportsPage: React.FC = () => {
  const { transactions, categories, studios, accounts } = useFinance();
  const [activeTab, setActiveTab] = useState<ReportTab>('pnl');

  const now = new Date();
  const [startMonth, setStartMonth] = useState(0);
  const [startYear, setStartYear] = useState(now.getFullYear());
  const [endMonth, setEndMonth] = useState(now.getMonth());
  const [endYear, setEndYear] = useState(now.getFullYear());
  const [filterStudioId, setFilterStudioId] = useState('');
  const [filterAccountId, setFilterAccountId] = useState('');

  const filteredTx = useMemo(() => {
    const start = new Date(startYear, startMonth, 1);
    const end = new Date(endYear, endMonth + 1, 0, 23, 59, 59);
    return transactions.filter(t => {
      const d = new Date(t.date);
      if (d < start || d > end) return false;
      if (filterStudioId && t.studioId !== filterStudioId) return false;
      if (filterAccountId && t.accountId !== filterAccountId) return false;
      return true;
    });
  }, [transactions, startMonth, startYear, endMonth, endYear, filterStudioId, filterAccountId]);

  const months = useMemo(() => {
    const result: { month: number; year: number; label: string }[] = [];
    let m = startMonth, y = startYear;
    while (y < endYear || (y === endYear && m <= endMonth)) {
      result.push({ month: m, year: y, label: MONTH_NAMES[m].slice(0, 3) + ' ' + y });
      m++;
      if (m > 11) { m = 0; y++; }
    }
    return result;
  }, [startMonth, startYear, endMonth, endYear]);

  const yearOptions = useMemo(() => {
    const years = new Set<number>();
    transactions.forEach(t => years.add(new Date(t.date).getFullYear()));
    years.add(now.getFullYear());
    return [...years].sort();
  }, [transactions]);

  const tabs: { key: ReportTab; label: string }[] = [
    { key: 'pnl', label: 'ПиУ (P&L)' },
    { key: 'dds', label: 'ДДС' },
    { key: 'categories', label: 'По статьям' },
    { key: 'studios', label: 'По студиям' },
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] fade-enter">
      <div className="px-5 py-3 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeTab === tab.key ? 'bg-teal-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <select value={startMonth} onChange={e => setStartMonth(+e.target.value)} className="px-2 py-1 border border-slate-200 rounded text-xs bg-white">
              {MONTH_NAMES.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
            <select value={startYear} onChange={e => setStartYear(+e.target.value)} className="px-2 py-1 border border-slate-200 rounded text-xs bg-white">
              {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <span className="text-slate-400 mx-1">—</span>
            <select value={endMonth} onChange={e => setEndMonth(+e.target.value)} className="px-2 py-1 border border-slate-200 rounded text-xs bg-white">
              {MONTH_NAMES.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
            <select value={endYear} onChange={e => setEndYear(+e.target.value)} className="px-2 py-1 border border-slate-200 rounded text-xs bg-white">
              {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          <select value={filterStudioId} onChange={e => setFilterStudioId(e.target.value)} className="px-2 py-1 border border-slate-200 rounded text-xs bg-white">
            <option value="">Все студии</option>
            {studios.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>

          <select value={filterAccountId} onChange={e => setFilterAccountId(e.target.value)} className="px-2 py-1 border border-slate-200 rounded text-xs bg-white">
            <option value="">Все счета</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {activeTab === 'pnl' && <PnLReport tx={filteredTx} months={months} categories={categories} />}
        {activeTab === 'dds' && <DDSReport tx={filteredTx} months={months} accounts={accounts} />}
        {activeTab === 'categories' && <CategoriesReport tx={filteredTx} categories={categories} />}
        {activeTab === 'studios' && <StudiosReport tx={filteredTx} studios={studios} categories={categories} />}
      </div>
    </div>
  );
};

interface PnLProps {
  tx: ReturnType<typeof useFinance>['transactions'];
  months: { month: number; year: number; label: string }[];
  categories: ReturnType<typeof useFinance>['categories'];
}

const PnLReport: React.FC<PnLProps> = ({ tx, months, categories }) => {
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());

  const incomeCategories = categories.filter(c => c.type === 'income' && !c.parentId);
  const expenseCategories = categories.filter(c => c.type === 'expense' && !c.parentId);

  const getAmount = (catId: string, month: number, year: number) => {
    const children = categories.filter(c => c.parentId === catId);
    const ids = [catId, ...children.map(c => c.id)];
    return tx.filter(t => ids.includes(t.categoryId || '') && new Date(t.date).getMonth() === month && new Date(t.date).getFullYear() === year)
      .reduce((s, t) => s + t.amount, 0);
  };

  const getCatTotal = (catId: string) => {
    const children = categories.filter(c => c.parentId === catId);
    const ids = [catId, ...children.map(c => c.id)];
    return tx.filter(t => ids.includes(t.categoryId || '')).reduce((s, t) => s + t.amount, 0);
  };

  const getChildAmount = (catId: string, month: number, year: number) => {
    return tx.filter(t => t.categoryId === catId && new Date(t.date).getMonth() === month && new Date(t.date).getFullYear() === year)
      .reduce((s, t) => s + t.amount, 0);
  };

  const totalIncome = (m: number, y: number) => tx.filter(t => t.type === 'income' && new Date(t.date).getMonth() === m && new Date(t.date).getFullYear() === y).reduce((s, t) => s + t.amount, 0);
  const totalExpense = (m: number, y: number) => tx.filter(t => t.type === 'expense' && new Date(t.date).getMonth() === m && new Date(t.date).getFullYear() === y).reduce((s, t) => s + t.amount, 0);
  const grandTotalIncome = tx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const grandTotalExpense = tx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  const toggleExpand = (id: string) => {
    setExpandedCats(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const chartData = months.map(m => ({
    name: m.label,
    income: totalIncome(m.month, m.year),
    expense: totalExpense(m.month, m.year),
    profit: totalIncome(m.month, m.year) - totalExpense(m.month, m.year),
  }));

  const handleExport = () => {
    const rows: any[] = [];
    rows.push({ 'Статья': 'ДОХОДЫ', ...Object.fromEntries(months.map(m => [m.label, ''])), 'Итого': formatCurrency(grandTotalIncome) });
    incomeCategories.forEach(cat => {
      rows.push({ 'Статья': cat.name, ...Object.fromEntries(months.map(m => [m.label, getAmount(cat.id, m.month, m.year)])), 'Итого': getCatTotal(cat.id) });
    });
    rows.push({ 'Статья': 'РАСХОДЫ', ...Object.fromEntries(months.map(m => [m.label, ''])), 'Итого': formatCurrency(grandTotalExpense) });
    expenseCategories.forEach(cat => {
      rows.push({ 'Статья': cat.name, ...Object.fromEntries(months.map(m => [m.label, getAmount(cat.id, m.month, m.year)])), 'Итого': getCatTotal(cat.id) });
    });
    rows.push({ 'Статья': 'ПРИБЫЛЬ', ...Object.fromEntries(months.map(m => [m.label, totalIncome(m.month, m.year) - totalExpense(m.month, m.year)])), 'Итого': grandTotalIncome - grandTotalExpense });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'ПиУ');
    XLSX.writeFile(wb, 'vivi_pnl.xlsx');
  };

  const renderCategoryRow = (cat: typeof categories[0], type: 'income' | 'expense') => {
    const children = categories.filter(c => c.parentId === cat.id);
    const hasChildren = children.length > 0;
    const isExpanded = expandedCats.has(cat.id);

    return (
      <React.Fragment key={cat.id}>
        <tr className="hover:bg-slate-50/50 group">
          <td className="py-1.5 px-3 text-xs font-medium text-slate-700 sticky left-0 bg-white group-hover:bg-slate-50/50">
            <div className="flex items-center gap-1">
              {hasChildren ? (
                <button onClick={() => toggleExpand(cat.id)} className="p-0.5 text-slate-400 hover:text-slate-600">
                  {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                </button>
              ) : <span className="w-4" />}
              {cat.name}
            </div>
          </td>
          {months.map(m => {
            const val = getAmount(cat.id, m.month, m.year);
            return (
              <td key={m.label} className="py-1.5 px-2 text-xs text-right tabular-nums text-slate-600">
                {val > 0 ? formatCurrency(val) : ''}
              </td>
            );
          })}
          <td className="py-1.5 px-3 text-xs text-right font-semibold tabular-nums text-slate-700">
            {getCatTotal(cat.id) > 0 ? formatCurrency(getCatTotal(cat.id)) : ''}
          </td>
        </tr>
        {hasChildren && isExpanded && children.map(child => (
          <tr key={child.id} className="hover:bg-slate-50/50">
            <td className="py-1 px-3 pl-10 text-[11px] text-slate-500 sticky left-0 bg-white">{child.name}</td>
            {months.map(m => {
              const val = getChildAmount(child.id, m.month, m.year);
              return (
                <td key={m.label} className="py-1 px-2 text-[11px] text-right tabular-nums text-slate-400">
                  {val > 0 ? formatCurrency(val) : ''}
                </td>
              );
            })}
            <td className="py-1 px-3 text-[11px] text-right tabular-nums text-slate-500">
              {tx.filter(t => t.categoryId === child.id).reduce((s, t) => s + t.amount, 0) > 0 ? formatCurrency(tx.filter(t => t.categoryId === child.id).reduce((s, t) => s + t.amount, 0)) : ''}
            </td>
          </tr>
        ))}
      </React.Fragment>
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-800">Отчет о прибылях и убытках (ПиУ)</h2>
        <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-600 hover:bg-slate-50">
          <Download size={13} /> Экспорт
        </button>
      </div>

      {months.length > 1 && (
        <div className="bg-white rounded-lg border border-slate-200 p-4 h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barGap={4}>
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis hide />
              <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }} formatter={(v: number) => formatCurrency(v)} />
              <Bar dataKey="income" name="Доходы" fill="#10b981" radius={[3, 3, 0, 0]} barSize={20} />
              <Bar dataKey="expense" name="Расходы" fill="#f43f5e" radius={[3, 3, 0, 0]} barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="bg-white rounded-lg border border-slate-200 overflow-x-auto">
        <table className="w-full border-collapse min-w-[600px]">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="py-2 px-3 text-left text-[11px] font-semibold text-slate-500 uppercase sticky left-0 bg-slate-50 min-w-[180px]">Статья</th>
              {months.map(m => <th key={m.label} className="py-2 px-2 text-right text-[11px] font-semibold text-slate-500 uppercase min-w-[100px]">{m.label}</th>)}
              <th className="py-2 px-3 text-right text-[11px] font-semibold text-slate-500 uppercase min-w-[100px]">Итого</th>
            </tr>
          </thead>
          <tbody>
            <tr className="bg-emerald-50/50 border-b border-slate-100">
              <td className="py-2 px-3 text-xs font-bold text-emerald-700 sticky left-0 bg-emerald-50/50">ДОХОДЫ</td>
              {months.map(m => (
                <td key={m.label} className="py-2 px-2 text-xs text-right font-bold tabular-nums text-emerald-700">
                  {totalIncome(m.month, m.year) > 0 ? formatCurrency(totalIncome(m.month, m.year)) : ''}
                </td>
              ))}
              <td className="py-2 px-3 text-xs text-right font-bold tabular-nums text-emerald-700">{formatCurrency(grandTotalIncome)}</td>
            </tr>

            {incomeCategories.map(c => renderCategoryRow(c, 'income'))}

            <tr className="bg-rose-50/50 border-b border-slate-100 border-t border-t-slate-200">
              <td className="py-2 px-3 text-xs font-bold text-rose-700 sticky left-0 bg-rose-50/50">РАСХОДЫ</td>
              {months.map(m => (
                <td key={m.label} className="py-2 px-2 text-xs text-right font-bold tabular-nums text-rose-700">
                  {totalExpense(m.month, m.year) > 0 ? formatCurrency(totalExpense(m.month, m.year)) : ''}
                </td>
              ))}
              <td className="py-2 px-3 text-xs text-right font-bold tabular-nums text-rose-700">{formatCurrency(grandTotalExpense)}</td>
            </tr>

            {expenseCategories.map(c => renderCategoryRow(c, 'expense'))}

            <tr className="bg-slate-100 border-t-2 border-slate-300">
              <td className="py-2.5 px-3 text-xs font-bold text-slate-800 sticky left-0 bg-slate-100">ЧИСТАЯ ПРИБЫЛЬ</td>
              {months.map(m => {
                const profit = totalIncome(m.month, m.year) - totalExpense(m.month, m.year);
                return (
                  <td key={m.label} className={`py-2.5 px-2 text-xs text-right font-bold tabular-nums ${profit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {formatCurrency(profit)}
                  </td>
                );
              })}
              <td className={`py-2.5 px-3 text-xs text-right font-bold tabular-nums ${grandTotalIncome - grandTotalExpense >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                {formatCurrency(grandTotalIncome - grandTotalExpense)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

interface DDSProps {
  tx: ReturnType<typeof useFinance>['transactions'];
  months: { month: number; year: number; label: string }[];
  accounts: ReturnType<typeof useFinance>['accounts'];
}

const DDSReport: React.FC<DDSProps> = ({ tx, months, accounts }) => {
  const getAccountFlow = (accountId: string, month: number, year: number, type: 'income' | 'expense') => {
    return tx.filter(t => t.accountId === accountId && t.type === type && new Date(t.date).getMonth() === month && new Date(t.date).getFullYear() === year)
      .reduce((s, t) => s + t.amount, 0);
  };

  const getAccountTransferIn = (accountId: string, month: number, year: number) => {
    return tx.filter(t => t.type === 'transfer' && t.toAccountId === accountId && new Date(t.date).getMonth() === month && new Date(t.date).getFullYear() === year)
      .reduce((s, t) => s + t.amount, 0);
  };

  const getAccountTransferOut = (accountId: string, month: number, year: number) => {
    return tx.filter(t => t.type === 'transfer' && t.accountId === accountId && new Date(t.date).getMonth() === month && new Date(t.date).getFullYear() === year)
      .reduce((s, t) => s + t.amount, 0);
  };

  const totalFlowMonth = (month: number, year: number, type: 'income' | 'expense') => {
    return tx.filter(t => t.type === type && new Date(t.date).getMonth() === month && new Date(t.date).getFullYear() === year)
      .reduce((s, t) => s + t.amount, 0);
  };

  const handleExport = () => {
    const rows: any[] = [];
    rows.push({ 'Счет': 'ПОСТУПЛЕНИЯ', ...Object.fromEntries(months.map(m => [m.label, totalFlowMonth(m.month, m.year, 'income')])) });
    accounts.forEach(a => {
      rows.push({ 'Счет': a.name + ' (приход)', ...Object.fromEntries(months.map(m => [m.label, getAccountFlow(a.id, m.month, m.year, 'income')])) });
    });
    rows.push({ 'Счет': 'ВЫПЛАТЫ', ...Object.fromEntries(months.map(m => [m.label, totalFlowMonth(m.month, m.year, 'expense')])) });
    accounts.forEach(a => {
      rows.push({ 'Счет': a.name + ' (расход)', ...Object.fromEntries(months.map(m => [m.label, getAccountFlow(a.id, m.month, m.year, 'expense')])) });
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'ДДС');
    XLSX.writeFile(wb, 'vivi_dds.xlsx');
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-800">Отчет о движении денежных средств (ДДС)</h2>
        <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-600 hover:bg-slate-50">
          <Download size={13} /> Экспорт
        </button>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-x-auto">
        <table className="w-full border-collapse min-w-[600px]">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="py-2 px-3 text-left text-[11px] font-semibold text-slate-500 uppercase sticky left-0 bg-slate-50 min-w-[180px]">Счет</th>
              {months.map(m => <th key={m.label} className="py-2 px-2 text-right text-[11px] font-semibold text-slate-500 uppercase min-w-[100px]">{m.label}</th>)}
            </tr>
          </thead>
          <tbody>
            <tr className="bg-emerald-50/50 border-b border-slate-100">
              <td className="py-2 px-3 text-xs font-bold text-emerald-700 sticky left-0 bg-emerald-50/50">ПОСТУПЛЕНИЯ</td>
              {months.map(m => (
                <td key={m.label} className="py-2 px-2 text-xs text-right font-bold tabular-nums text-emerald-700">
                  {formatCurrency(totalFlowMonth(m.month, m.year, 'income'))}
                </td>
              ))}
            </tr>

            {accounts.map(a => (
              <tr key={a.id + '-in'} className="hover:bg-slate-50/50">
                <td className="py-1.5 px-3 pl-6 text-xs text-slate-600 sticky left-0 bg-white">{a.name}</td>
                {months.map(m => {
                  const val = getAccountFlow(a.id, m.month, m.year, 'income');
                  return <td key={m.label} className="py-1.5 px-2 text-xs text-right tabular-nums text-slate-500">{val > 0 ? formatCurrency(val) : ''}</td>;
                })}
              </tr>
            ))}

            <tr className="bg-rose-50/50 border-b border-slate-100 border-t border-t-slate-200">
              <td className="py-2 px-3 text-xs font-bold text-rose-700 sticky left-0 bg-rose-50/50">ВЫПЛАТЫ</td>
              {months.map(m => (
                <td key={m.label} className="py-2 px-2 text-xs text-right font-bold tabular-nums text-rose-700">
                  {formatCurrency(totalFlowMonth(m.month, m.year, 'expense'))}
                </td>
              ))}
            </tr>

            {accounts.map(a => (
              <tr key={a.id + '-out'} className="hover:bg-slate-50/50">
                <td className="py-1.5 px-3 pl-6 text-xs text-slate-600 sticky left-0 bg-white">{a.name}</td>
                {months.map(m => {
                  const val = getAccountFlow(a.id, m.month, m.year, 'expense');
                  return <td key={m.label} className="py-1.5 px-2 text-xs text-right tabular-nums text-slate-500">{val > 0 ? formatCurrency(val) : ''}</td>;
                })}
              </tr>
            ))}

            <tr className="bg-blue-50/50 border-b border-slate-100 border-t border-t-slate-200">
              <td className="py-2 px-3 text-xs font-bold text-blue-700 sticky left-0 bg-blue-50/50">ПЕРЕМЕЩЕНИЯ</td>
              {months.map(m => {
                const val = tx.filter(t => t.type === 'transfer' && new Date(t.date).getMonth() === m.month && new Date(t.date).getFullYear() === m.year).reduce((s, t) => s + t.amount, 0);
                return <td key={m.label} className="py-2 px-2 text-xs text-right font-bold tabular-nums text-blue-700">{val > 0 ? formatCurrency(val) : ''}</td>;
              })}
            </tr>

            <tr className="bg-slate-100 border-t-2 border-slate-300">
              <td className="py-2.5 px-3 text-xs font-bold text-slate-800 sticky left-0 bg-slate-100">ЧИСТЫЙ ПОТОК</td>
              {months.map(m => {
                const net = totalFlowMonth(m.month, m.year, 'income') - totalFlowMonth(m.month, m.year, 'expense');
                return (
                  <td key={m.label} className={`py-2.5 px-2 text-xs text-right font-bold tabular-nums ${net >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {formatCurrency(net)}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

interface CategoriesReportProps {
  tx: ReturnType<typeof useFinance>['transactions'];
  categories: ReturnType<typeof useFinance>['categories'];
}

const CategoriesReport: React.FC<CategoriesReportProps> = ({ tx, categories }) => {
  const [viewType, setViewType] = useState<'expense' | 'income'>('expense');

  const categoryData = useMemo(() => {
    const parentCats = categories.filter(c => c.type === viewType && !c.parentId);
    return parentCats.map(cat => {
      const children = categories.filter(c => c.parentId === cat.id);
      const ids = [cat.id, ...children.map(c => c.id)];
      const total = tx.filter(t => t.type === viewType && ids.includes(t.categoryId || '')).reduce((s, t) => s + t.amount, 0);
      const childData = children.map(child => ({
        name: child.name,
        amount: tx.filter(t => t.categoryId === child.id).reduce((s, t) => s + t.amount, 0),
      })).filter(c => c.amount > 0).sort((a, b) => b.amount - a.amount);
      return { name: cat.name, id: cat.id, total, children: childData };
    }).filter(c => c.total > 0).sort((a, b) => b.total - a.total);
  }, [tx, categories, viewType]);

  const grandTotal = categoryData.reduce((s, c) => s + c.total, 0);
  const pieData = categoryData.map((c, i) => ({ name: c.name, value: c.total, color: COLORS[i % COLORS.length] }));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-800">Анализ по статьям</h2>
        <div className="flex gap-1">
          <button onClick={() => setViewType('expense')} className={`px-3 py-1 rounded text-xs font-medium ${viewType === 'expense' ? 'bg-teal-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
            Расходы
          </button>
          <button onClick={() => setViewType('income')} className={`px-3 py-1 rounded text-xs font-medium ${viewType === 'income' ? 'bg-teal-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
            Доходы
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="bg-white rounded-lg border border-slate-200 p-4 flex items-center justify-center h-[280px]">
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} innerRadius={55} paddingAngle={2}>
                  {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-slate-400 text-sm">Нет данных</p>
          )}
        </div>

        <div className="lg:col-span-2 bg-white rounded-lg border border-slate-200">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="py-2 px-3 text-left text-[11px] font-semibold text-slate-500 uppercase">Статья</th>
                <th className="py-2 px-3 text-right text-[11px] font-semibold text-slate-500 uppercase w-32">Сумма</th>
                <th className="py-2 px-3 text-right text-[11px] font-semibold text-slate-500 uppercase w-20">Доля</th>
              </tr>
            </thead>
            <tbody>
              {categoryData.map((cat, idx) => (
                <React.Fragment key={cat.id}>
                  <tr className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="py-2 px-3 text-xs text-slate-700 font-medium">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                        {cat.name}
                      </div>
                    </td>
                    <td className="py-2 px-3 text-xs text-right font-semibold tabular-nums text-slate-700">{formatCurrency(cat.total)}</td>
                    <td className="py-2 px-3 text-xs text-right tabular-nums text-slate-500">{grandTotal > 0 ? ((cat.total / grandTotal) * 100).toFixed(1) + '%' : ''}</td>
                  </tr>
                  {cat.children.map(child => (
                    <tr key={child.name} className="border-b border-slate-50 hover:bg-slate-50/50">
                      <td className="py-1.5 px-3 pl-8 text-[11px] text-slate-500">{child.name}</td>
                      <td className="py-1.5 px-3 text-[11px] text-right tabular-nums text-slate-400">{formatCurrency(child.amount)}</td>
                      <td className="py-1.5 px-3 text-[11px] text-right tabular-nums text-slate-400">{grandTotal > 0 ? ((child.amount / grandTotal) * 100).toFixed(1) + '%' : ''}</td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
              {categoryData.length > 0 && (
                <tr className="bg-slate-50 border-t border-slate-200">
                  <td className="py-2 px-3 text-xs font-bold text-slate-700">Итого</td>
                  <td className="py-2 px-3 text-xs text-right font-bold tabular-nums text-slate-700">{formatCurrency(grandTotal)}</td>
                  <td className="py-2 px-3 text-xs text-right font-bold text-slate-500">100%</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

interface StudiosReportProps {
  tx: ReturnType<typeof useFinance>['transactions'];
  studios: ReturnType<typeof useFinance>['studios'];
  categories: ReturnType<typeof useFinance>['categories'];
}

const StudiosReport: React.FC<StudiosReportProps> = ({ tx, studios, categories }) => {
  const studioData = useMemo(() => {
    return studios.map(studio => {
      const sTx = tx.filter(t => t.studioId === studio.id);
      const income = sTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
      const expense = sTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

      const expenseByCategory: { name: string; amount: number }[] = [];
      const expenseCats = new Set(sTx.filter(t => t.type === 'expense').map(t => t.categoryId).filter(Boolean));
      expenseCats.forEach(catId => {
        const cat = categories.find(c => c.id === catId);
        const amount = sTx.filter(t => t.type === 'expense' && t.categoryId === catId).reduce((s, t) => s + t.amount, 0);
        expenseByCategory.push({ name: cat?.name || 'Без статьи', amount });
      });
      expenseByCategory.sort((a, b) => b.amount - a.amount);

      return { ...studio, income, expense, profit: income - expense, topExpenses: expenseByCategory.slice(0, 5) };
    }).filter(s => s.income > 0 || s.expense > 0);
  }, [tx, studios, categories]);

  const chartData = studioData.map(s => ({
    name: s.name,
    income: s.income,
    expense: s.expense,
    profit: s.profit,
  }));

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-bold text-slate-800">Анализ по студиям</h2>

      {chartData.length > 0 && (
        <div className="bg-white rounded-lg border border-slate-200 p-4 h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barGap={4}>
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis hide />
              <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }} formatter={(v: number) => formatCurrency(v)} />
              <Bar dataKey="income" name="Доходы" fill="#10b981" radius={[3, 3, 0, 0]} barSize={24} />
              <Bar dataKey="expense" name="Расходы" fill="#f43f5e" radius={[3, 3, 0, 0]} barSize={24} />
              <Bar dataKey="profit" name="Прибыль" fill="#0d9488" radius={[3, 3, 0, 0]} barSize={24} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {studioData.map((studio, idx) => (
          <div key={studio.id} className="bg-white rounded-lg border border-slate-200 p-4">
            <h3 className="text-sm font-bold text-slate-800 mb-3">{studio.name}</h3>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div>
                <div className="text-[10px] text-slate-400 uppercase">Доходы</div>
                <div className="text-xs font-bold text-emerald-600">{formatCurrency(studio.income)}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 uppercase">Расходы</div>
                <div className="text-xs font-bold text-rose-600">{formatCurrency(studio.expense)}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 uppercase">Прибыль</div>
                <div className={`text-xs font-bold ${studio.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatCurrency(studio.profit)}</div>
              </div>
            </div>
            {studio.topExpenses.length > 0 && (
              <div className="border-t border-slate-100 pt-2 space-y-1">
                <div className="text-[10px] text-slate-400 uppercase mb-1">Топ расходов</div>
                {studio.topExpenses.map((e, i) => (
                  <div key={i} className="flex justify-between text-[11px]">
                    <span className="text-slate-500 truncate pr-2">{e.name}</span>
                    <span className="text-slate-600 tabular-nums font-medium">{formatCurrency(e.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        {studioData.length === 0 && (
          <div className="col-span-full p-8 text-center text-slate-400 text-sm bg-white rounded-lg border border-slate-200">Нет данных за выбранный период</div>
        )}
      </div>
    </div>
  );
};
