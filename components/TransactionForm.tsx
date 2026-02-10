import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useFinance } from '../context/FinanceContext';
import { useAuth } from '../context/AuthContext';
import { Transaction, TransactionType } from '../types';
import { Button } from './ui/Button';
import { ChevronDown, ChevronRight, Search, Plus, X, Check } from 'lucide-react';

interface SearchableSelectProps {
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
  options: { id: string; label: string; indent?: boolean }[];
  required?: boolean;
  onCreateNew?: () => void;
  createLabel?: string;
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({ value, onChange, placeholder, options, required, onCreateNew, createLabel }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  const filtered = useMemo(() => {
    if (!search.trim()) return options;
    const q = search.toLowerCase();
    return options.filter(o => o.label.toLowerCase().includes(q));
  }, [options, search]);

  const selectedLabel = options.find(o => o.id === value)?.label || '';

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => { setOpen(!open); setSearch(''); }}
        className={`w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm bg-white text-left focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all flex items-center justify-between ${value ? 'text-slate-900' : 'text-slate-400'}`}
      >
        <span className="truncate">{selectedLabel || placeholder}</span>
        <ChevronDown size={14} className={`text-slate-400 shrink-0 ml-2 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-xl max-h-[280px] flex flex-col">
          <div className="p-2 border-b border-slate-100 shrink-0">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-teal-500"
                placeholder="Поиск..."
              />
            </div>
          </div>

          <div className="overflow-y-auto flex-1">
            {!required && (
              <button
                type="button"
                onClick={() => { onChange(''); setOpen(false); }}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-50 text-slate-400 ${!value ? 'bg-teal-50 text-teal-600' : ''}`}
              >
                {placeholder}
              </button>
            )}

            {filtered.map(opt => {
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => { onChange(opt.id); setOpen(false); }}
                  className={`w-full text-left text-sm hover:bg-slate-50 flex items-center gap-2 transition-colors ${
                    opt.indent ? 'pl-8 pr-3 py-1.5 text-slate-500' : 'px-3 py-2 text-slate-700 font-medium'
                  } ${value === opt.id ? 'bg-teal-50 text-teal-700' : ''}`}
                >
                  {value === opt.id && <Check size={13} className="text-teal-600 shrink-0" />}
                  <span className="truncate">{opt.label}</span>
                </button>
              );
            })}

            {filtered.length === 0 && (
              <div className="px-3 py-4 text-center text-sm text-slate-400">Ничего не найдено</div>
            )}
          </div>

          {onCreateNew && (
            <button
              type="button"
              onClick={() => { setOpen(false); onCreateNew(); }}
              className="w-full px-3 py-2.5 text-left text-sm text-teal-600 hover:bg-teal-50 border-t border-slate-100 flex items-center gap-2 font-medium shrink-0"
            >
              <Plus size={14} />
              {createLabel || 'Создать новый'}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

interface NewContractorModalProps {
  onClose: () => void;
  onCreated: (id: string) => void;
}

const NewContractorModal: React.FC<NewContractorModalProps> = ({ onClose, onCreated }) => {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [inn, setInn] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/contractors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': user?.id?.toString() || '' },
        body: JSON.stringify({ name: name.trim(), inn: inn.trim() || undefined }),
      });
      if (res.ok) {
        const data = await res.json();
        onCreated(data.id);
      }
    } catch (e) {
      console.error('Error creating contractor', e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-slate-800">Новый контрагент</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Название *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="ООО Компания"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">ИНН</label>
            <input
              type="text"
              value={inn}
              onChange={e => setInn(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="1234567890"
            />
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button type="button" onClick={onClose} className="flex-1 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Отмена</button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!name.trim() || saving}
            className="flex-1 px-3 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
          >
            {saving ? 'Сохраняю...' : 'Создать'}
          </button>
        </div>
      </div>
    </div>
  );
};

interface TransactionFormProps {
  onClose: () => void;
  initialData?: Transaction;
}

export const TransactionForm: React.FC<TransactionFormProps> = ({ onClose, initialData }) => {
  const { categories, accounts, studios, contractors, addTransaction, updateTransaction, refreshData } = useFinance();
  
  const [type, setType] = useState<TransactionType>('income');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [categoryId, setCategoryId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [studioId, setStudioId] = useState('');
  const [contractorId, setContractorId] = useState('');
  const [description, setDescription] = useState('');
  const [showNewContractor, setShowNewContractor] = useState(false);

  useEffect(() => {
    if (initialData) {
      setType(initialData.type);
      setAmount(initialData.amount.toString());
      setDate(initialData.date.split('T')[0]);
      setCategoryId(initialData.categoryId || '');
      setAccountId(initialData.accountId);
      setToAccountId(initialData.toAccountId || '');
      setStudioId(initialData.studioId || '');
      setContractorId(initialData.contractorId || '');
      setDescription(initialData.description || '');
    } else {
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
      description,
    };

    if (initialData) {
      updateTransaction(initialData.id, payload);
    } else {
      addTransaction(payload);
    }
    onClose();
  };

  const categoryOptions = useMemo(() => {
    const filtered = categories.filter(c => c.type === type);
    const result: { id: string; label: string; indent?: boolean }[] = [];

    const addChildren = (parentId: string | null, depth: number) => {
      const items = filtered.filter(c => depth === 0 ? !c.parentId : c.parentId === parentId);
      items.forEach(item => {
        result.push({ id: item.id, label: (depth > 0 ? '\u00A0\u00A0'.repeat(depth) : '') + item.name, indent: depth > 0 });
        addChildren(item.id, depth + 1);
      });
    };

    addChildren(null, 0);
    return result;
  }, [categories, type]);

  const contractorOptions = useMemo(() => {
    return contractors.map(c => ({
      id: c.id,
      label: c.name + (c.inn ? ` (ИНН: ${c.inn})` : ''),
    }));
  }, [contractors]);

  const accountOptions = useMemo(() => accounts.map(a => ({ id: a.id, label: a.name })), [accounts]);
  const toAccountOptions = useMemo(() => accounts.filter(a => a.id !== accountId).map(a => ({ id: a.id, label: a.name })), [accounts, accountId]);
  const studioOptions = useMemo(() => studios.map(s => ({ id: s.id, label: s.name })), [studios]);

  const handleContractorCreated = async (id: string) => {
    setShowNewContractor(false);
    setContractorId(id);
    await refreshData();
  };

  return (
    <div className="flex flex-col h-full">
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

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 items-end">
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
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1.5">Счет</label>
          <SearchableSelect
            value={accountId}
            onChange={setAccountId}
            placeholder="Выберите счет"
            options={accountOptions}
            required
          />
        </div>

        {type === 'transfer' ? (
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1.5">На какой счет</label>
            <SearchableSelect
              value={toAccountId}
              onChange={setToAccountId}
              placeholder="Выберите счет"
              options={toAccountOptions}
              required
            />
          </div>
        ) : (
          <>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">Статья</label>
              <SearchableSelect
                value={categoryId}
                onChange={setCategoryId}
                placeholder="Выберите статью"
                options={categoryOptions}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">Контрагент</label>
              <SearchableSelect
                value={contractorId}
                onChange={setContractorId}
                placeholder="Не выбран"
                options={contractorOptions}
                onCreateNew={() => setShowNewContractor(true)}
                createLabel="Создать контрагента"
              />
            </div>
          </>
        )}

        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1.5">Студия</label>
          <SearchableSelect
            value={studioId}
            onChange={setStudioId}
            placeholder="Не выбрано"
            options={studioOptions}
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1.5">Назначение платежа</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-4 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all resize-none"
            rows={2}
            placeholder="Комментарий..."
          />
        </div>

        <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
          <Button type="button" variant="ghost" onClick={onClose} className="text-slate-500 hover:text-slate-700">Отменить</Button>
          <Button type="submit" className="bg-teal-600 hover:bg-teal-700 text-white shadow-lg shadow-teal-600/20">{initialData ? 'Сохранить' : 'Создать'}</Button>
        </div>
      </form>

      {showNewContractor && (
        <NewContractorModal
          onClose={() => setShowNewContractor(false)}
          onCreated={handleContractorCreated}
        />
      )}
    </div>
  );
};
