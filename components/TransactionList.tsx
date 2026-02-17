import React, { useState, useMemo, useEffect } from 'react';
import { useFinance } from '../context/FinanceContext';
import { Transaction } from '../types';
import { formatCurrency, formatDate, formatDateShort } from '../utils/format';
import { Search, Download, Upload, ArrowRight, ArrowLeft, ArrowRightLeft, X, Trash2, CheckCircle2, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';
import { TransactionForm } from './TransactionForm';
import { FilterSelect } from './ui/FilterSelect';
import { DatePicker } from './ui/DatePicker';
import { ImportModal } from './ImportModal';
import * as XLSX from 'xlsx';

const toLocalDate = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const TransactionList: React.FC = () => {
  const { transactions, categories, studios, accounts, contractors, legalEntities, deleteTransaction } = useFinance();
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  const [filterTypes, setFilterTypes] = useState({
    income: true,
    expense: true,
    transfer: true
  });
  const [filterAccountId, setFilterAccountId] = useState('');
  const [filterContractorId, setFilterContractorId] = useState('');
  const [filterCategoryId, setFilterCategoryId] = useState('');
  const [filterStudioId, setFilterStudioId] = useState('');
  const [filterConfirmed, setFilterConfirmed] = useState<'' | 'yes' | 'no'>('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [filterAmountFrom, setFilterAmountFrom] = useState('');
  const [filterAmountTo, setFilterAmountTo] = useState('');

  const categoryTreeOptions = useMemo(() => {
    const result: { id: string; label: string; indent?: number }[] = [];
    const addChildren = (parentId: string | null, depth: number) => {
      const items = categories.filter(c => depth === 0 ? !c.parentId : c.parentId === parentId);
      items.forEach(item => {
        result.push({ id: item.id, label: item.name, indent: depth });
        addChildren(item.id, depth + 1);
      });
    };
    addChildren(null, 0);
    return result;
  }, [categories]);

  const accountOptions = useMemo(() => accounts.map(a => {
    const le = legalEntities.find(l => l.id === a.legalEntityId);
    return { id: a.id, label: a.name, sublabel: le ? le.name : undefined };
  }), [accounts, legalEntities]);
  const contractorOptions = useMemo(() => contractors.map(c => ({ id: c.id, label: c.name + (c.inn ? ` (${c.inn})` : '') })), [contractors]);
  const studioOptions = useMemo(() => studios.map(s => ({ id: s.id, label: s.name })), [studios]);
  const confirmedOptions = useMemo(() => [
    { id: 'yes', label: 'Подтверждённые' },
    { id: 'no', label: 'Неподтверждённые' },
  ], []);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const contractor = contractors.find(c => c.id === t.contractorId)?.name || '';
      const category = categories.find(c => c.id === t.categoryId)?.name || '';
      const account = accounts.find(a => a.id === t.accountId)?.name || '';
      
      const matchesSearch = !search || 
        t.description.toLowerCase().includes(search.toLowerCase()) || 
        contractor.toLowerCase().includes(search.toLowerCase()) ||
        category.toLowerCase().includes(search.toLowerCase()) ||
        account.toLowerCase().includes(search.toLowerCase());
      
      const matchesType = (t.type === 'income' && filterTypes.income) ||
                          (t.type === 'expense' && filterTypes.expense) ||
                          (t.type === 'transfer' && filterTypes.transfer);

      const matchesAccount = !filterAccountId || String(t.accountId) === filterAccountId;
      const matchesContractor = !filterContractorId || String(t.contractorId) === filterContractorId;
      const matchesCategory = !filterCategoryId || String(t.categoryId) === filterCategoryId;
      const matchesStudio = !filterStudioId || String(t.studioId) === filterStudioId;
      const matchesConfirmed = !filterConfirmed || (filterConfirmed === 'yes' ? t.confirmed : !t.confirmed);

      const txDate = t.date.length > 10 ? t.date.slice(0, 10) : t.date;
      const matchesDateFrom = !filterDateFrom || txDate >= filterDateFrom;
      const matchesDateTo = !filterDateTo || txDate <= filterDateTo;

      const matchesAmountFrom = !filterAmountFrom || t.amount >= parseFloat(filterAmountFrom);
      const matchesAmountTo = !filterAmountTo || t.amount <= parseFloat(filterAmountTo);
      
      return matchesSearch && matchesType && matchesAccount && matchesContractor && matchesCategory && matchesStudio && matchesConfirmed && matchesDateFrom && matchesDateTo && matchesAmountFrom && matchesAmountTo;
    });
  }, [transactions, search, filterTypes, filterAccountId, filterContractorId, filterCategoryId, filterStudioId, filterConfirmed, filterDateFrom, filterDateTo, filterAmountFrom, filterAmountTo, contractors, categories, accounts]);

  const sortedTransactions = useMemo(() => {
    return [...filteredTransactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [filteredTransactions]);

  const totalPages = Math.max(1, Math.ceil(sortedTransactions.length / pageSize));

  useEffect(() => {
    setCurrentPage(1);
  }, [filterTypes, filterAccountId, filterContractorId, filterCategoryId, filterStudioId, filterConfirmed, filterDateFrom, filterDateTo, filterAmountFrom, filterAmountTo, search]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [totalPages, currentPage]);

  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedTransactions.slice(start, start + pageSize);
  }, [sortedTransactions, currentPage, pageSize]);

  const groupedTransactions = useMemo(() => {
    const groups: { [key: string]: typeof transactions } = {};
    
    paginatedTransactions.forEach(tx => {
      const date = new Date(tx.date);
      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      let key: string;
      if (date.toDateString() === today.toDateString()) key = 'Сегодня';
      else if (date.toDateString() === yesterday.toDateString()) key = 'Вчера';
      else key = formatDate(tx.date);
      
      if (!groups[key]) groups[key] = [];
      groups[key].push(tx);
    });
    
    return Object.entries(groups).map(([title, items]) => ({ title, items }));
  }, [paginatedTransactions]);

  const totalIncome = filteredTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = filteredTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const totalTransfers = filteredTransactions.filter(t => t.type === 'transfer').reduce((sum, t) => sum + t.amount, 0);
  const netResult = totalIncome - totalExpense;

  const handleExport = () => {
    const data = filteredTransactions.map(tx => {
      const account = accounts.find(a => a.id === tx.accountId)?.name || '';
      const toAccount = accounts.find(a => a.id === tx.toAccountId)?.name || '';
      const category = categories.find(c => c.id === tx.categoryId)?.name || '';
      const studio = studios.find(s => s.id === tx.studioId)?.name || '';
      const contractor = contractors.find(c => c.id === tx.contractorId)?.name || '';
      let typeStr = 'Доход';
      if (tx.type === 'expense') typeStr = 'Расход';
      if (tx.type === 'transfer') typeStr = 'Перевод';
      return {
        'Дата': tx.date, 'Тип': typeStr, 'Сумма': tx.amount,
        'Счет': account, 'На счет': toAccount, 'Категория': category,
        'Контрагент': contractor, 'Студия': studio, 'Описание': tx.description
      };
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Операции");
    XLSX.writeFile(wb, "vivi_transactions.xlsx");
  };

  const hasActiveFilters = filterAccountId || filterContractorId || filterCategoryId || filterStudioId || filterConfirmed || filterDateFrom || filterDateTo || filterAmountFrom || filterAmountTo || !filterTypes.income || !filterTypes.expense || !filterTypes.transfer;

  const clearFilters = () => {
    setFilterAccountId('');
    setFilterContractorId('');
    setFilterCategoryId('');
    setFilterStudioId('');
    setFilterConfirmed('');
    setFilterDateFrom('');
    setFilterDateTo('');
    setFilterAmountFrom('');
    setFilterAmountTo('');
    setShowDatePicker(false);
    setFilterTypes({ income: true, expense: true, transfer: true });
  };

  const filteredIds = useMemo(() => new Set(filteredTransactions.map(t => t.id)), [filteredTransactions]);

  useEffect(() => {
    setSelectedIds(prev => {
      const reconciled = new Set([...prev].filter(id => filteredIds.has(id)));
      return reconciled.size !== prev.size ? reconciled : prev;
    });
  }, [filteredIds]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredTransactions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredTransactions.map(t => t.id)));
    }
  };

  const handleBulkDelete = async () => {
    setIsDeleting(true);
    const idsToDelete = [...selectedIds];
    const failed: string[] = [];
    for (const id of idsToDelete) {
      try {
        await deleteTransaction(id);
      } catch (err) {
        console.error('Error deleting transaction:', id, err);
        failed.push(id);
      }
    }
    if (failed.length > 0) {
      setSelectedIds(new Set(failed));
    } else {
      setSelectedIds(new Set());
      setShowDeleteConfirm(false);
    }
    setIsDeleting(false);
  };

  const visibleSelectedCount = [...selectedIds].filter(id => filteredIds.has(id)).length;
  const allSelected = filteredTransactions.length > 0 && visibleSelectedCount === filteredTransactions.length;
  const someSelected = visibleSelectedCount > 0 && visibleSelectedCount < filteredTransactions.length;

  const datePresets = [
    { label: 'Просроченные', fn: () => { const d = new Date(); d.setDate(d.getDate() - 1); setFilterDateFrom(''); setFilterDateTo(toLocalDate(d)); }},
    { label: 'Будущие', fn: () => { const d = new Date(); d.setDate(d.getDate() + 1); setFilterDateFrom(toLocalDate(d)); setFilterDateTo(''); }},
    { label: 'Вчера', fn: () => { const d = new Date(); d.setDate(d.getDate() - 1); const s = toLocalDate(d); setFilterDateFrom(s); setFilterDateTo(s); }},
    { label: 'Сегодня', fn: () => { const s = toLocalDate(new Date()); setFilterDateFrom(s); setFilterDateTo(s); }},
    { label: 'Прошлая неделя', fn: () => {
      const now = new Date(); const day = now.getDay() || 7;
      const mon = new Date(now); mon.setDate(now.getDate() - day - 6);
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
      setFilterDateFrom(toLocalDate(mon)); setFilterDateTo(toLocalDate(sun));
    }},
    { label: 'Эта неделя', fn: () => {
      const now = new Date(); const day = now.getDay() || 7;
      const mon = new Date(now); mon.setDate(now.getDate() - day + 1);
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
      setFilterDateFrom(toLocalDate(mon)); setFilterDateTo(toLocalDate(sun));
    }},
    { label: 'Прошлый месяц', fn: () => {
      const now = new Date(); const y = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear(); const m = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
      setFilterDateFrom(toLocalDate(new Date(y, m, 1))); setFilterDateTo(toLocalDate(new Date(y, m + 1, 0)));
    }},
    { label: 'Этот месяц', fn: () => {
      const now = new Date();
      setFilterDateFrom(toLocalDate(new Date(now.getFullYear(), now.getMonth(), 1))); setFilterDateTo(toLocalDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)));
    }},
    { label: 'Прошлый квартал', fn: () => {
      const now = new Date(); const q = Math.floor(now.getMonth() / 3); const pq = q === 0 ? 3 : q - 1; const y = q === 0 ? now.getFullYear() - 1 : now.getFullYear();
      setFilterDateFrom(toLocalDate(new Date(y, pq * 3, 1))); setFilterDateTo(toLocalDate(new Date(y, pq * 3 + 3, 0)));
    }},
    { label: 'Этот квартал', fn: () => {
      const now = new Date(); const q = Math.floor(now.getMonth() / 3);
      setFilterDateFrom(toLocalDate(new Date(now.getFullYear(), q * 3, 1))); setFilterDateTo(toLocalDate(new Date(now.getFullYear(), q * 3 + 3, 0)));
    }},
    { label: 'Прошлый год', fn: () => { const y = new Date().getFullYear() - 1; setFilterDateFrom(`${y}-01-01`); setFilterDateTo(`${y}-12-31`); }},
    { label: 'Этот год', fn: () => { const y = new Date().getFullYear(); setFilterDateFrom(`${y}-01-01`); setFilterDateTo(`${y}-12-31`); }},
  ];

  return (
    <div className="flex h-[calc(100vh-56px)] overflow-hidden">
      <div className="w-56 bg-white border-r border-slate-200 flex-col hidden lg:flex shrink-0">
        <div className="px-4 py-3 border-b border-slate-100">
          <h2 className="font-bold text-xs text-slate-500 uppercase tracking-wider">Фильтры</h2>
        </div>
        
        <div className="p-3 space-y-3 overflow-y-auto flex-1 custom-scrollbar">
          <div>
            <div className="text-[11px] font-medium text-slate-500 mb-1">Период</div>
            <button
              type="button"
              onClick={() => setShowDatePicker(!showDatePicker)}
              className={`w-full px-2.5 py-1.5 border rounded-lg text-xs text-left flex items-center gap-1.5 transition-colors ${
                filterDateFrom || filterDateTo
                  ? 'bg-teal-50 border-teal-300 text-teal-700'
                  : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300'
              }`}
            >
              <Calendar size={11} className="shrink-0" />
              <span className="truncate text-[11px]">
                {filterDateFrom || filterDateTo
                  ? `${filterDateFrom ? formatDate(filterDateFrom) : '...'} – ${filterDateTo ? formatDate(filterDateTo) : '...'}`
                  : 'Укажите период'}
              </span>
              {(filterDateFrom || filterDateTo) && (
                <button type="button" onClick={(e) => { e.stopPropagation(); setFilterDateFrom(''); setFilterDateTo(''); }} className="shrink-0 text-teal-400 hover:text-teal-600 ml-auto">
                  <X size={10} />
                </button>
              )}
            </button>
            {showDatePicker && (
              <div className="mt-2 border border-slate-200 rounded-lg bg-white shadow-sm p-2 space-y-2">
                <div className="grid grid-cols-2 gap-1">
                  {datePresets.map(preset => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={preset.fn}
                      className="px-1.5 py-1 text-[10px] text-slate-600 hover:bg-teal-50 hover:text-teal-700 rounded border border-slate-200 text-center transition-colors leading-tight"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <div className="space-y-1.5 pt-1">
                  <DatePicker value={filterDateFrom} onChange={setFilterDateFrom} placeholder="Начало периода" compact />
                  <DatePicker value={filterDateTo} onChange={setFilterDateTo} placeholder="Конец периода" compact />
                </div>
                <div className="flex gap-2 pt-1">
                  <button type="button" onClick={() => { setFilterDateFrom(''); setFilterDateTo(''); }} className="flex-1 text-[11px] text-slate-500 hover:text-slate-700 py-1">
                    Сбросить
                  </button>
                  <button type="button" onClick={() => setShowDatePicker(false)} className="flex-1 text-[11px] bg-teal-600 text-white rounded py-1 hover:bg-teal-700 font-medium">
                    Применить
                  </button>
                </div>
              </div>
            )}
          </div>

          <div>
            <div className="text-[11px] font-medium text-slate-500 mb-1">Сумма</div>
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={filterAmountFrom}
                onChange={e => setFilterAmountFrom(e.target.value)}
                className="flex-1 w-0 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-800 focus:outline-none focus:border-teal-500 focus:bg-white"
                placeholder="от"
                step="0.01"
              />
              <span className="text-slate-300 text-[10px]">–</span>
              <input
                type="number"
                value={filterAmountTo}
                onChange={e => setFilterAmountTo(e.target.value)}
                className="flex-1 w-0 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-800 focus:outline-none focus:border-teal-500 focus:bg-white"
                placeholder="до"
                step="0.01"
              />
            </div>
          </div>

          <div>
            <div className="text-[11px] font-medium text-slate-500 mb-1.5">Тип операции</div>
            <div className="space-y-0.5">
              {[
                { key: 'income' as const, label: 'Поступление' },
                { key: 'expense' as const, label: 'Выплата' },
                { key: 'transfer' as const, label: 'Перемещение' },
              ].map(item => (
                <label key={item.key} className="flex items-center gap-2 cursor-pointer py-0.5">
                  <input type="checkbox" checked={filterTypes[item.key]} onChange={e => setFilterTypes(p => ({...p, [item.key]: e.target.checked}))} className="rounded accent-teal-600 h-3 w-3" />
                  <span className="text-[11px] text-slate-700">{item.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <div className="text-[11px] font-medium text-slate-500 mb-1">Счет</div>
            <FilterSelect value={filterAccountId} onChange={setFilterAccountId} placeholder="Все счета" options={accountOptions} />
          </div>

          <div>
            <div className="text-[11px] font-medium text-slate-500 mb-1">Контрагент</div>
            <FilterSelect value={filterContractorId} onChange={setFilterContractorId} placeholder="Все" options={contractorOptions} />
          </div>

          <div>
            <div className="text-[11px] font-medium text-slate-500 mb-1">Статья</div>
            <FilterSelect value={filterCategoryId} onChange={setFilterCategoryId} placeholder="Все статьи" options={categoryTreeOptions} />
          </div>

          <div>
            <div className="text-[11px] font-medium text-slate-500 mb-1">Студия</div>
            <FilterSelect value={filterStudioId} onChange={setFilterStudioId} placeholder="Все студии" options={studioOptions} />
          </div>

          <div>
            <div className="text-[11px] font-medium text-slate-500 mb-1">Статус</div>
            <FilterSelect value={filterConfirmed} onChange={(v) => setFilterConfirmed(v as '' | 'yes' | 'no')} placeholder="Все" options={confirmedOptions} searchable={false} />
          </div>

          {hasActiveFilters && (
            <button onClick={clearFilters} className="text-[11px] text-teal-600 hover:text-teal-700 font-medium flex items-center gap-1 pt-1">
              <X size={11} /> Сбросить все фильтры
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-white min-w-0">
        {visibleSelectedCount > 0 ? (
          <div className="px-6 py-3 border-b border-teal-200 bg-teal-50 flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3">
              <button onClick={() => setSelectedIds(new Set())} className="text-slate-500 hover:text-slate-700">
                <X size={16} />
              </button>
              <span className="text-sm font-medium text-teal-800">
                Выбрано: <b>{visibleSelectedCount}</b>
              </span>
            </div>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500 hover:bg-rose-600 text-white rounded-lg text-xs font-medium"
            >
              <Trash2 size={13} /> Удалить
            </button>
          </div>
        ) : (
          <div className="px-6 py-3 border-b border-slate-200 flex items-center justify-between gap-4 shrink-0">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-slate-800">Операции</h1>
              <Button 
                onClick={() => { setEditingTx(null); setIsModalOpen(true); }} 
                className="bg-teal-600 hover:bg-teal-700 text-white rounded-lg px-5 py-1.5 text-sm font-medium"
              >
                Создать
              </Button>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input 
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  type="text" 
                  placeholder="Поиск по операциям" 
                  className="w-52 pl-9 pr-8 py-2 bg-white text-slate-800 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-teal-500"
                />
                {search && <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X size={14}/></button>}
              </div>
              <button 
                onClick={() => setIsImportOpen(true)}
                className="px-3 py-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 flex items-center gap-1.5 text-sm shrink-0"
                title="Импорт из Excel"
              >
                <Upload size={14} /> Импорт
              </button>
              <button 
                onClick={handleExport}
                className="px-3 py-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 flex items-center gap-1.5 text-sm shrink-0"
                title="Экспорт в Excel"
              >
                <Download size={14} /> .xls
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-auto">
          <table className="w-full border-collapse" style={{ minWidth: 700 }}>
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="w-10 px-2 py-2.5 text-center">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={el => { if (el) el.indeterminate = someSelected; }}
                    onChange={toggleSelectAll}
                    className="rounded accent-teal-600 h-3.5 w-3.5 cursor-pointer"
                  />
                </th>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider" style={{ width: '10%' }}>Дата</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider" style={{ width: '15%' }}>Счет</th>
                <th className="w-8 px-1 py-2.5 text-center text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Тип</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider" style={{ width: '18%' }}>Контрагент</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider" style={{ width: '25%' }}>Статья</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider" style={{ width: '14%' }}>Студия</th>
                <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wider" style={{ width: '10%' }}>Сумма</th>
              </tr>
            </thead>
            <tbody>
              {groupedTransactions.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-slate-400 text-sm">Нет операций</td>
                </tr>
              )}
              {groupedTransactions.map(group => (
                <React.Fragment key={group.title}>
                  <tr>
                    <td colSpan={8} className="px-3 py-2 bg-slate-50/80 text-xs font-semibold text-slate-500 border-b border-slate-100">
                      {group.title}
                    </td>
                  </tr>
                  {group.items.map(tx => {
                    const account = accounts.find(a => a.id === tx.accountId);
                    const toAccount = accounts.find(a => a.id === tx.toAccountId);
                    const category = categories.find(c => c.id === tx.categoryId);
                    const studio = studios.find(s => s.id === tx.studioId);
                    const contractor = contractors.find(c => c.id === tx.contractorId);
                    const accountLE = account?.legalEntityId ? legalEntities.find(l => l.id === account.legalEntityId) : null;
                    const isSelected = selectedIds.has(tx.id);
                    
                    return (
                      <tr 
                        key={tx.id} 
                        onClick={() => setEditingTx(tx)}
                        className={`border-b border-slate-100 cursor-pointer ${isSelected ? 'bg-teal-50/40' : 'hover:bg-slate-50/60'}`}
                      >
                        <td className="px-2 py-3 text-center" onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(tx.id)}
                            className="rounded accent-teal-600 h-3.5 w-3.5 cursor-pointer"
                          />
                        </td>
                        <td className="px-3 py-3 text-slate-500 text-[13px] whitespace-nowrap align-top">
                          {formatDateShort(tx.date)}
                        </td>
                        <td className="px-3 py-3 align-top">
                          <div className="text-slate-800 text-[13px]">
                            {account?.name}
                          </div>
                          {accountLE && (
                            <div className="text-[11px] text-slate-400">{accountLE.name}</div>
                          )}
                          {tx.type === 'transfer' && toAccount && (
                            <div className="text-slate-400 text-[12px]">{toAccount.name}</div>
                          )}
                        </td>
                        <td className="px-1 py-3 text-center align-top">
                          {tx.type === 'income' && <ArrowLeft size={14} className="text-emerald-500 inline-block" />}
                          {tx.type === 'expense' && <ArrowRight size={14} className="text-rose-500 inline-block" />}
                          {tx.type === 'transfer' && <ArrowRightLeft size={14} className="text-blue-500 inline-block" />}
                        </td>
                        <td className="px-3 py-3 text-slate-700 text-[13px] align-top">
                          {contractor?.name || ''}
                        </td>
                        <td className="px-3 py-3 align-top">
                          <div className="text-slate-800 text-[13px] font-medium">
                            {tx.type === 'transfer' ? (
                              <span className="text-slate-500 font-normal">[Перемещение]</span>
                            ) : category?.name || ''}
                          </div>
                          {tx.description && (
                            <div className="text-[12px] text-slate-400 mt-0.5 leading-snug">{tx.description}</div>
                          )}
                        </td>
                        <td className="px-3 py-3 text-slate-600 text-[13px] align-top">
                          {studio?.name || ''}
                        </td>
                        <td className={`px-4 py-3 text-right align-top whitespace-nowrap text-[13px] font-semibold tabular-nums ${tx.type === 'income' ? 'text-emerald-600' : tx.type === 'expense' ? 'text-rose-600' : 'text-slate-600'}`}>
                          <div className="flex items-center justify-end gap-1">
                            {tx.confirmed && <CheckCircle2 size={13} className="text-teal-500 shrink-0" />}
                            <span>{tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : ''}{formatCurrency(tx.amount)}</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        <div className="h-10 bg-slate-50 border-t border-slate-200 flex items-center px-6 text-[12px] text-slate-500 justify-between shrink-0">
          <div className="flex gap-4 flex-wrap min-w-0">
            <span><b className="text-slate-700">{filteredTransactions.length}</b> операций</span>
            <span>поступление: <b className="text-emerald-600">{formatCurrency(totalIncome)}</b></span>
            <span>выплаты: <b className="text-rose-600">{formatCurrency(totalExpense)}</b></span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-1 rounded hover:bg-slate-200 disabled:opacity-30 disabled:cursor-default"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="text-slate-600 font-medium min-w-[60px] text-center">
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-1 rounded hover:bg-slate-200 disabled:opacity-30 disabled:cursor-default"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
            <div className="font-semibold text-slate-700">
              Итого: <span className={netResult >= 0 ? 'text-emerald-600' : 'text-rose-600'}>{formatCurrency(netResult)}</span>
            </div>
          </div>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Создание операции">
        <TransactionForm onClose={() => setIsModalOpen(false)} />
      </Modal>

      {editingTx && (
        <Modal isOpen={!!editingTx} onClose={() => setEditingTx(null)} title="Редактирование операции">
          <TransactionForm onClose={() => setEditingTx(null)} initialData={editingTx} />
        </Modal>
      )}

      <ImportModal isOpen={isImportOpen} onClose={() => setIsImportOpen(false)} />

      {showDeleteConfirm && (
        <Modal isOpen={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} title="Подтверждение удаления">
          <div className="p-6">
            <p className="text-slate-700 mb-6">
              Вы уверены, что хотите удалить <b>{selectedIds.size}</b> {selectedIds.size === 1 ? 'операцию' : selectedIds.size < 5 ? 'операции' : 'операций'}?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Отмена
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={isDeleting}
                className="px-4 py-2 text-sm bg-rose-500 hover:bg-rose-600 text-white rounded-lg font-medium disabled:opacity-50"
              >
                {isDeleting ? 'Удаление...' : 'Удалить'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
