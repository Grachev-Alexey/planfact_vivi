import React, { useState, useEffect } from 'react';
import { useFinance } from '../context/FinanceContext';
import { Transaction, TransactionType } from '../types';
import { Button } from './ui/Button';

interface TransactionFormProps {
  onClose: () => void;
  initialData?: Transaction;
}

export const TransactionForm: React.FC<TransactionFormProps> = ({ onClose, initialData }) => {
  const { categories, accounts, studios, contractors, projects, addTransaction, updateTransaction } = useFinance();
  
  const [type, setType] = useState<TransactionType>('income');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [categoryId, setCategoryId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [studioId, setStudioId] = useState('');
  const [contractorId, setContractorId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [description, setDescription] = useState('');

  // Initialize with initialData if present
  useEffect(() => {
    if (initialData) {
      setType(initialData.type);
      setAmount(initialData.amount.toString());
      // Handle potential full ISO string
      setDate(initialData.date.split('T')[0]);
      setCategoryId(initialData.categoryId || '');
      setAccountId(initialData.accountId);
      setToAccountId(initialData.toAccountId || '');
      setStudioId(initialData.studioId || '');
      setContractorId(initialData.contractorId || '');
      setProjectId(initialData.projectId || '');
      setDescription(initialData.description || '');
    } else {
        // Set defaults only for new transactions
        if (accounts.length > 0 && !accountId) setAccountId(accounts[0].id);
        if (studios.length > 0 && !studioId) setStudioId(studios[0].id);
    }
  }, [initialData, accounts, studios]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !accountId) return;
    if (type !== 'transfer' && !categoryId) return;
    if (type === 'transfer' && !toAccountId) return;

    const payload = {
      date,
      amount: parseFloat(amount),
      type,
      categoryId: type === 'transfer' ? undefined : categoryId,
      accountId,
      toAccountId: type === 'transfer' ? toAccountId : undefined,
      studioId: studioId || undefined,
      contractorId: type === 'transfer' ? undefined : (contractorId || undefined),
      projectId: projectId || undefined,
      description,
    };

    if (initialData) {
      updateTransaction(initialData.id, payload);
    } else {
      addTransaction(payload);
    }
    onClose();
  };

  const filteredCategories = categories.filter(c => c.type === type);

  return (
    <div className="flex flex-col h-full">
        {/* Tabs */}
        <div className="flex border-b border-slate-200 mb-6 overflow-x-auto">
            <button
            type="button"
            onClick={() => setType('income')}
            className={`flex-1 sm:flex-none px-6 py-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${
                type === 'income' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
            >
            Поступление
            </button>
            <button
            type="button"
            onClick={() => setType('expense')}
            className={`flex-1 sm:flex-none px-6 py-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${
                type === 'expense' ? 'border-rose-500 text-rose-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
            >
            Выплата
            </button>
            <button
            type="button"
            onClick={() => setType('transfer')}
            className={`flex-1 sm:flex-none px-6 py-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${
                type === 'transfer' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
            >
            Перемещение
            </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Date & Confirmation */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-end">
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5">Дата оплаты</label>
                    <input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="w-full px-4 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                        style={{ colorScheme: 'light' }}
                        required
                    />
                </div>
                <div className="flex items-center gap-3 pb-3">
                     <div className="relative flex items-center">
                        <input 
                            type="checkbox" 
                            id="confirmed" 
                            defaultChecked 
                            className="peer h-5 w-5 cursor-pointer appearance-none rounded bg-white border border-slate-300 shadow-sm text-teal-600 focus:ring-teal-500 checked:bg-teal-600 checked:border-teal-600 transition-all" 
                        />
                        <svg className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white pointer-events-none opacity-0 peer-checked:opacity-100" viewBox="0 0 14 14" fill="none">
                            <path d="M11.6666 3.5L5.24992 9.91667L2.33325 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                     </div>
                     <label htmlFor="confirmed" className="text-sm font-medium text-slate-700 cursor-pointer">Подтвердить оплату</label>
                </div>
            </div>

            {/* Account */}
            <div>
                 <label className="block text-xs font-bold text-slate-500 mb-1.5">Счет и юрлицо</label>
                 <select
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                    required
                >
                    {accounts.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                </select>
            </div>

            {/* Amount */}
            <div>
                 <label className="block text-xs font-bold text-slate-500 mb-1.5">Сумма</label>
                 <div className="relative">
                    <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="w-full px-4 py-2.5 pr-8 bg-white text-slate-900 border border-slate-300 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                        placeholder="0.00"
                        required
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">₽</div>
                 </div>
            </div>

             {/* Contractor (Income/Expense) or To Account (Transfer) */}
             {type === 'transfer' ? (
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5">На какой счет</label>
                    <select
                        value={toAccountId}
                        onChange={(e) => setToAccountId(e.target.value)}
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                        required
                    >
                        <option value="">Выберите счет</option>
                        {accounts.filter(a => a.id !== accountId).map(a => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                        ))}
                    </select>
                </div>
             ) : (
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5">Контрагент</label>
                    <select
                        value={contractorId}
                        onChange={(e) => setContractorId(e.target.value)}
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                    >
                        <option value="">Не выбран</option>
                        {contractors.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                </div>
             )}

            {/* Category & Project (Hidden for Transfer) */}
            {type !== 'transfer' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1.5">Статья</label>
                        <select
                            value={categoryId}
                            onChange={(e) => setCategoryId(e.target.value)}
                            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                            required
                        >
                            <option value="">Выберите статью</option>
                            {filteredCategories.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1.5">Проект</label>
                        <select
                            value={projectId}
                            onChange={(e) => setProjectId(e.target.value)}
                            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                        >
                            <option value="">Не выбран</option>
                            {projects.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
            )}
             
            {/* Studio */}
             <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">Студия</label>
                <select
                    value={studioId}
                    onChange={(e) => setStudioId(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                >
                    <option value="">Не выбрано</option>
                    {studios.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                </select>
            </div>


            {/* Description */}
            <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">Назначение платежа</label>
                <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all resize-none"
                rows={3}
                placeholder="Комментарий..."
                />
            </div>

            <div className="pt-6 flex flex-col sm:flex-row justify-between items-center gap-4 border-t border-slate-100 mt-8">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                     <input 
                       type="checkbox" 
                       className="rounded bg-white border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer" 
                       id="createMore" 
                     />
                     <label htmlFor="createMore" className="cursor-pointer">Создать еще одну операцию</label>
                </div>
                <div className="flex gap-3 w-full sm:w-auto">
                    <Button type="button" variant="ghost" onClick={onClose} className="flex-1 sm:flex-none text-slate-500 hover:text-slate-700">Отменить</Button>
                    <Button type="submit" className="flex-1 sm:flex-none bg-teal-600 hover:bg-teal-700 text-white shadow-lg shadow-teal-600/20">{initialData ? 'Сохранить' : 'Создать'}</Button>
                </div>
            </div>
        </form>
    </div>
  );
};