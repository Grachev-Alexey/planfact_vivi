import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useFinance } from '../context/FinanceContext';
import { Transaction } from '../types';
import type { Account, Category, Studio, Contractor, LegalEntity } from '../types';
import { formatCurrency, formatDate, formatDateShort } from '../utils/format';
import { Search, Download, Upload, ArrowRight, ArrowLeft, ArrowRightLeft, X, Trash2, CheckCircle2, Calendar, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Filter } from 'lucide-react';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';
import { TransactionForm } from './TransactionForm';
import { FilterSelect } from './ui/FilterSelect';
import { DatePicker } from './ui/DatePicker';
import { ImportModal } from './ImportModal';
import { getMoscowNow } from '../utils/moscow';

const toLocalDate = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

type LookupMaps = {
  accounts: Map<string, Account>;
  categories: Map<string, Category>;
  studios: Map<string, Studio>;
  contractors: Map<string, Contractor>;
  legalEntities: Map<string, LegalEntity>;
};

function getTxStatus(tx: Transaction): 'pending' | 'approved' | 'paid' | 'verified' | null {
  if (tx.type === 'income') {
    if (tx.status === 'verified') return 'verified';
    return null;
  }
  if (tx.type !== 'expense') return null;
  if (tx.externalId?.startsWith('pr-')) return (tx.prStatus as 'pending' | 'approved' | 'paid' | 'verified') || 'pending';
  if (tx.status && ['pending', 'approved', 'paid', 'verified'].includes(tx.status)) return tx.status as 'pending' | 'approved' | 'paid' | 'verified';
  if (tx.confirmed) return 'verified';
  return 'pending';
}

const TX_STATUS_BADGE: Record<string, React.ReactNode> = {
  verified: <span className="text-[9px] px-1.5 py-0.5 rounded bg-teal-100 text-teal-700 font-medium shrink-0">Проверено</span>,
  paid:     <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-medium shrink-0">Оплачено</span>,
  approved: <span className="text-[9px] px-1.5 py-0.5 rounded bg-sky-100 text-sky-700 font-medium shrink-0">Утверждено</span>,
  pending:  <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium shrink-0">Ожидает</span>,
};

const TransactionRow = React.memo(({ tx, isSelected, maps, onToggle, onEdit }: {
  tx: Transaction;
  isSelected: boolean;
  maps: LookupMaps;
  onToggle: (id: string) => void;
  onEdit: (tx: Transaction) => void;
}) => {
  const account = maps.accounts.get(tx.accountId);
  const toAccount = tx.toAccountId ? maps.accounts.get(tx.toAccountId) : undefined;
  const category = tx.categoryId ? maps.categories.get(tx.categoryId) : undefined;
  const studio = tx.studioId ? maps.studios.get(tx.studioId) : undefined;
  const contractor = tx.contractorId ? maps.contractors.get(tx.contractorId) : undefined;
  const accountLE = account?.legalEntityId ? maps.legalEntities.get(account.legalEntityId) : undefined;

  return (
    <tr
      onClick={() => onEdit(tx)}
      className={`border-b border-slate-100 cursor-pointer ${isSelected ? 'bg-teal-50/40' : 'hover:bg-slate-50/60'}`}
    >
      <td className="px-2 py-3 text-center" onClick={e => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggle(tx.id)}
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
        {tx.type === 'income' && tx.settlementAccountName && (
          <div className="text-[11px] text-teal-600">→ {tx.settlementAccountName}</div>
        )}
      </td>
      <td className="px-1 py-3 text-center align-top">
        {tx.type === 'income' && <ArrowLeft size={14} className="text-emerald-500 inline-block" />}
        {tx.type === 'expense' && <ArrowRight size={14} className="text-rose-500 inline-block" />}
        {tx.type === 'transfer' && <ArrowRightLeft size={14} className="text-blue-500 inline-block" />}
      </td>
      <td className="px-3 py-3 text-slate-700 text-[13px] align-top">
        <div className="flex items-center gap-2">
          <span>{contractor?.name || ''}</span>
          {tx.clientType === 'primary' && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">
              первичный
            </span>
          )}
          {tx.clientType === 'regular' && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-medium">
              постоянный
            </span>
          )}
        </div>
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
        <div className="flex items-center justify-end gap-1 flex-wrap">
          {tx.type === 'income' && tx.yclientsStatus && (
            <span className={`w-2 h-2 rounded-full shrink-0 ${tx.yclientsStatus === 'match' ? 'bg-emerald-400' : tx.yclientsStatus === 'weak_match' ? 'bg-blue-400' : tx.yclientsStatus === 'amount_mismatch' ? 'bg-amber-400' : tx.yclientsStatus === 'not_found' ? 'bg-rose-400' : 'bg-slate-300'}`} title={tx.yclientsStatus === 'match' ? 'YClients: совпадение' : tx.yclientsStatus === 'weak_match' ? 'YClients: сумма совпадает' : tx.yclientsStatus === 'amount_mismatch' ? 'YClients: сумма отличается' : tx.yclientsStatus === 'not_found' ? 'YClients: не найдено' : ''} />
          )}
          {tx.type === 'expense'
            ? TX_STATUS_BADGE[getTxStatus(tx) || ''] ?? null
            : tx.type === 'income' && getTxStatus(tx) === 'verified'
              ? TX_STATUS_BADGE['verified']
              : tx.type === 'income' && tx.confirmed && <CheckCircle2 size={13} className="text-teal-500 shrink-0" />
          }
          <span>{tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : ''}{formatCurrency(tx.amount)}</span>
        </div>
      </td>
    </tr>
  );
});

