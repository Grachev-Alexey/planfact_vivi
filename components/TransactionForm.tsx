import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useFinance } from '../context/FinanceContext';
import { useAuth } from '../context/AuthContext';
import { Transaction, TransactionType } from '../types';
import { Button } from './ui/Button';
import { DatePicker } from './ui/DatePicker';
import { ChevronDown, ChevronRight, Search, Plus, X, Check } from 'lucide-react';

interface SearchableSelectProps {
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
  options: { id: string; label: string; sublabel?: string; indent?: boolean }[];
  required?: boolean;
  onCreateNew?: () => void;
  createLabel?: string;
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({ value, onChange, placeholder, options, required, onCreateNew, createLabel }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });

  const updatePos = useCallback(() => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const dropdownH = 300;
      const top = spaceBelow > dropdownH ? rect.bottom + 2 : rect.top - dropdownH - 2;
      setPos({ top: Math.max(4, top), left: rect.left, width: rect.width });
    }
  }, []);

  useEffect(() => {
    if (open) {
      updatePos();
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open, updatePos]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (ref.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return options;
    const q = search.toLowerCase();
    return options.filter(o => o.label.toLowerCase().includes(q) || (o.sublabel && o.sublabel.toLowerCase().includes(q)));
  }, [options, search]);

  const selectedOpt = options.find(o => o.id === value);
  const selectedLabel = selectedOpt?.label || '';
  const selectedSublabel = selectedOpt?.sublabel || '';

  const dropdown = (
    <div
      ref={dropdownRef}
      className="fixed z-[100] bg-white border border-slate-200 rounded-lg shadow-2xl max-h-[280px] flex flex-col"
      style={{ top: pos.top, left: pos.left, width: pos.width }}
    >
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

        {filtered.map(opt => (
          <button
            key={opt.id}
            type="button"
            onClick={() => { onChange(opt.id); setOpen(false); }}
            className={`w-full text-left hover:bg-slate-50 flex items-center gap-2 transition-colors ${
              opt.indent ? 'pl-8 pr-3 py-1.5 text-slate-500' : 'px-3 py-2 text-slate-700'
            } ${value === opt.id ? 'bg-teal-50 text-teal-700' : ''}`}
          >
            {value === opt.id && <Check size={13} className="text-teal-600 shrink-0" />}
            <span className="min-w-0">
              <span className={`text-sm block ${!opt.indent ? 'font-medium' : ''}`}>{opt.label}</span>
              {opt.sublabel && <span className="text-xs text-slate-400 block">{opt.sublabel}</span>}
            </span>
          </button>
        ))}

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
  );

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => { setOpen(!open); setSearch(''); }}
        className={`w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm bg-white text-left focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all flex items-center justify-between ${value ? 'text-slate-900' : 'text-slate-400'}`}
      >
        <span className="truncate min-w-0">
          {selectedLabel || placeholder}
          {selectedSublabel && <span className="text-xs text-slate-400 ml-1.5">{selectedSublabel}</span>}
        </span>
        <ChevronDown size={14} className={`text-slate-400 shrink-0 ml-2 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && createPortal(dropdown, document.body)}
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

const FormRow: React.FC<{ label: string; children: React.ReactNode; className?: string }> = ({ label, children, className = '' }) => (
  <div className={`grid grid-cols-[140px_1fr] items-start gap-3 ${className}`}>
    <label className="text-sm font-medium text-slate-600 pt-2.5 text-right">{label}</label>
    <div>{children}</div>
  </div>
);

interface TransactionFormProps {
  onClose: () => void;
  initialData?: Transaction;
}

export const TransactionForm: React.FC<TransactionFormProps> = ({ onClose, initialData }) => {
  const { categories, accounts, studios, contractors, legalEntities, addTransaction, updateTransaction, refreshData, deleteTransaction } = useFinance();
  
  const [type, setType] = useState<TransactionType>('income');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [categoryId, setCategoryId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [studioId, setStudioId] = useState('');
  const [contractorId, setContractorId] = useState('');
  const [description, setDescription] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [accrualDate, setAccrualDate] = useState('');
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
      setConfirmed(initialData.confirmed || false);
      setAccrualDate(initialData.accrualDate ? initialData.accrualDate.split('T')[0] : '');
    } else {
      if (accounts.length > 0 && !accountId) setAccountId(accounts[0].id);
      if (studios.length > 0 && !studioId) setStudioId(studios[0].id);
    }
  }, [initialData, accounts, studios]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !accountId || !date) return;
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
      confirmed,
      accrualDate: accrualDate || undefined,
    };

    if (initialData) {
      updateTransaction(initialData.id, payload);
    } else {
      addTransaction(payload);
    }
    onClose();
  };

  const handleDelete = async () => {
    if (initialData) {
      await deleteTransaction(initialData.id);
      onClose();
    }
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

  const accountOptions = useMemo(() => accounts.map(a => {
    const le = legalEntities.find(l => l.id === a.legalEntityId);
    return { id: a.id, label: a.name, sublabel: le ? le.name : undefined };
  }), [accounts, legalEntities]);
  const toAccountOptions = useMemo(() => accounts.filter(a => a.id !== accountId).map(a => {
    const le = legalEntities.find(l => l.id === a.legalEntityId);
    return { id: a.id, label: a.name, sublabel: le ? le.name : undefined };
  }), [accounts, accountId, legalEntities]);
  const studioOptions = useMemo(() => studios.map(s => ({ id: s.id, label: s.name })), [studios]);

  const handleContractorCreated = async (id: string) => {
    setShowNewContractor(false);
    setContractorId(id);
    await refreshData();
  };

  const tabClass = (t: TransactionType, activeColor: string) =>
    `px-5 py-2.5 text-sm font-medium transition-all whitespace-nowrap rounded-t-lg ${
      type === t
        ? `${activeColor} text-white`
        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
    }`;

  return (
    <div className="flex flex-col h-full">
      <div className="flex gap-1 mb-6 border-b border-slate-200">
        <button type="button" onClick={() => setType('income')} className={tabClass('income', 'bg-emerald-500')}>
          Поступление
        </button>
        <button type="button" onClick={() => setType('expense')} className={tabClass('expense', 'bg-teal-600')}>
          Выплата
        </button>
        <button type="button" onClick={() => setType('transfer')} className={tabClass('transfer', 'bg-blue-500')}>
          Перемещение
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 flex-1">
        <FormRow label="Дата оплаты">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <DatePicker value={date} onChange={setDate} required />
            </div>
            {type !== 'transfer' && (
              <label className="flex items-center gap-2 cursor-pointer select-none whitespace-nowrap">
                <div className="relative flex items-center">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(e) => setConfirmed(e.target.checked)}
                    className="peer h-4.5 w-4.5 cursor-pointer appearance-none rounded border border-slate-300 bg-white checked:bg-teal-600 checked:border-teal-600 transition-all"
                    style={{ width: '18px', height: '18px' }}
                  />
                  <svg className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 text-white pointer-events-none opacity-0 peer-checked:opacity-100" viewBox="0 0 14 14" fill="none">
                    <path d="M11.6666 3.5L5.24992 9.91667L2.33325 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <span className="text-sm text-slate-600">
                  {type === 'income' ? 'Подтвердить доход' : 'Подтвердить оплату'}
                </span>
              </label>
            )}
          </div>
        </FormRow>

        <FormRow label="Счет">
          <SearchableSelect
            value={accountId}
            onChange={setAccountId}
            placeholder="Выберите счет"
            options={accountOptions}
            required
          />
        </FormRow>

        {type === 'transfer' && (
          <FormRow label="На счет">
            <SearchableSelect
              value={toAccountId}
              onChange={setToAccountId}
              placeholder="Выберите счет"
              options={toAccountOptions}
              required
            />
          </FormRow>
        )}

        <FormRow label="Сумма">
          <div className="relative">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3 py-2.5 pr-16 bg-white text-slate-900 border border-slate-300 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
              placeholder="0"
              required
              step="0.01"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">RUB (Российский рубль)</div>
          </div>
        </FormRow>

        {type === 'expense' && (
          <FormRow label="Дата начисления">
            <DatePicker value={accrualDate} onChange={setAccrualDate} placeholder="дд.мм.гггг" />
          </FormRow>
        )}

        {type !== 'transfer' && (
          <>
            <FormRow label="Контрагент">
              <SearchableSelect
                value={contractorId}
                onChange={setContractorId}
                placeholder="Не выбран"
                options={contractorOptions}
                onCreateNew={() => setShowNewContractor(true)}
                createLabel="Создать контрагента"
              />
            </FormRow>

            <FormRow label="Статья">
              <SearchableSelect
                value={categoryId}
                onChange={setCategoryId}
                placeholder="Выберите статью"
                options={categoryOptions}
                required
              />
            </FormRow>
          </>
        )}

        <FormRow label="Студия">
          <SearchableSelect
            value={studioId}
            onChange={setStudioId}
            placeholder="Не выбрано"
            options={studioOptions}
          />
        </FormRow>

        <FormRow label="Назначение платежа">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all resize-y min-h-[60px]"
            rows={2}
            placeholder="Комментарий..."
          />
        </FormRow>

        <div className="pt-4 flex items-center justify-between border-t border-slate-100">
          <div>
            {initialData && (
              <button
                type="button"
                onClick={handleDelete}
                className="px-4 py-2 text-sm bg-rose-500 hover:bg-rose-600 text-white rounded-lg font-medium transition-colors"
              >
                Удалить
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-teal-600 hover:bg-teal-50 rounded-lg font-medium transition-colors">
              Отменить
            </button>
            <Button type="submit" className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-2 rounded-lg text-sm font-medium shadow-sm">
              {initialData ? 'Сохранить' : 'Создать'}
            </Button>
          </div>
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
