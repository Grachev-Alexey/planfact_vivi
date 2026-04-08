import React, { useState, useMemo } from 'react';
import { useFinance } from '../context/FinanceContext';
import { Category } from '../types';
import { formatCurrency } from '../utils/format';
import { Download, ChevronDown, ChevronRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import * as XLSX from 'xlsx';
import { getMoscowNow } from '../utils/moscow';

type ReportTab = 'pnl' | 'dds' | 'categories' | 'studios';

const MONTH_NAMES = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const COLORS = ['#0d9488', '#10b981', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899', '#ef4444', '#06b6d4', '#84cc16', '#f97316'];

const fmtNum = (val: number) => {
  if (val === 0) return '\u2014';
  const hasDecimals = val % 1 !== 0;
  return new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: hasDecimals ? 2 : 0,
  }).format(val);
};

export const ReportsPage: React.FC = () => {
  const { transactions, categories, studios, accounts } = useFinance();
  const [activeTab, setActiveTab] = useState<ReportTab>('pnl');

  const now = getMoscowNow();
  const [startMonth, setStartMonth] = useState(0);
  const [startYear, setStartYear] = useState(now.getFullYear());
  const [endMonth, setEndMonth] = useState(now.getMonth());
  const [endYear, setEndYear] = useState(now.getFullYear());
  const [filterAccountId, setFilterAccountId] = useState('');
  const [filterStudioId, setFilterStudioId] = useState('');

  const filteredTx = useMemo(() => {
    const start = new Date(startYear, startMonth, 1);
    const end = new Date(endYear, endMonth + 1, 0, 23, 59, 59);
    return transactions.filter(t => {
      const isActive = t.type === 'expense'
        ? (t.status === 'paid' || t.status === 'verified' || t.confirmed)
        : t.confirmed;
      if (!isActive) return false;
      const effectiveDate = (t.type === 'income' && t.creditDate) ? t.creditDate : t.date;
      const d = new Date(effectiveDate);
      if (d < start || d > end) return false;
      if (filterAccountId && String(t.accountId) !== filterAccountId) return false;
      if (filterStudioId && String(t.studioId) !== filterStudioId) return false;
      return true;
    });
  }, [transactions, startMonth, startYear, endMonth, endYear, filterAccountId, filterStudioId]);

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
    transactions.forEach(t => {
      const ed = (t.type === 'income' && t.creditDate) ? t.creditDate : t.date;
      years.add(new Date(ed).getFullYear());
    });
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
      <div className="px-3 sm:px-5 py-3 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 sm:gap-3">
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-2.5 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${activeTab === tab.key ? 'bg-teal-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
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
            <span className="text-slate-400 mx-1">&mdash;</span>
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
        {activeTab === 'dds' && <DDSReport tx={filteredTx} categories={categories} studios={studios} />}
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

  const getAllDescendantIds = (catId: string): string[] => {
    const children = categories.filter(c => c.parentId === catId);
    return children.flatMap(c => [c.id, ...getAllDescendantIds(c.id)]);
  };

  const txEffDate = (t: any) => {
    const ed = (t.type === 'income' && t.creditDate) ? t.creditDate : t.date;
    return new Date(ed);
  };

  const getAmount = (catId: string, month: number, year: number) => {
    const ids = [catId, ...getAllDescendantIds(catId)];
    return tx.filter(t => ids.includes(t.categoryId || '') && txEffDate(t).getMonth() === month && txEffDate(t).getFullYear() === year)
      .reduce((s, t) => s + t.amount, 0);
  };

  const getCatTotal = (catId: string) => {
    const ids = [catId, ...getAllDescendantIds(catId)];
    return tx.filter(t => ids.includes(t.categoryId || '')).reduce((s, t) => s + t.amount, 0);
  };

  const totalIncome = (m: number, y: number) => tx.filter(t => t.type === 'income' && txEffDate(t).getMonth() === m && txEffDate(t).getFullYear() === y).reduce((s, t) => s + t.amount, 0);
  const totalExpense = (m: number, y: number) => tx.filter(t => t.type === 'expense' && txEffDate(t).getMonth() === m && txEffDate(t).getFullYear() === y).reduce((s, t) => s + t.amount, 0);
  const grandTotalIncome = tx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const grandTotalExpense = tx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  const toggleExpand = (id: string) => {
    setExpandedCats(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleExport = () => {
    const rows: any[] = [];
    const exportPnlTree = (cats: typeof categories, depth: number) => {
      cats.forEach(cat => {
        rows.push({ 'Статья': '  '.repeat(depth) + cat.name, ...Object.fromEntries(months.map(m => [m.label, getAmount(cat.id, m.month, m.year)])), 'Итого': getCatTotal(cat.id) });
        const children = categories.filter(c => c.parentId === cat.id);
        if (children.length > 0) exportPnlTree(children, depth + 1);
      });
    };
    rows.push({ 'Статья': 'ДОХОДЫ', ...Object.fromEntries(months.map(m => [m.label, ''])), 'Итого': grandTotalIncome });
    exportPnlTree(incomeCategories, 1);
    rows.push({ 'Статья': 'РАСХОДЫ', ...Object.fromEntries(months.map(m => [m.label, ''])), 'Итого': grandTotalExpense });
    exportPnlTree(expenseCategories, 1);
    rows.push({ 'Статья': 'ПРИБЫЛЬ', ...Object.fromEntries(months.map(m => [m.label, totalIncome(m.month, m.year) - totalExpense(m.month, m.year)])), 'Итого': grandTotalIncome - grandTotalExpense });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'ПиУ');
    XLSX.writeFile(wb, 'vivi_pnl.xlsx');
  };

  const renderCategoryRow = (cat: typeof categories[0], depth: number = 0): React.ReactNode => {
    const children = categories.filter(c => c.parentId === cat.id);
    const hasChildren = children.length > 0;
    const isExpanded = expandedCats.has(cat.id);
    const pl = 12 + depth * 20;
    const isRoot = depth === 0;

    return (
      <React.Fragment key={cat.id}>
        <tr className={`hover:bg-slate-50/50 group ${isRoot ? 'border-b border-slate-100' : 'border-b border-slate-50'}`}>
          <td className="py-1.5 px-3 sticky left-0 bg-white group-hover:bg-slate-50/50" style={{ paddingLeft: pl }}>
            <div className={`flex items-center gap-1 ${isRoot ? 'text-xs text-slate-700' : 'text-[11px] text-slate-500'}`}>
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
            return <td key={m.label} className={`py-1.5 px-2 text-right tabular-nums ${isRoot ? 'text-xs text-slate-600' : 'text-[11px] text-slate-400'}`}>{val > 0 ? fmtNum(val) : '\u2014'}</td>;
          })}
          <td className={`py-1.5 px-3 text-right tabular-nums ${isRoot ? 'text-xs font-medium text-slate-700' : 'text-[11px] text-slate-500'}`}>{getCatTotal(cat.id) > 0 ? fmtNum(getCatTotal(cat.id)) : '\u2014'}</td>
        </tr>
        {hasChildren && isExpanded && children.map(child => renderCategoryRow(child, depth + 1))}
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

      <div className="bg-white rounded-lg border border-slate-200 overflow-x-auto">
        <table className="w-full border-collapse min-w-[600px]">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="py-2 px-3 text-left text-[11px] font-semibold text-slate-500 uppercase sticky left-0 bg-slate-50 min-w-[200px]">Статьи учета</th>
              {months.map(m => <th key={m.label} className="py-2 px-2 text-right text-[11px] font-semibold text-slate-500 uppercase min-w-[100px]">{m.label}</th>)}
              <th className="py-2 px-3 text-right text-[11px] font-semibold text-slate-500 uppercase min-w-[100px]">Итого</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-200">
              <td className="py-2 px-3 text-xs font-bold text-slate-800 sticky left-0 bg-white">Поступления</td>
              {months.map(m => (
                <td key={m.label} className="py-2 px-2 text-xs text-right font-bold tabular-nums text-slate-800">
                  {totalIncome(m.month, m.year) > 0 ? fmtNum(totalIncome(m.month, m.year)) : '\u2014'}
                </td>
              ))}
              <td className="py-2 px-3 text-xs text-right font-bold tabular-nums text-slate-800">{fmtNum(grandTotalIncome)}</td>
            </tr>

            {incomeCategories.map(c => renderCategoryRow(c))}

            <tr className="border-b border-slate-200 border-t-2 border-t-slate-200">
              <td className="py-2 px-3 text-xs font-bold text-slate-800 sticky left-0 bg-white">Выплаты</td>
              {months.map(m => (
                <td key={m.label} className="py-2 px-2 text-xs text-right font-bold tabular-nums text-slate-800">
                  {totalExpense(m.month, m.year) > 0 ? fmtNum(totalExpense(m.month, m.year)) : '\u2014'}
                </td>
              ))}
              <td className="py-2 px-3 text-xs text-right font-bold tabular-nums text-slate-800">{fmtNum(grandTotalExpense)}</td>
            </tr>

            {expenseCategories.map(c => renderCategoryRow(c))}

            <tr className="border-t-2 border-slate-300 bg-slate-50">
              <td className="py-2.5 px-3 text-xs font-bold text-slate-800 sticky left-0 bg-slate-50">Чистая прибыль</td>
              {months.map(m => {
                const profit = totalIncome(m.month, m.year) - totalExpense(m.month, m.year);
                return (
                  <td key={m.label} className={`py-2.5 px-2 text-xs text-right font-bold tabular-nums ${profit < 0 ? 'text-rose-600' : 'text-slate-800'}`}>
                    {fmtNum(profit)}
                  </td>
                );
              })}
              <td className={`py-2.5 px-3 text-xs text-right font-bold tabular-nums ${grandTotalIncome - grandTotalExpense < 0 ? 'text-rose-600' : 'text-slate-800'}`}>
                {fmtNum(grandTotalIncome - grandTotalExpense)}
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
  categories: ReturnType<typeof useFinance>['categories'];
  studios: ReturnType<typeof useFinance>['studios'];
}

const DDSReport: React.FC<DDSProps> = ({ tx, categories, studios }) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['income', 'expense']));

  const activeStudios = useMemo(() => {
    const studioIds = new Set(tx.map(t => t.studioId).filter(Boolean));
    return studios.filter(s => studioIds.has(s.id));
  }, [tx, studios]);

  const incomeCategories = categories.filter(c => c.type === 'income' && !c.parentId);
  const expenseCategories = categories.filter(c => c.type === 'expense' && !c.parentId);

  const getAmount = (catIds: string[], studioId?: string) => {
    return tx.filter(t => catIds.includes(t.categoryId || '') && (!studioId || t.studioId === studioId))
      .reduce((s, t) => s + t.amount, 0);
  };

  const getTypeTotal = (type: 'income' | 'expense', studioId?: string) => {
    return tx.filter(t => t.type === type && (!studioId || t.studioId === studioId))
      .reduce((s, t) => s + t.amount, 0);
  };

  const toggleSection = (id: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleExport = () => {
    const rows: any[] = [];
    const header = { 'Статьи учета': '', ...Object.fromEntries(activeStudios.map(s => [s.name, ''])) };
    
    rows.push({ ...header, 'Статьи учета': 'Операционный поток' });
    const exportCatTree = (cats: Category[], depth: number) => {
      cats.forEach(cat => {
        const ids = [cat.id, ...getAllDescendantIds(cat.id)];
        rows.push({ ...header, 'Статьи учета': '  '.repeat(depth + 1) + cat.name, ...Object.fromEntries(activeStudios.map(s => [s.name, getAmount(ids, s.id)])) });
        const children = categories.filter(c => c.parentId === cat.id);
        if (children.length > 0) exportCatTree(children, depth + 1);
      });
    };
    rows.push({ ...header, 'Статьи учета': 'Поступления', ...Object.fromEntries(activeStudios.map(s => [s.name, getTypeTotal('income', s.id)])) });
    exportCatTree(incomeCategories, 0);
    rows.push({ ...header, 'Статьи учета': 'Выплаты', ...Object.fromEntries(activeStudios.map(s => [s.name, getTypeTotal('expense', s.id)])) });
    exportCatTree(expenseCategories, 0);

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'ДДС');
    XLSX.writeFile(wb, 'vivi_dds.xlsx');
  };

  const getAllDescendantIds = (catId: string): string[] => {
    const children = categories.filter(c => c.parentId === catId);
    return children.flatMap(c => [c.id, ...getAllDescendantIds(c.id)]);
  };

  const renderCategoryRow = (cat: typeof categories[0], depth: number = 0): React.ReactNode => {
    const children = categories.filter(c => c.parentId === cat.id);
    const hasChildren = children.length > 0;
    const ids = [cat.id, ...getAllDescendantIds(cat.id)];
    const isExpanded = expandedSections.has(cat.id);
    const pl = 32 + depth * 20;
    const isRoot = depth === 0;

    return (
      <React.Fragment key={cat.id}>
        <tr className={`hover:bg-slate-50/50 group ${isRoot ? 'border-b border-slate-100' : 'border-b border-slate-50'}`}>
          <td className="py-1.5 px-3 sticky left-0 bg-white group-hover:bg-slate-50/50" style={{ paddingLeft: pl }}>
            <div className={`flex items-center gap-1 ${isRoot ? 'text-xs text-slate-600' : 'text-[11px] text-slate-500'}`}>
              {hasChildren ? (
                <button onClick={() => toggleSection(cat.id)} className="p-0.5 text-slate-400 hover:text-slate-600">
                  {isExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                </button>
              ) : <span className="w-3.5" />}
              {cat.name}
            </div>
          </td>
          {activeStudios.map(s => {
            const val = getAmount(ids, s.id);
            return <td key={s.id} className={`py-1.5 px-2 text-right tabular-nums ${isRoot ? 'text-xs text-slate-600' : 'text-[11px] text-slate-400'}`}>{val > 0 ? fmtNum(val) : '\u2014'}</td>;
          })}
          <td className={`py-1.5 px-3 text-right tabular-nums ${isRoot ? 'text-xs font-medium text-slate-700' : 'text-[11px] text-slate-500'}`}>{getAmount(ids) > 0 ? fmtNum(getAmount(ids)) : '\u2014'}</td>
        </tr>
        {hasChildren && isExpanded && children.map(child => renderCategoryRow(child, depth + 1))}
      </React.Fragment>
    );
  };

  const renderCategoryRows = (parentCats: typeof categories) => {
    return parentCats.map(cat => renderCategoryRow(cat, 0));
  };

  const opFlowTotal = (studioId?: string) => getTypeTotal('income', studioId) - getTypeTotal('expense', studioId);

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
              <th className="py-2 px-3 text-left text-[11px] font-semibold text-slate-500 uppercase sticky left-0 bg-slate-50 min-w-[220px]">Статьи учета</th>
              {activeStudios.map(s => <th key={s.id} className="py-2 px-2 text-right text-[11px] font-semibold text-slate-500 uppercase min-w-[110px]">{s.name}</th>)}
              <th className="py-2 px-3 text-right text-[11px] font-semibold text-slate-500 uppercase min-w-[110px]">Итого</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-200">
              <td className="py-2 px-3 text-xs font-bold text-slate-800 sticky left-0 bg-white">Операционный поток</td>
              {activeStudios.map(s => {
                const val = opFlowTotal(s.id);
                return <td key={s.id} className={`py-2 px-2 text-xs text-right font-bold tabular-nums ${val < 0 ? 'text-rose-600' : 'text-slate-800'}`}>{fmtNum(val)}</td>;
              })}
              <td className={`py-2 px-3 text-xs text-right font-bold tabular-nums ${opFlowTotal() < 0 ? 'text-rose-600' : 'text-slate-800'}`}>{fmtNum(opFlowTotal())}</td>
            </tr>

            <tr className="border-b border-slate-200">
              <td className="py-1.5 px-3 text-xs font-semibold text-slate-700 sticky left-0 bg-white pl-4 cursor-pointer" onClick={() => toggleSection('income')}>
                <div className="flex items-center gap-1">
                  {expandedSections.has('income') ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  Поступления
                </div>
              </td>
              {activeStudios.map(s => {
                const val = getTypeTotal('income', s.id);
                return <td key={s.id} className="py-1.5 px-2 text-xs text-right font-semibold tabular-nums text-slate-700">{val > 0 ? fmtNum(val) : '\u2014'}</td>;
              })}
              <td className="py-1.5 px-3 text-xs text-right font-semibold tabular-nums text-slate-700">{fmtNum(getTypeTotal('income'))}</td>
            </tr>

            {expandedSections.has('income') && renderCategoryRows(incomeCategories)}

            <tr className="border-b border-slate-200">
              <td className="py-1.5 px-3 text-xs font-semibold text-slate-700 sticky left-0 bg-white pl-4 cursor-pointer" onClick={() => toggleSection('expense')}>
                <div className="flex items-center gap-1">
                  {expandedSections.has('expense') ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  Выплаты
                </div>
              </td>
              {activeStudios.map(s => {
                const val = getTypeTotal('expense', s.id);
                return <td key={s.id} className="py-1.5 px-2 text-xs text-right font-semibold tabular-nums text-slate-700">{val > 0 ? fmtNum(val) : '\u2014'}</td>;
              })}
              <td className="py-1.5 px-3 text-xs text-right font-semibold tabular-nums text-slate-700">{fmtNum(getTypeTotal('expense'))}</td>
            </tr>

            {expandedSections.has('expense') && renderCategoryRows(expenseCategories)}
          </tbody>
        </table>
      </div>

      {activeStudios.length === 0 && (
        <div className="p-8 text-center text-slate-400 text-sm bg-white rounded-lg border border-slate-200">Нет данных за выбранный период</div>
      )}
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
    const getAllDescIds = (catId: string): string[] => {
      const ch = categories.filter(c => c.parentId === catId);
      return ch.flatMap(c => [c.id, ...getAllDescIds(c.id)]);
    };
    const parentCats = categories.filter(c => c.type === viewType && !c.parentId);
    return parentCats.map(cat => {
      const ids = [cat.id, ...getAllDescIds(cat.id)];
      const total = tx.filter(t => t.type === viewType && ids.includes(t.categoryId || '')).reduce((s, t) => s + t.amount, 0);
      const directChildren = categories.filter(c => c.parentId === cat.id);
      const childData = directChildren.map(child => {
        const childIds = [child.id, ...getAllDescIds(child.id)];
        return {
          name: child.name,
          amount: tx.filter(t => childIds.includes(t.categoryId || '')).reduce((s, t) => s + t.amount, 0),
        };
      }).filter(c => c.amount > 0).sort((a, b) => b.amount - a.amount);
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
        {studioData.map((studio) => (
          <div key={studio.id} className="bg-white rounded-lg border border-slate-200 p-4">
            <h3 className="text-sm font-bold text-slate-800 mb-3">{studio.name}</h3>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div>
                <div className="text-[10px] text-slate-400 uppercase">Доходы</div>
                <div className="text-xs font-bold text-slate-700">{formatCurrency(studio.income)}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 uppercase">Расходы</div>
                <div className="text-xs font-bold text-slate-700">{formatCurrency(studio.expense)}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 uppercase">Прибыль</div>
                <div className={`text-xs font-bold ${studio.profit < 0 ? 'text-rose-600' : 'text-slate-700'}`}>{formatCurrency(studio.profit)}</div>
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