export const TransactionList: React.FC = () => {
  const { transactions, categories, studios, accounts, contractors, legalEntities, deleteTransaction, updateTransaction, refreshData } = useFinance();
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  const lookupMaps = useMemo<LookupMaps>(() => ({
    accounts: new Map(accounts.map(a => [a.id, a])),
    categories: new Map(categories.map(c => [c.id, c])),
    studios: new Map(studios.map(s => [s.id, s])),
    contractors: new Map(contractors.map(c => [c.id, c])),
    legalEntities: new Map(legalEntities.map(l => [l.id, l])),
  }), [accounts, categories, studios, contractors, legalEntities]);

  const [filterTypes, setFilterTypes] = useState({
    income: true,
    expense: true,
    transfer: true
  });
  const [showTechTransfers, setShowTechTransfers] = useState(false);
  const [filterAccountIds, setFilterAccountIds] = useState<string[]>([]);
  const [filterContractorIds, setFilterContractorIds] = useState<string[]>([]);
  const [filterCategoryIds, setFilterCategoryIds] = useState<string[]>([]);
  const [filterStudioIds, setFilterStudioIds] = useState<string[]>([]);
  const [filterConfirmed, setFilterConfirmed] = useState<string[]>([]);
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterCreditDateFrom, setFilterCreditDateFrom] = useState('');
  const [filterCreditDateTo, setFilterCreditDateTo] = useState('');
  const [showCreditDatePicker, setShowCreditDatePicker] = useState(false);
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
    { id: '__group_income', label: 'Доход', isGroup: true },
    { id: 'income_unconfirmed', label: 'Не подтверждённый' },
    { id: 'income_confirmed',   label: 'Подтверждённый' },
    { id: 'income_verified',    label: 'Проверено' },
    { id: '__group_expense', label: 'Расход', isGroup: true },
    { id: 'pending',            label: 'Ожидает' },
    { id: 'approved',           label: 'Утверждено' },
    { id: 'paid',               label: 'Оплачено' },
    { id: 'verified',           label: 'Проверено' },
  ], []);

  const filteredTransactions = useMemo(() => {
    const searchLower = search.toLowerCase();
    return transactions.filter(t => {
      const contractor = lookupMaps.contractors.get(t.contractorId)?.name || '';
      const category = lookupMaps.categories.get(t.categoryId)?.name || '';
      const account = lookupMaps.accounts.get(t.accountId)?.name || '';
      
      const matchesSearch = !search || 
        t.description.toLowerCase().includes(searchLower) || 
        contractor.toLowerCase().includes(searchLower) ||
        category.toLowerCase().includes(searchLower) ||
        account.toLowerCase().includes(searchLower);
      
      if (!showTechTransfers && t.isTechnicalTransfer) return false;

      const matchesType = (t.type === 'income' && filterTypes.income) ||
                          (t.type === 'expense' && filterTypes.expense) ||
                          (t.type === 'transfer' && filterTypes.transfer);

      const matchesAccount = filterAccountIds.length === 0 || filterAccountIds.includes(String(t.accountId));
      const matchesContractor = filterContractorIds.length === 0 || filterContractorIds.includes(String(t.contractorId));
      const matchesCategory = filterCategoryIds.length === 0 || filterCategoryIds.includes(String(t.categoryId));
      const matchesStudio = filterStudioIds.length === 0 || filterStudioIds.includes(String(t.studioId));
      let effectiveStatuses: string[] = [];
      if (t.type === 'income') {
        effectiveStatuses.push(t.confirmed ? 'income_confirmed' : 'income_unconfirmed');
        if (t.status === 'verified') effectiveStatuses.push('income_verified');
      } else if (t.type === 'expense') {
        effectiveStatuses.push(getTxStatus(t) ?? 'pending');
      }
      const matchesConfirmed = filterConfirmed.length === 0 || effectiveStatuses.some(s => filterConfirmed.includes(s));

      const txDate = t.date.length > 10 ? t.date.slice(0, 10) : t.date;
      const matchesDateFrom = !filterDateFrom || txDate >= filterDateFrom;
      const matchesDateTo = !filterDateTo || txDate <= filterDateTo;

      const matchesAmountFrom = !filterAmountFrom || t.amount >= parseFloat(filterAmountFrom);
      const matchesAmountTo = !filterAmountTo || t.amount <= parseFloat(filterAmountTo);

      const creditDate = t.creditDate ? (t.creditDate.length > 10 ? t.creditDate.slice(0, 10) : t.creditDate) : '';
      const matchesCreditDateFrom = !filterCreditDateFrom || (creditDate && creditDate >= filterCreditDateFrom);
      const matchesCreditDateTo = !filterCreditDateTo || (creditDate && creditDate <= filterCreditDateTo);
      
      return matchesSearch && matchesType && matchesAccount && matchesContractor && matchesCategory && matchesStudio && matchesConfirmed && matchesDateFrom && matchesDateTo && matchesAmountFrom && matchesAmountTo && matchesCreditDateFrom && matchesCreditDateTo;
    });
  }, [transactions, search, filterTypes, showTechTransfers, filterAccountIds, filterContractorIds, filterCategoryIds, filterStudioIds, filterConfirmed, filterDateFrom, filterDateTo, filterCreditDateFrom, filterCreditDateTo, filterAmountFrom, filterAmountTo, lookupMaps]);

  const sortedTransactions = useMemo(() => {
    return [...filteredTransactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [filteredTransactions]);

  const totalPages = Math.max(1, Math.ceil(sortedTransactions.length / pageSize));

  useEffect(() => {
    setCurrentPage(1);
  }, [filterTypes, filterAccountIds, filterContractorIds, filterCategoryIds, filterStudioIds, filterConfirmed, filterDateFrom, filterDateTo, filterCreditDateFrom, filterCreditDateTo, filterAmountFrom, filterAmountTo, search]);

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
      const today = getMoscowNow();
      const yesterday = new Date(today);
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

  const handleExport = async () => {
    const data = filteredTransactions.map(tx => {
      const account = lookupMaps.accounts.get(tx.accountId)?.name || '';
      const toAccount = tx.toAccountId ? lookupMaps.accounts.get(tx.toAccountId)?.name || '' : '';
      const category = lookupMaps.categories.get(tx.categoryId)?.name || '';
      const studio = lookupMaps.studios.get(tx.studioId)?.name || '';
      const contractor = lookupMaps.contractors.get(tx.contractorId)?.name || '';
      let typeStr = 'Доход';
      if (tx.type === 'expense') typeStr = 'Расход';
      if (tx.type === 'transfer') typeStr = 'Перевод';
      return {
        'Дата': tx.date, 'Тип': typeStr, 'Сумма': tx.amount,
        'Счет': account, 'На счет': toAccount, 'Категория': category,
        'Контрагент': contractor, 'Студия': studio, 'Описание': tx.description
      };
    });
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Операции");
    XLSX.writeFile(wb, "vivi_transactions.xlsx");
  };

  const hasActiveFilters = filterAccountIds.length > 0 || filterContractorIds.length > 0 || filterCategoryIds.length > 0 || filterStudioIds.length > 0 || filterConfirmed.length > 0 || filterDateFrom || filterDateTo || filterCreditDateFrom || filterCreditDateTo || filterAmountFrom || filterAmountTo || !filterTypes.income || !filterTypes.expense || !filterTypes.transfer;

  const clearFilters = () => {
    setFilterAccountIds([]);
    setFilterContractorIds([]);
    setFilterCategoryIds([]);
    setFilterStudioIds([]);
    setFilterConfirmed([]);
    setFilterDateFrom('');
    setFilterDateTo('');
    setFilterCreditDateFrom('');
    setFilterCreditDateTo('');
    setFilterAmountFrom('');
    setFilterAmountTo('');
    setShowDatePicker(false);
    setShowCreditDatePicker(false);
    setFilterTypes({ income: true, expense: true, transfer: true });
    setShowTechTransfers(false);
  };

  const filteredIds = useMemo(() => new Set(filteredTransactions.map(t => t.id)), [filteredTransactions]);

  useEffect(() => {
    setSelectedIds(prev => {
      const reconciled = new Set([...prev].filter(id => filteredIds.has(id)));
      return reconciled.size !== prev.size ? reconciled : prev;
    });
  }, [filteredIds]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

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
    try {
      const res = await fetch('/api/transactions-batch/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': '1' },
        body: JSON.stringify({ ids: idsToDelete }),
      });
      if (res.ok) {
        setSelectedIds(new Set());
        setShowDeleteConfirm(false);
      }
    } catch (err) {
      console.error('Batch delete error:', err);
    }
    setIsDeleting(false);
    if (refreshData) refreshData();
  };

  const handleBulkConfirm = async (confirmed: boolean) => {
    setIsDeleting(true);
    const ids = [...selectedIds];
    try {
      await fetch('/api/transactions-batch/status', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-user-id': '1' },
        body: JSON.stringify({ ids, confirmed }),
      });
    } catch (err) {
      console.error('Batch confirm error:', err);
    }
    setSelectedIds(new Set());
    setIsDeleting(false);
    if (refreshData) refreshData();
  };

  const handleBulkVerify = async () => {
    const ids = [...selectedIds];
    const txs = transactions.filter(t => ids.includes(t.id) && t.type === 'income');
    if (txs.length === 0) {
      alert('Выберите хотя бы одно поступление для сверки');
      return;
    }

    setIsVerifying(true);
    let successCount = 0;
    let failCount = 0;

    for (const tx of txs) {
      try {
        const res = await fetch(`/api/yclients/verify/${tx.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        if (res.ok) successCount++;
        else failCount++;
      } catch (err) {
        console.error('Verify error:', err);
        failCount++;
      }
    }

    setIsVerifying(false);
    setSelectedIds(new Set());
    if (refreshData) refreshData();
    alert(`Сверка завершена. Успешно: ${successCount}, Ошибок: ${failCount}`);
  };

  const handleBulkIncomeVerified = async () => {
    const ids = [...selectedIds];
    const incomeTxs = transactions.filter(t => ids.includes(t.id) && t.type === 'income');
    if (incomeTxs.length === 0) return;
    setIsDeleting(true);
    try {
      await fetch('/api/transactions-batch/status', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-user-id': '1' },
        body: JSON.stringify({ ids: incomeTxs.map(t => t.id), status: 'verified' }),
      });
    } catch (err) {
      console.error('Batch income verified error:', err);
    }
    setSelectedIds(new Set());
    setIsDeleting(false);
    if (refreshData) refreshData();
  };

  const handleBulkExpenseStatus = async (newStatus: 'approved' | 'paid' | 'verified') => {
    setIsDeleting(true);
    const ids = [...selectedIds];
    const expenseTxs = transactions.filter(t => ids.includes(t.id) && t.type === 'expense');
    const prTxs = expenseTxs.filter(t => t.externalId?.startsWith('pr-'));
    const directTxs = expenseTxs.filter(t => !t.externalId?.startsWith('pr-'));

    try {
      const promises: Promise<any>[] = [];
      if (directTxs.length > 0) {
        promises.push(fetch('/api/transactions-batch/status', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'x-user-id': '1' },
          body: JSON.stringify({ ids: directTxs.map(t => t.id), status: newStatus }),
        }));
      }
      for (const tx of prTxs) {
        const prId = tx.externalId!.replace('pr-', '');
        promises.push(fetch(`/api/payment-requests/${prId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'x-user-id': '1' },
          body: JSON.stringify({ status: newStatus }),
        }));
      }
      await Promise.all(promises);
    } catch (err) {
      console.error('Batch expense status error:', err);
    }
    setSelectedIds(new Set());
    setIsDeleting(false);
    if (refreshData) refreshData();
  };

  const visibleSelectedCount = [...selectedIds].filter(id => filteredIds.has(id)).length;
  const allSelected = filteredTransactions.length > 0 && visibleSelectedCount === filteredTransactions.length;
  const someSelected = visibleSelectedCount > 0 && visibleSelectedCount < filteredTransactions.length;

  const selectedTransactions = useMemo(() => {
    return transactions.filter(t => selectedIds.has(t.id));
  }, [transactions, selectedIds]);

  const selectedIncome = selectedTransactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const selectedExpense = selectedTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const selectedTotal = selectedIncome - selectedExpense;

  const selectedTypes = new Set(selectedTransactions.map(t => t.type));
  const hasIncomeSelected = selectedTypes.has('income');
  const hasExpenseSelected = selectedTypes.has('expense');

  const datePresets = [
    { label: 'Просроченные', fn: () => { const d = getMoscowNow(); d.setDate(d.getDate() - 1); setFilterDateFrom(''); setFilterDateTo(toLocalDate(d)); }},
    { label: 'Будущие', fn: () => { const d = getMoscowNow(); d.setDate(d.getDate() + 1); setFilterDateFrom(toLocalDate(d)); setFilterDateTo(''); }},
    { label: 'Вчера', fn: () => { const d = getMoscowNow(); d.setDate(d.getDate() - 1); const s = toLocalDate(d); setFilterDateFrom(s); setFilterDateTo(s); }},
    { label: 'Сегодня', fn: () => { const s = toLocalDate(getMoscowNow()); setFilterDateFrom(s); setFilterDateTo(s); }},
    { label: 'Прошлая неделя', fn: () => {
      const now = getMoscowNow(); const day = now.getDay() || 7;
      const mon = new Date(now); mon.setDate(now.getDate() - day - 6);
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
      setFilterDateFrom(toLocalDate(mon)); setFilterDateTo(toLocalDate(sun));
    }},
    { label: 'Эта неделя', fn: () => {
      const now = getMoscowNow(); const day = now.getDay() || 7;
      const mon = new Date(now); mon.setDate(now.getDate() - day + 1);
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
      setFilterDateFrom(toLocalDate(mon)); setFilterDateTo(toLocalDate(sun));
    }},
    { label: 'Прошлый месяц', fn: () => {
      const now = getMoscowNow(); const y = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear(); const m = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
      setFilterDateFrom(toLocalDate(new Date(y, m, 1))); setFilterDateTo(toLocalDate(new Date(y, m + 1, 0)));
    }},
    { label: 'Этот месяц', fn: () => {
      const now = getMoscowNow();
      setFilterDateFrom(toLocalDate(new Date(now.getFullYear(), now.getMonth(), 1))); setFilterDateTo(toLocalDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)));
    }},
    { label: 'Прошлый квартал', fn: () => {
      const now = getMoscowNow(); const q = Math.floor(now.getMonth() / 3); const pq = q === 0 ? 3 : q - 1; const y = q === 0 ? now.getFullYear() - 1 : now.getFullYear();
      setFilterDateFrom(toLocalDate(new Date(y, pq * 3, 1))); setFilterDateTo(toLocalDate(new Date(y, pq * 3 + 3, 0)));
    }},
    { label: 'Этот квартал', fn: () => {
      const now = getMoscowNow(); const q = Math.floor(now.getMonth() / 3);
      setFilterDateFrom(toLocalDate(new Date(now.getFullYear(), q * 3, 1))); setFilterDateTo(toLocalDate(new Date(now.getFullYear(), q * 3 + 3, 0)));
    }},
    { label: 'Прошлый год', fn: () => { const y = getMoscowNow().getFullYear() - 1; setFilterDateFrom(`${y}-01-01`); setFilterDateTo(`${y}-12-31`); }},
    { label: 'Этот год', fn: () => { const y = getMoscowNow().getFullYear(); setFilterDateFrom(`${y}-01-01`); setFilterDateTo(`${y}-12-31`); }},
  ];

  const creditDatePresets = [
    { label: 'Просроченные', fn: () => { const d = getMoscowNow(); d.setDate(d.getDate() - 1); setFilterCreditDateFrom(''); setFilterCreditDateTo(toLocalDate(d)); }},
    { label: 'Будущие', fn: () => { const d = getMoscowNow(); d.setDate(d.getDate() + 1); setFilterCreditDateFrom(toLocalDate(d)); setFilterCreditDateTo(''); }},
    { label: 'Вчера', fn: () => { const d = getMoscowNow(); d.setDate(d.getDate() - 1); const s = toLocalDate(d); setFilterCreditDateFrom(s); setFilterCreditDateTo(s); }},
    { label: 'Сегодня', fn: () => { const s = toLocalDate(getMoscowNow()); setFilterCreditDateFrom(s); setFilterCreditDateTo(s); }},
    { label: 'Прошлая неделя', fn: () => {
      const now = getMoscowNow(); const day = now.getDay() || 7;
      const mon = new Date(now); mon.setDate(now.getDate() - day - 6);
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
      setFilterCreditDateFrom(toLocalDate(mon)); setFilterCreditDateTo(toLocalDate(sun));
    }},
    { label: 'Эта неделя', fn: () => {
      const now = getMoscowNow(); const day = now.getDay() || 7;
      const mon = new Date(now); mon.setDate(now.getDate() - day + 1);
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
      setFilterCreditDateFrom(toLocalDate(mon)); setFilterCreditDateTo(toLocalDate(sun));
    }},
    { label: 'Прошлый месяц', fn: () => {
      const now = getMoscowNow(); const y = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear(); const m = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
      setFilterCreditDateFrom(toLocalDate(new Date(y, m, 1))); setFilterCreditDateTo(toLocalDate(new Date(y, m + 1, 0)));
    }},
    { label: 'Этот месяц', fn: () => {
      const now = getMoscowNow();
      setFilterCreditDateFrom(toLocalDate(new Date(now.getFullYear(), now.getMonth(), 1))); setFilterCreditDateTo(toLocalDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)));
    }},
    { label: 'Прошлый квартал', fn: () => {
      const now = getMoscowNow(); const q = Math.floor(now.getMonth() / 3); const pq = q === 0 ? 3 : q - 1; const y = q === 0 ? now.getFullYear() - 1 : now.getFullYear();
      setFilterCreditDateFrom(toLocalDate(new Date(y, pq * 3, 1))); setFilterCreditDateTo(toLocalDate(new Date(y, pq * 3 + 3, 0)));
    }},
    { label: 'Этот квартал', fn: () => {
      const now = getMoscowNow(); const q = Math.floor(now.getMonth() / 3);
      setFilterCreditDateFrom(toLocalDate(new Date(now.getFullYear(), q * 3, 1))); setFilterCreditDateTo(toLocalDate(new Date(now.getFullYear(), q * 3 + 3, 0)));
    }},
    { label: 'Прошлый год', fn: () => { const y = getMoscowNow().getFullYear() - 1; setFilterCreditDateFrom(`${y}-01-01`); setFilterCreditDateTo(`${y}-12-31`); }},
    { label: 'Этот год', fn: () => { const y = getMoscowNow().getFullYear(); setFilterCreditDateFrom(`${y}-01-01`); setFilterCreditDateTo(`${y}-12-31`); }},
  ];

  const [showMobileFilters, setShowMobileFilters] = useState(false);

  return (
    <div className="flex h-[calc(100vh-56px)] overflow-hidden">
      {showMobileFilters && (
        <div className="lg:hidden fixed inset-0 bg-black/40 z-30" onClick={() => setShowMobileFilters(false)} />
      )}
      <div className={`w-64 lg:w-56 bg-white border-r border-slate-200 flex-col shrink-0 fixed lg:static inset-y-0 left-0 z-30 mt-14 lg:mt-0 transition-transform duration-200 ${showMobileFilters ? 'translate-x-0 flex' : '-translate-x-full lg:translate-x-0 hidden lg:flex'}`}>
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
            <div className="text-[11px] font-medium text-slate-500 mb-1">Дата зачисления</div>
            <button
              type="button"
              onClick={() => setShowCreditDatePicker(!showCreditDatePicker)}
              className={`w-full px-2.5 py-1.5 border rounded-lg text-xs text-left flex items-center gap-1.5 transition-colors ${
                filterCreditDateFrom || filterCreditDateTo
                  ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                  : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300'
              }`}
            >
              <Calendar size={11} className="shrink-0" />
              <span className="truncate text-[11px]">
                {filterCreditDateFrom || filterCreditDateTo
                  ? `${filterCreditDateFrom ? formatDate(filterCreditDateFrom) : '...'} – ${filterCreditDateTo ? formatDate(filterCreditDateTo) : '...'}`
                  : 'Укажите период'}
              </span>
              {(filterCreditDateFrom || filterCreditDateTo) && (
                <button type="button" onClick={(e) => { e.stopPropagation(); setFilterCreditDateFrom(''); setFilterCreditDateTo(''); }} className="shrink-0 text-indigo-400 hover:text-indigo-600 ml-auto">
                  <X size={10} />
                </button>
              )}
            </button>
            {showCreditDatePicker && (
              <div className="mt-2 border border-slate-200 rounded-lg bg-white shadow-sm p-2 space-y-2">
                <div className="grid grid-cols-2 gap-1">
                  {creditDatePresets.map(preset => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={preset.fn}
                      className="px-1.5 py-1 text-[10px] text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 rounded border border-slate-200 text-center transition-colors leading-tight"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <div className="space-y-1.5 pt-1">
                  <DatePicker value={filterCreditDateFrom} onChange={setFilterCreditDateFrom} placeholder="Начало периода" compact />
                  <DatePicker value={filterCreditDateTo} onChange={setFilterCreditDateTo} placeholder="Конец периода" compact />
                </div>
                <div className="flex gap-2 pt-1">
                  <button type="button" onClick={() => { setFilterCreditDateFrom(''); setFilterCreditDateTo(''); }} className="flex-1 text-[11px] text-slate-500 hover:text-slate-700 py-1">
                    Сбросить
                  </button>
                  <button type="button" onClick={() => setShowCreditDatePicker(false)} className="flex-1 text-[11px] bg-indigo-600 text-white rounded py-1 hover:bg-indigo-700 font-medium">
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
                onWheel={e => (e.target as HTMLInputElement).blur()}
                className="flex-1 w-0 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-800 focus:outline-none focus:border-teal-500 focus:bg-white"
                placeholder="от"
                step="0.01"
              />
              <span className="text-slate-300 text-[10px]">–</span>
              <input
                type="number"
                value={filterAmountTo}
                onChange={e => setFilterAmountTo(e.target.value)}
                onWheel={e => (e.target as HTMLInputElement).blur()}
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
              <label className="flex items-center gap-2 cursor-pointer py-0.5 mt-1 border-t border-slate-100 pt-1.5">
                <input type="checkbox" checked={showTechTransfers} onChange={e => setShowTechTransfers(e.target.checked)} className="rounded accent-amber-500 h-3 w-3" />
                <span className="text-[10px] text-slate-400">Тех. переводы</span>
              </label>
            </div>
          </div>

          <div>
            <div className="text-[11px] font-medium text-slate-500 mb-1">Счет</div>
            <FilterSelect value={filterAccountIds} onChange={setFilterAccountIds} placeholder="Все счета" options={accountOptions} />
          </div>

          <div>
            <div className="text-[11px] font-medium text-slate-500 mb-1">Контрагент</div>
            <FilterSelect value={filterContractorIds} onChange={setFilterContractorIds} placeholder="Все" options={contractorOptions} />
          </div>

          <div>
            <div className="text-[11px] font-medium text-slate-500 mb-1">Статья</div>
            <FilterSelect value={filterCategoryIds} onChange={setFilterCategoryIds} placeholder="Все статьи" options={categoryTreeOptions} />
          </div>

          <div>
            <div className="text-[11px] font-medium text-slate-500 mb-1">Студия</div>
            <FilterSelect value={filterStudioIds} onChange={setFilterStudioIds} placeholder="Все студии" options={studioOptions} />
          </div>

          <div>
            <div className="text-[11px] font-medium text-slate-500 mb-1">Статус</div>
            <FilterSelect value={filterConfirmed} onChange={setFilterConfirmed} placeholder="Все" options={confirmedOptions} searchable={false} />
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
          <div className="px-3 sm:px-6 py-3 border-b border-teal-200 bg-teal-50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3 shrink-0">
            <div className="flex items-center gap-3">
              <button onClick={() => setSelectedIds(new Set())} className="text-slate-500 hover:text-slate-700">
                <X size={16} />
              </button>
              <span className="text-sm font-medium text-teal-800">
                Выбрано: <b>{visibleSelectedCount}</b>
              </span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {hasIncomeSelected && (
                <button
                  onClick={handleBulkVerify}
                  disabled={isVerifying || isDeleting}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-medium disabled:opacity-50"
                >
                  <ArrowRightLeft size={12} /> {isVerifying ? 'Сверяю...' : 'Сверка YClients'}
                </button>
              )}
              {hasIncomeSelected && (
                <button
                  onClick={() => handleBulkConfirm(true)}
                  disabled={isDeleting || isVerifying}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-medium disabled:opacity-50"
                >
                  <CheckCircle2 size={12} /> Подтвердить
                </button>
              )}
              {hasIncomeSelected && (
                <button
                  onClick={() => handleBulkConfirm(false)}
                  disabled={isDeleting || isVerifying}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-500 hover:bg-slate-600 text-white rounded-lg text-[11px] font-medium disabled:opacity-50"
                >
                  Снять подтв.
                </button>
              )}
              {hasExpenseSelected && (
                <button
                  onClick={() => handleBulkExpenseStatus('approved')}
                  disabled={isDeleting || isVerifying}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-[11px] font-medium disabled:opacity-50"
                >
                  Утвердить
                </button>
              )}
              {hasExpenseSelected && (
                <button
                  onClick={() => handleBulkExpenseStatus('paid')}
                  disabled={isDeleting || isVerifying}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-medium disabled:opacity-50"
                >
                  Оплатить
                </button>
              )}
              {hasExpenseSelected && (
                <button
                  onClick={() => handleBulkExpenseStatus('verified')}
                  disabled={isDeleting || isVerifying}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-[11px] font-medium disabled:opacity-50"
                >
                  Проверено
                </button>
              )}
              <button
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isDeleting || isVerifying}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-rose-500 hover:bg-rose-600 text-white rounded-lg text-[11px] font-medium disabled:opacity-50"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        ) : (
          <div className="px-3 sm:px-6 py-3 border-b border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-4 shrink-0">
            <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
              <h1 className="text-lg sm:text-xl font-bold text-slate-800">Операции</h1>
              <Button 
                onClick={() => { setEditingTx(null); setIsModalOpen(true); }} 
                className="bg-teal-600 hover:bg-teal-700 text-white rounded-lg px-3 sm:px-5 py-1.5 text-xs sm:text-sm font-medium"
              >
                Создать
              </Button>
              <button
                onClick={() => setShowMobileFilters(!showMobileFilters)}
                className={`lg:hidden ml-auto px-2.5 py-1.5 border rounded-lg text-xs flex items-center gap-1 ${hasActiveFilters ? 'border-teal-300 bg-teal-50 text-teal-700' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}
              >
                <Filter size={13} /> Фильтры
              </button>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-initial">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input 
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  type="text" 
                  placeholder="Поиск" 
                  className="w-full sm:w-52 pl-9 pr-8 py-2 bg-white text-slate-800 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-teal-500"
                />
                {search && <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X size={14}/></button>}
              </div>
              <button 
                onClick={() => setIsImportOpen(true)}
                className="px-2 sm:px-3 py-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 flex items-center gap-1.5 text-xs sm:text-sm shrink-0"
                title="Импорт из Excel"
              >
                <Upload size={14} /> <span className="hidden sm:inline">Импорт</span>
              </button>
              <button 
                onClick={handleExport}
                className="px-2 sm:px-3 py-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 flex items-center gap-1.5 text-xs sm:text-sm shrink-0"
                title="Экспорт в Excel"
              >
                <Download size={14} /> <span className="hidden sm:inline">.xls</span>
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
              {groupedTransactions.map(group => {
                const dayIncome = group.items.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
                const dayExpense = group.items.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
                const dayNet = dayIncome - dayExpense;
                return (
                  <React.Fragment key={group.title}>
                    <tr>
                      <td colSpan={8} className="px-3 py-1.5 bg-slate-50/80 text-xs font-semibold text-slate-500 border-b border-slate-100">
                        <div className="flex items-center justify-between">
                          <span>{group.title}</span>
                          <span className="text-[10px] font-normal text-slate-400">
                            {formatCurrency(Math.abs(dayNet))}
                          </span>
                        </div>
                      </td>
                    </tr>
                    {group.items.map(tx => (
                      <TransactionRow
                        key={tx.id}
                        tx={tx}
                        isSelected={selectedIds.has(tx.id)}
                        maps={lookupMaps}
                        onToggle={toggleSelect}
                        onEdit={setEditingTx}
                      />
                    ))}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="border-t border-slate-200 shrink-0">
          {visibleSelectedCount > 0 && (
            <div className="bg-teal-50/70 px-3 sm:px-6 py-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 text-[11px] sm:text-[12px] border-b border-teal-100">
              <div className="flex gap-4 flex-wrap min-w-0 text-slate-600">
                <span>Выбрано: <b className="text-teal-700">{visibleSelectedCount}</b></span>
                {selectedIncome > 0 && <span>поступления: <b className="text-emerald-600">{formatCurrency(selectedIncome)}</b></span>}
                {selectedExpense > 0 && <span>выплаты: <b className="text-rose-600">{formatCurrency(selectedExpense)}</b></span>}
              </div>
              <div className="font-semibold text-slate-700">
                Итого: <span className={selectedTotal >= 0 ? 'text-emerald-600' : 'text-rose-600'}>{formatCurrency(selectedTotal)}</span>
              </div>
            </div>
          )}

          <div className="bg-white px-3 sm:px-6 py-2.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[11px] sm:text-[12px] text-slate-500">
            <div className="flex gap-4 flex-wrap min-w-0">
              <span><b className="text-slate-700">{filteredTransactions.length}</b> операций</span>
              <span>поступления: <b className="text-emerald-600">{formatCurrency(totalIncome)}</b></span>
              <span>выплаты: <b className="text-rose-600">{formatCurrency(totalExpense)}</b></span>
              <span className="font-semibold">итого: <span className={netResult >= 0 ? 'text-emerald-600' : 'text-rose-600'}>{formatCurrency(netResult)}</span></span>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-slate-100 disabled:opacity-20 disabled:cursor-default transition-colors"
                  title="Первая страница"
                >
                  <ChevronsLeft size={14} />
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-slate-100 disabled:opacity-20 disabled:cursor-default transition-colors"
                >
                  <ChevronLeft size={14} />
                </button>

                {(() => {
                  const pages: (number | '...')[] = [];
                  if (totalPages <= 7) {
                    for (let i = 1; i <= totalPages; i++) pages.push(i);
                  } else {
                    pages.push(1);
                    if (currentPage > 3) pages.push('...');
                    const start = Math.max(2, currentPage - 1);
                    const end = Math.min(totalPages - 1, currentPage + 1);
                    for (let i = start; i <= end; i++) pages.push(i);
                    if (currentPage < totalPages - 2) pages.push('...');
                    pages.push(totalPages);
                  }
                  return pages.map((p, i) =>
                    p === '...' ? (
                      <span key={`dots-${i}`} className="w-7 h-7 flex items-center justify-center text-slate-400">···</span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => setCurrentPage(p)}
                        className={`w-7 h-7 flex items-center justify-center rounded-md text-xs font-medium transition-all ${
                          currentPage === p
                            ? 'bg-teal-600 text-white shadow-sm'
                            : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {p}
                      </button>
                    )
                  );
                })()}

                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-slate-100 disabled:opacity-20 disabled:cursor-default transition-colors"
                >
                  <ChevronRight size={14} />
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-slate-100 disabled:opacity-20 disabled:cursor-default transition-colors"
                  title="Последняя страница"
                >
                  <ChevronsRight size={14} />
                </button>
              </div>
            )}
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
