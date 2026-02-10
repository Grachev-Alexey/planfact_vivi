import React, { useState, useMemo } from 'react';
import { useFinance } from '../context/FinanceContext';
import { Transaction } from '../types';
import { formatCurrency, formatDate } from '../utils/format';
import { Search, Plus, Upload, Download, MoreVertical, ArrowRight, ArrowLeft, ArrowRightLeft, Filter, X, ChevronDown, Calendar, MessageCircle } from 'lucide-react';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';
import { TransactionForm } from './TransactionForm';
import * as XLSX from 'xlsx';

export const TransactionList: React.FC = () => {
  const { transactions, categories, studios, accounts, contractors, projects, deleteTransaction } = useFinance();
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [selectedTxIds, setSelectedTxIds] = useState<Set<string>>(new Set());

  // Filter States
  const [filterTypes, setFilterTypes] = useState({
    income: true,
    expense: true,
    transfer: true
  });

  const toggleTxSelection = (id: string) => {
    const newSet = new Set(selectedTxIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedTxIds(newSet);
  };

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      // Find related names for search
      const contractor = contractors.find(c => c.id === t.contractorId)?.name || '';
      const category = categories.find(c => c.id === t.categoryId)?.name || '';
      
      const matchesSearch = t.description.toLowerCase().includes(search.toLowerCase()) || 
                            contractor.toLowerCase().includes(search.toLowerCase()) ||
                            category.toLowerCase().includes(search.toLowerCase());
      
      const matchesType = (t.type === 'income' && filterTypes.income) ||
                          (t.type === 'expense' && filterTypes.expense) ||
                          (t.type === 'transfer' && filterTypes.transfer);
      
      return matchesSearch && matchesType;
    });
  }, [transactions, search, filterTypes, contractors, categories]);

  // Grouping Logic
  const groupedTransactions = useMemo(() => {
    const groups: { [key: string]: typeof transactions } = {};
    
    filteredTransactions.forEach(tx => {
      const date = new Date(tx.date);
      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      let key = formatDate(tx.date);
      if (date.toDateString() === today.toDateString()) key = 'Сегодня';
      else if (date.toDateString() === yesterday.toDateString()) key = 'Вчера';
      
      const isToday = date.toDateString() === today.toDateString();
      const groupKey = isToday ? 'Сегодня' : 'Вчера и ранее';
      
      if (!groups[groupKey]) groups[groupKey] = [];
      groups[groupKey].push(tx);
    });
    
    return Object.keys(groups).sort((a, b) => a === 'Сегодня' ? -1 : 1).map(key => ({
      title: key,
      items: groups[key]
    }));
  }, [filteredTransactions]);

  // Calculations for Footer
  const totalIncome = filteredTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = filteredTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const netResult = totalIncome - totalExpense;

  const handleExport = () => {
    const data = filteredTransactions.map(tx => {
      const account = accounts.find(a => a.id === tx.accountId)?.name || '';
      const toAccount = accounts.find(a => a.id === tx.toAccountId)?.name || '';
      const category = categories.find(c => c.id === tx.categoryId)?.name || '';
      const studio = studios.find(s => s.id === tx.studioId)?.name || '';
      const contractor = contractors.find(c => c.id === tx.contractorId)?.name || '';
      const project = projects.find(p => p.id === tx.projectId)?.name || '';
  
      let typeStr = 'Доход';
      if (tx.type === 'expense') typeStr = 'Расход';
      if (tx.type === 'transfer') typeStr = 'Перевод';
  
      return {
        'Дата': tx.date,
        'Тип': typeStr,
        'Сумма': tx.amount,
        'Счет': account,
        'На счет (Перевод)': toAccount,
        'Категория': category,
        'Контрагент': contractor,
        'Проект': project,
        'Студия': studio,
        'Описание': tx.description
      };
    });
  
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Операции");
    
    XLSX.writeFile(wb, "vivi_transactions.xlsx");
  };

  return (
    <div className="flex h-[calc(100vh-56px)]">
      {/* Left Filter Sidebar */}
      <div className="w-64 bg-white border-r border-slate-200 flex flex-col hidden lg:flex">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-bold text-lg text-slate-800">Фильтры</h2>
          <button className="text-slate-400 hover:text-slate-600"><ArrowLeft size={16} /></button>
        </div>
        
        <div className="flex border-b border-slate-100">
          <button className="flex-1 py-2 text-sm font-medium text-teal-600 border-b-2 border-teal-600 bg-teal-50">Общие</button>
        </div>

        <div className="p-4 space-y-6 overflow-y-auto custom-scrollbar">
          {/* Types */}
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase mb-3">Тип операции</div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={filterTypes.income} onChange={e => setFilterTypes(p => ({...p, income: e.target.checked}))} className="rounded text-teal-600 focus:ring-teal-500" />
                <span className="text-sm text-slate-700">Поступление</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={filterTypes.expense} onChange={e => setFilterTypes(p => ({...p, expense: e.target.checked}))} className="rounded text-teal-600 focus:ring-teal-500" />
                <span className="text-sm text-slate-700">Выплата</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={filterTypes.transfer} onChange={e => setFilterTypes(p => ({...p, transfer: e.target.checked}))} className="rounded text-teal-600 focus:ring-teal-500" />
                <span className="text-sm text-slate-700">Перемещение</span>
              </label>
            </div>
          </div>

          {/* Date Period */}
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase mb-3">Дата оплаты</div>
             <div className="relative">
                <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Укажите период"
                  className="w-full pl-9 pr-3 py-2 bg-white text-slate-900 border border-slate-200 rounded text-sm focus:outline-none focus:border-teal-500"
                />
             </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col bg-white min-w-0">
        {/* Top Header */}
        <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
             <h1 className="text-2xl font-bold text-slate-800">Операции</h1>
             <Button 
               onClick={() => { setEditingTx(null); setIsModalOpen(true); }} 
               className="bg-teal-600 hover:bg-teal-700 text-white rounded px-4 py-1.5 text-sm font-medium"
             >
               Создать
             </Button>
          </div>
          
          <div className="flex items-center gap-2">
             <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                   value={search}
                   onChange={e => setSearch(e.target.value)}
                   type="text" 
                   placeholder="Поиск..." 
                   className="w-full pl-9 pr-8 py-1.5 bg-slate-50 text-slate-900 border border-slate-200 rounded-full text-sm focus:outline-none focus:border-teal-500"
                />
                {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X size={14}/></button>}
             </div>
             <button 
               onClick={handleExport}
               className="p-1.5 border border-slate-200 rounded text-slate-500 hover:bg-slate-50 flex items-center"
               title="Экспорт в Excel"
             >
                <Download size={16} /> <span className="text-xs ml-1">.xls</span>
             </button>
          </div>
        </div>

        {/* Table Header */}
        <div className="flex items-center px-4 py-3 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500">
           <div className="w-10 text-center"><input type="checkbox" className="rounded text-teal-600" /></div>
           <div className="w-32">Дата</div>
           <div className="w-48">Счет</div>
           <div className="w-10 text-center">Тип</div>
           <div className="w-48">Контрагент</div>
           <div className="flex-1">Статья / Комментарий</div>
           <div className="w-40">Проект</div>
           <div className="w-32 text-right">Сумма</div>
           <div className="w-8"></div>
        </div>

        {/* Table Body - Scrollable */}
        <div className="flex-1 overflow-y-auto">
          {groupedTransactions.map(group => (
            <div key={group.title}>
               <div className="px-4 py-2 bg-white text-sm font-bold text-slate-800 border-b border-slate-100">
                 {group.title}
               </div>
               
               {group.items.length === 0 ? (
                 <div className="p-4 text-center text-slate-400 text-sm italic">Нет операций</div>
               ) : (
                 group.items.map(tx => {
                    const account = accounts.find(a => a.id === tx.accountId);
                    const toAccount = accounts.find(a => a.id === tx.toAccountId);
                    const category = categories.find(c => c.id === tx.categoryId);
                    const studio = studios.find(s => s.id === tx.studioId);
                    const contractor = contractors.find(c => c.id === tx.contractorId);
                    const project = projects.find(p => p.id === tx.projectId);
                    
                    return (
                      <div 
                        key={tx.id} 
                        onClick={() => setEditingTx(tx)}
                        className="flex items-center px-4 py-3 border-b border-slate-100 hover:bg-slate-50 group text-sm transition-colors cursor-pointer"
                      >
                        <div className="w-10 text-center">
                          <input 
                            type="checkbox" 
                            checked={selectedTxIds.has(tx.id)}
                            onClick={(e) => e.stopPropagation()}
                            onChange={() => toggleTxSelection(tx.id)}
                            className="rounded text-teal-600 focus:ring-teal-500 cursor-pointer" 
                          />
                        </div>
                        <div className="w-32 flex flex-col justify-center">
                           <span className="text-slate-700">{formatDate(tx.date)}</span>
                           <span className="text-[10px] text-slate-400">{tx.date}</span>
                        </div>
                        <div className="w-48 text-slate-700 truncate pr-4" title={account?.name}>
                            {account?.name} 
                            {tx.type === 'transfer' && toAccount && (
                                <span className="text-xs text-slate-500"> → {toAccount.name}</span>
                            )}
                        </div>
                        <div className="w-10 text-center flex justify-center">
                           {tx.type === 'income' && <ArrowLeft size={16} className="text-emerald-500" />}
                           {tx.type === 'expense' && <ArrowRight size={16} className="text-rose-500" />}
                           {tx.type === 'transfer' && <ArrowRightLeft size={16} className="text-blue-500" />}
                        </div>
                        <div className="w-48 text-slate-700 truncate pr-4">{contractor?.name || '-'}</div>
                        <div className="flex-1 flex flex-col pr-4 min-w-0">
                           <span className="text-slate-700 font-medium truncate">
                             {tx.type === 'transfer' ? 'Перевод между счетами' : category?.name}
                           </span>
                           {tx.description && <span className="text-xs text-slate-400 truncate">{tx.description}</span>}
                        </div>
                        <div className="w-40 flex flex-col min-w-0">
                            {studio && <span className="text-xs text-slate-500 truncate">{studio.name}</span>}
                            {project && <span className="text-xs text-slate-600 truncate bg-slate-100 px-1 rounded w-fit">{project.name}</span>}
                        </div>
                        <div className={`w-32 text-right font-medium ${tx.type === 'income' ? 'text-slate-800' : tx.type === 'expense' ? 'text-rose-600' : 'text-slate-600'}`}>
                           {tx.type === 'expense' && '-'}{formatCurrency(tx.amount)}
                        </div>
                        <div className="w-8 flex justify-end opacity-0 group-hover:opacity-100">
                            <button 
                                onClick={(e) => { e.stopPropagation(); deleteTransaction(tx.id); }} 
                                className="text-slate-400 hover:text-rose-500"
                            >
                               <MoreVertical size={16} />
                            </button>
                        </div>
                      </div>
                    )
                 })
               )}
            </div>
          ))}
          
          <div className="h-12"></div>
        </div>

        {/* Footer Summary */}
        <div className="h-12 bg-slate-50 border-t border-slate-200 flex items-center px-6 text-xs text-slate-600 justify-between shrink-0">
           <div className="flex gap-6">
              <span><b>{filteredTransactions.length}</b> операций</span>
              <span className="text-emerald-600">{formatCurrency(totalIncome)}</span>
              <span className="text-rose-600">-{formatCurrency(totalExpense)}</span>
           </div>
           <div className="font-bold">
              Итого: <span className={netResult >= 0 ? 'text-emerald-600' : 'text-rose-600'}>{formatCurrency(netResult)}</span>
           </div>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Новая операция">
         <TransactionForm onClose={() => setIsModalOpen(false)} />
      </Modal>

      {/* Edit Transaction Modal */}
      {editingTx && (
        <Modal isOpen={!!editingTx} onClose={() => setEditingTx(null)} title="Редактирование операции">
            <TransactionForm onClose={() => setEditingTx(null)} initialData={editingTx} />
        </Modal>
      )}
    </div>
  );
};