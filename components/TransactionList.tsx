import React, { useState, useMemo } from 'react';
import { useFinance } from '../context/FinanceContext';
import { Transaction } from '../types';
import { formatCurrency, formatDate } from '../utils/format';
import { Search, Download, ArrowRight, ArrowLeft, ArrowRightLeft, X } from 'lucide-react';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';
import { TransactionForm } from './TransactionForm';
import * as XLSX from 'xlsx';

export const TransactionList: React.FC = () => {
  const { transactions, categories, studios, accounts, contractors } = useFinance();
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

  const [filterTypes, setFilterTypes] = useState({
    income: true,
    expense: true,
    transfer: true
  });
  const [filterAccountId, setFilterAccountId] = useState('');
  const [filterContractorId, setFilterContractorId] = useState('');
  const [filterCategoryId, setFilterCategoryId] = useState('');
  const [filterStudioId, setFilterStudioId] = useState('');

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

      const matchesAccount = !filterAccountId || t.accountId === filterAccountId;
      const matchesContractor = !filterContractorId || t.contractorId === filterContractorId;
      const matchesCategory = !filterCategoryId || t.categoryId === filterCategoryId;
      const matchesStudio = !filterStudioId || t.studioId === filterStudioId;
      
      return matchesSearch && matchesType && matchesAccount && matchesContractor && matchesCategory && matchesStudio;
    });
  }, [transactions, search, filterTypes, filterAccountId, filterContractorId, filterCategoryId, filterStudioId, contractors, categories, accounts]);

  const groupedTransactions = useMemo(() => {
    const groups: { [key: string]: typeof transactions } = {};
    const sorted = [...filteredTransactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    sorted.forEach(tx => {
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
  }, [filteredTransactions]);

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

  const hasActiveFilters = filterAccountId || filterContractorId || filterCategoryId || filterStudioId || !filterTypes.income || !filterTypes.expense || !filterTypes.transfer;

  const clearFilters = () => {
    setFilterAccountId('');
    setFilterContractorId('');
    setFilterCategoryId('');
    setFilterStudioId('');
    setFilterTypes({ income: true, expense: true, transfer: true });
  };

  return (
    <div className="flex h-[calc(100vh-56px)]">
      <div className="w-60 bg-white border-r border-slate-200 flex-col hidden lg:flex shrink-0">
        <div className="p-4 border-b border-slate-100">
          <h2 className="font-bold text-sm text-slate-800 uppercase tracking-wider">Фильтры</h2>
        </div>
        
        <div className="p-4 space-y-5 overflow-y-auto flex-1">
          <div>
            <div className="text-xs font-medium text-slate-500 mb-2">Тип операции</div>
            <div className="space-y-1.5">
              {[
                { key: 'income' as const, label: 'Поступление' },
                { key: 'expense' as const, label: 'Выплата' },
                { key: 'transfer' as const, label: 'Перемещение' },
              ].map(item => (
                <label key={item.key} className="flex items-center gap-2 cursor-pointer py-0.5">
                  <input type="checkbox" checked={filterTypes[item.key]} onChange={e => setFilterTypes(p => ({...p, [item.key]: e.target.checked}))} className="rounded text-teal-600 focus:ring-teal-500 h-3.5 w-3.5" />
                  <span className="text-sm text-slate-700">{item.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs font-medium text-slate-500 mb-2">Юрлица и счета</div>
            <select value={filterAccountId} onChange={e => setFilterAccountId(e.target.value)} className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-200 rounded text-sm focus:outline-none focus:border-teal-500">
              <option value="">Все счета</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>

          <div>
            <div className="text-xs font-medium text-slate-500 mb-2">Контрагенты</div>
            <select value={filterContractorId} onChange={e => setFilterContractorId(e.target.value)} className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-200 rounded text-sm focus:outline-none focus:border-teal-500">
              <option value="">Все</option>
              {contractors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <div className="text-xs font-medium text-slate-500 mb-2">Статьи учета</div>
            <select value={filterCategoryId} onChange={e => setFilterCategoryId(e.target.value)} className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-200 rounded text-sm focus:outline-none focus:border-teal-500">
              <option value="">Все статьи</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <div className="text-xs font-medium text-slate-500 mb-2">Студия</div>
            <select value={filterStudioId} onChange={e => setFilterStudioId(e.target.value)} className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-200 rounded text-sm focus:outline-none focus:border-teal-500">
              <option value="">Все студии</option>
              {studios.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          {hasActiveFilters && (
            <button onClick={clearFilters} className="text-xs text-teal-600 hover:text-teal-700 font-medium">
              Сбросить фильтры
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-white min-w-0">
        <div className="px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
             <h1 className="text-lg font-bold text-slate-800">Операции</h1>
             <Button 
               onClick={() => { setEditingTx(null); setIsModalOpen(true); }} 
               className="bg-teal-600 hover:bg-teal-700 text-white rounded-lg px-4 py-1.5 text-sm font-medium"
             >
               Создать
             </Button>
          </div>
          
          <div className="flex items-center gap-2">
             <div className="relative w-56">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                <input 
                   value={search}
                   onChange={e => setSearch(e.target.value)}
                   type="text" 
                   placeholder="Поиск по операциям" 
                   className="w-full pl-9 pr-8 py-1.5 bg-slate-50 text-slate-900 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500 focus:bg-white"
                />
                {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X size={14}/></button>}
             </div>
             <button 
               onClick={handleExport}
               className="p-1.5 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 flex items-center gap-1"
               title="Экспорт в Excel"
             >
                <Download size={15} /> <span className="text-xs">.xls</span>
             </button>
          </div>
        </div>

        <div className="grid grid-cols-[100px_1fr_36px_1fr_1fr_120px_100px] px-4 py-2 bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
           <div>Дата</div>
           <div>Счет</div>
           <div className="text-center">Тип</div>
           <div>Контрагент</div>
           <div>Статья</div>
           <div>Студия</div>
           <div className="text-right">Сумма</div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {groupedTransactions.length === 0 && (
            <div className="p-8 text-center text-slate-400 text-sm">Нет операций</div>
          )}
          {groupedTransactions.map(group => (
            <div key={group.title}>
               <div className="px-4 py-1.5 bg-slate-50 text-xs font-bold text-slate-600 border-b border-slate-100 sticky top-0">
                 {group.title}
               </div>
               
               {group.items.map(tx => {
                  const account = accounts.find(a => a.id === tx.accountId);
                  const toAccount = accounts.find(a => a.id === tx.toAccountId);
                  const category = categories.find(c => c.id === tx.categoryId);
                  const studio = studios.find(s => s.id === tx.studioId);
                  const contractor = contractors.find(c => c.id === tx.contractorId);
                  
                  return (
                    <div 
                      key={tx.id} 
                      onClick={() => setEditingTx(tx)}
                      className="grid grid-cols-[100px_1fr_36px_1fr_1fr_120px_100px] items-center px-4 py-2.5 border-b border-slate-100 hover:bg-teal-50/30 text-sm cursor-pointer group"
                    >
                      <div className="text-slate-600 text-xs">{formatDate(tx.date)}</div>
                      <div className="text-slate-700 truncate pr-3 text-xs" title={account?.name}>
                          {account?.name}
                          {tx.type === 'transfer' && toAccount && (
                              <span className="text-slate-400"> → {toAccount.name}</span>
                          )}
                      </div>
                      <div className="flex justify-center">
                         {tx.type === 'income' && <ArrowLeft size={14} className="text-emerald-500" />}
                         {tx.type === 'expense' && <ArrowRight size={14} className="text-rose-500" />}
                         {tx.type === 'transfer' && <ArrowRightLeft size={14} className="text-blue-500" />}
                      </div>
                      <div className="text-slate-600 truncate pr-3 text-xs">{contractor?.name || ''}</div>
                      <div className="flex flex-col pr-3 min-w-0">
                         <span className="text-teal-700 font-medium truncate text-xs">
                           {tx.type === 'transfer' ? 'Перевод между счетами' : category?.name || ''}
                         </span>
                         {tx.description && <span className="text-[11px] text-slate-400 truncate">{tx.description}</span>}
                      </div>
                      <div className="text-xs text-slate-500 truncate">{studio?.name || ''}</div>
                      <div className={`text-right text-xs font-semibold ${tx.type === 'income' ? 'text-emerald-600' : tx.type === 'expense' ? 'text-rose-600' : 'text-slate-600'}`}>
                         {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : ''}{formatCurrency(tx.amount)}
                      </div>
                    </div>
                  )
               })}
            </div>
          ))}
        </div>

        <div className="h-10 bg-slate-50 border-t border-slate-200 flex items-center px-4 text-[11px] text-slate-500 justify-between shrink-0">
           <div className="flex gap-4">
              <span><b>{filteredTransactions.length}</b> операций</span>
              <span>поступления: <b className="text-emerald-600">{formatCurrency(totalIncome)}</b></span>
              <span>выплаты: <b className="text-rose-600">{formatCurrency(totalExpense)}</b></span>
              <span>перемещения: <b>{formatCurrency(totalTransfers)}</b></span>
           </div>
           <div className="font-bold">
              Итого: <span className={netResult >= 0 ? 'text-emerald-600' : 'text-rose-600'}>{formatCurrency(netResult)}</span>
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
    </div>
  );
};
