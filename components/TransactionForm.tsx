import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useFinance } from '../context/FinanceContext';
import { useAuth } from '../context/AuthContext';
import { Transaction, TransactionType } from '../types';
import { Button } from './ui/Button';
import { DatePicker } from './ui/DatePicker';
import { ChevronDown, ChevronRight, Search, Plus, X, Check, RefreshCw, CheckCircle2, AlertTriangle, XCircle, ExternalLink } from 'lucide-react';
import { formatCurrency, formatDate } from '../utils/format';

interface SearchableSelectProps {
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
  options: { id: string; label: string; sublabel?: string; indent?: boolean; disabled?: boolean }[];
  required?: boolean;
  onCreateNew?: () => void;
  createLabel?: string;
}

function positionDropdown(triggerEl: HTMLElement, ddEl: HTMLDivElement) {
  const rect = triggerEl.getBoundingClientRect();
  const ddHeight = ddEl.offsetHeight || 280;
  const spaceBelow = window.innerHeight - rect.bottom;
  const top = spaceBelow > ddHeight + 4 ? rect.bottom + 2 : rect.top - ddHeight - 2;
  ddEl.style.top = `${Math.max(4, top)}px`;
  ddEl.style.left = `${rect.left}px`;
  ddEl.style.width = `${rect.width}px`;
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({ value, onChange, placeholder, options, required, onCreateNew, createLabel }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleOpen = () => {
    if (open) { setOpen(false); return; }
    setOpen(true);
    setSearch('');
    setTimeout(() => inputRef.current?.focus(), 10);
  };

  useEffect(() => {
    if (!open || !ref.current || !dropdownRef.current) return;
    const trigger = ref.current;
    const dd = dropdownRef.current;
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        positionDropdown(trigger, dd);
      });
    });
    const update = () => positionDropdown(trigger, dd);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open]);

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

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={handleOpen}
        className={`w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm bg-white text-left focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all flex items-center justify-between overflow-hidden ${value ? 'text-slate-900' : 'text-slate-400'}`}
      >
        <span className="truncate min-w-0 block">
          {selectedLabel || placeholder}
          {selectedSublabel && <span className="text-xs text-slate-400 ml-1.5">{selectedSublabel}</span>}
        </span>
        <ChevronDown size={14} className={`text-slate-400 shrink-0 ml-2 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && createPortal(
        <div
          ref={dropdownRef}
          className="fixed z-[100] bg-white border border-slate-200 rounded-lg shadow-2xl max-h-[280px] flex flex-col"
          style={{ top: -9999, left: -9999 }}
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

            {filtered.map(opt => opt.disabled ? (
              <div
                key={opt.id}
                className="w-full text-left px-3 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wide cursor-default select-none"
              >
                {opt.label}
              </div>
            ) : (
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
        </div>,
        document.body
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

const FormRow: React.FC<{ label: string; children: React.ReactNode; className?: string }> = ({ label, children, className = '' }) => (
  <div className={`grid grid-cols-[140px_1fr] items-start gap-3 ${className}`}>
    <label className="text-sm font-medium text-slate-600 pt-2.5 text-right">{label}</label>
    <div className="min-w-0">{children}</div>
  </div>
);

const SIGNAL_LABELS: Record<string, string> = {
  contractor_phone: 'Телефон контрагента совпадает',
  name_exact: 'Имя клиента совпадает',
  name_partial: 'Имя клиента похоже',
  phone: 'Телефон совпадает',
  amount_exact: 'Сумма совпадает с визитом',
  amount_subset: 'Сумма совпадает с частью услуг',
  goods_exact: 'Сумма совпадает с товаром',
  amount_close: 'Сумма примерно совпадает',
};

const YClientsSection: React.FC<{ transaction: Transaction }> = ({ transaction }) => {
  const [status, setStatus] = useState(transaction.yclientsStatus || null);
  const [data, setData] = useState<any>(() => {
    try { return transaction.yclientsData ? JSON.parse(transaction.yclientsData) : null; } catch { return null; }
  });
  const [checkedAt, setCheckedAt] = useState(transaction.yclientsCheckedAt || null);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const handleVerify = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/yclients/verify/${transaction.id}`, {
        method: 'POST',
        headers: { 'x-user-id': String(user?.id || '') },
      });
      const result = await res.json();
      setStatus(result.status);
      setData(result.data || null);
      setCheckedAt(result.checkedAt || new Date().toISOString());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const statusConfig: Record<string, { icon: React.ReactNode; label: string; color: string; bg: string }> = {
    match: { icon: <CheckCircle2 size={16} />, label: 'Совпадение найдено', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
    weak_match: { icon: <CheckCircle2 size={16} />, label: 'Сумма совпадает (клиент не подтверждён)', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
    amount_mismatch: { icon: <AlertTriangle size={16} />, label: 'Клиент найден, сумма отличается', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
    not_found: { icon: <XCircle size={16} />, label: 'Не найдено в YClients', color: 'text-rose-700', bg: 'bg-rose-50 border-rose-200' },
    no_studio: { icon: <XCircle size={16} />, label: 'Студия не привязана к YClients', color: 'text-slate-500', bg: 'bg-slate-50 border-slate-200' },
    error: { icon: <XCircle size={16} />, label: 'Ошибка проверки', color: 'text-rose-700', bg: 'bg-rose-50 border-rose-200' },
  };

  const cfg = status ? statusConfig[status] : null;

  return (
    <div className="border-t border-slate-200 pt-4 mt-2">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">YClients</span>
        <button
          type="button"
          onClick={handleVerify}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          {status ? 'Проверить ещё раз' : 'Проверить'}
        </button>
      </div>

      {cfg ? (
        <div className={`rounded-lg border p-3 ${cfg.bg}`}>
          <div className={`flex items-center gap-2 ${cfg.color} font-medium text-sm`}>
            {cfg.icon}
            {cfg.label}
          </div>
          {data && (
            <div className="mt-2 space-y-1.5 text-xs text-slate-600">
              {data.clientName && (
                <div><span className="text-slate-400">Клиент:</span> {data.clientName}{data.clientPhone ? ` (${data.clientPhone})` : ''}</div>
              )}
              {data.services && (
                <div><span className="text-slate-400">Все услуги/товары визита:</span> {data.services}</div>
              )}
              {data.matchedServices && (
                <div><span className="text-slate-400">Совпавшие позиции:</span> <span className="text-emerald-700 font-medium">{data.matchedServices}</span></div>
              )}
              {data.recAmount !== undefined && (
                <div>
                  <span className="text-slate-400">Итого визит:</span>{' '}
                  <span className={data.diff > 0.01 ? 'font-semibold text-amber-700' : 'text-emerald-700'}>{formatCurrency(data.recAmount)}</span>
                  {data.diff > 0.01 && <span className="text-amber-600 ml-1">(разница: {formatCurrency(data.diff)})</span>}
                </div>
              )}
              {data.signals && data.signals.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {data.signals.map((s: string) => (
                    <span key={s} className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      s.startsWith('name_') || s === 'phone' || s === 'contractor_phone' ? 'bg-blue-100 text-blue-700' : s === 'goods_exact' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {SIGNAL_LABELS[s] || s}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
          {checkedAt && (
            <div className="mt-2 text-[10px] text-slate-400">Проверено: {formatDate(checkedAt)}</div>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-400 text-center">
          Нажмите «Проверить» для сверки с YClients
        </div>
      )}
    </div>
  );
};

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
  const [txStatus, setTxStatus] = useState<string>('pending');
  const [accrualDate, setAccrualDate] = useState('');
  const [creditDate, setCreditDate] = useState('');
  const [creditDateAuto, setCreditDateAuto] = useState(false);
  const [showNewContractor, setShowNewContractor] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
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
      // Initialize status: for expense use status field or derive from confirmed/prStatus
      if (initialData.type === 'expense') {
        if (initialData.confirmed) {
          setTxStatus('verified');
        } else if (initialData.externalId?.startsWith('pr-')) {
          setTxStatus(initialData.prStatus || 'pending');
        } else {
          setTxStatus(initialData.status || 'pending');
        }
      }
      setAccrualDate(initialData.accrualDate ? initialData.accrualDate.split('T')[0] : '');
      setCreditDate(initialData.creditDate ? initialData.creditDate.split('T')[0] : '');
      if (initialData.creditDate) setCreditDateAuto(false);
      initialized.current = true;
    } else if (accounts.length > 0 || studios.length > 0) {
      if (accounts.length > 0) setAccountId(accounts[0].id);
      if (studios.length > 0) setStudioId(studios[0].id);
      initialized.current = true;
    }
  }, [initialData, accounts, studios]);

  useEffect(() => {
    if (type !== 'income' || !accountId || !date || !initialized.current) return;
    if (!creditDateAuto && creditDate) return;
    const controller = new AbortController();
    fetch('/api/credit-date-rules/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId, date }),
      signal: controller.signal,
    })
      .then(r => r.json())
      .then(data => {
        if (data.creditDate) {
          setCreditDate(data.creditDate);
          setCreditDateAuto(true);
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, [type, accountId, date]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validationErrors: string[] = [];
    if (!date) validationErrors.push('Укажите дату операции');
    if (!accountId) validationErrors.push('Выберите счёт');
    if (!amount || parseFloat(amount) <= 0) validationErrors.push('Укажите сумму больше нуля');
    if (type !== 'transfer' && !categoryId) validationErrors.push('Выберите статью');
    if (type === 'transfer' && !toAccountId) validationErrors.push('Выберите счёт назначения для перемещения');
    if (type === 'transfer' && toAccountId === accountId) validationErrors.push('Счёт списания и зачисления не могут совпадать');
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }
    setErrors([]);

    const payload: Record<string, unknown> = {
      date,
      amount: parseFloat(amount),
      type,
      categoryId: type === 'transfer' ? undefined : categoryId,
      accountId,
      toAccountId: type === 'transfer' ? toAccountId : undefined,
      studioId: studioId || undefined,
      contractorId: type === 'transfer' ? undefined : (contractorId || undefined),
      description,
      accrualDate: accrualDate || undefined,
    };
    if (type === 'income') {
      payload.creditDate = creditDate || undefined;
    }
    if (type === 'expense') {
      payload.status = txStatus;
      payload.confirmed = txStatus === 'verified';
    } else if (type === 'transfer') {
      payload.confirmed = true;
    } else {
      payload.confirmed = confirmed;
    }

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
    const hasChildren = (catId: string) => filtered.some(c => c.parentId === catId);
    const result: { id: string; label: string; indent?: boolean; disabled?: boolean }[] = [];

    const addChildren = (parentId: string | null, depth: number) => {
      const items = filtered.filter(c => depth === 0 ? !c.parentId : c.parentId === parentId);
      items.forEach(item => {
        const isParent = hasChildren(item.id);
        result.push({
          id: item.id,
          label: (depth > 0 ? '\u00A0\u00A0'.repeat(depth) : '') + item.name,
          indent: depth > 0 && !isParent,
          disabled: isParent,
        });
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

  const formId = 'transaction-form';

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div className="flex gap-1 mb-4 border-b border-slate-200 shrink-0">
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

      <form id={formId} onSubmit={handleSubmit} className="space-y-4 flex-1 overflow-y-auto min-h-0">
        <FormRow label="Дата оплаты">
          <DatePicker value={date} onChange={setDate} required />
        </FormRow>

        {type === 'expense' && (
          <FormRow label="Статус">
            <div className="flex rounded-xl overflow-hidden border border-slate-200 w-full">
              {([
                { id: 'pending',  label: 'Ожидает',    active: 'bg-amber-50 text-amber-700 border-amber-200'   },
                { id: 'approved', label: 'Утверждено',  active: 'bg-sky-50 text-sky-700 border-sky-200'         },
                { id: 'paid',     label: 'Оплачено',    active: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
                { id: 'verified', label: 'Проверено',   active: 'bg-teal-50 text-teal-700 border-teal-200'     },
              ] as const).map((opt, i, arr) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setTxStatus(opt.id)}
                  className={`flex-1 py-2 text-xs font-medium transition-colors ${i < arr.length - 1 ? 'border-r border-slate-200' : ''} ${txStatus === opt.id ? opt.active : 'bg-white text-slate-400 hover:bg-slate-50 hover:text-slate-600'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </FormRow>
        )}

        {type === 'income' && (
          <FormRow label="Статус">
            <div className="flex rounded-xl overflow-hidden border border-slate-200 w-full">
              {([
                { id: false, label: 'Не подтверждено', active: 'bg-amber-50 text-amber-700 border-amber-200' },
                { id: true,  label: 'Подтверждено',    active: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
              ] as const).map((opt, i, arr) => (
                <button
                  key={String(opt.id)}
                  type="button"
                  onClick={() => setConfirmed(opt.id)}
                  className={`flex-1 py-2 text-xs font-medium transition-colors ${i < arr.length - 1 ? 'border-r border-slate-200' : ''} ${confirmed === opt.id ? opt.active : 'bg-white text-slate-400 hover:bg-slate-50 hover:text-slate-600'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </FormRow>
        )}


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
              onWheel={(e) => (e.target as HTMLInputElement).blur()}
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

        {type === 'income' && (
          <FormRow label="Дата зачисления">
            <DatePicker value={creditDate} onChange={(v: string) => { setCreditDate(v); setCreditDateAuto(false); }} placeholder="дд.мм.гггг" />
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

        {initialData && type === 'income' && (
          <YClientsSection transaction={initialData} />
        )}

        {errors.length > 0 && (
          <div className="bg-rose-50 border border-rose-200 rounded-lg px-4 py-3">
            {errors.map((err, i) => (
              <div key={i} className="text-sm text-rose-600 flex items-start gap-2">
                <span className="text-rose-400 mt-0.5 shrink-0">•</span>
                <span>{err}</span>
              </div>
            ))}
          </div>
        )}

      </form>

      <div className="pt-4 pb-1 flex items-center justify-between border-t border-slate-100 shrink-0">
        <div className="flex items-center gap-2">
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
        <div className="flex items-center gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-teal-600 hover:bg-teal-50 rounded-lg font-medium transition-colors">
            Отменить
          </button>
          <Button type="submit" form={formId} className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-2 rounded-lg text-sm font-medium shadow-sm">
            {initialData ? 'Сохранить' : 'Создать'}
          </Button>
        </div>
      </div>

      {showNewContractor && (
        <NewContractorModal
          onClose={() => setShowNewContractor(false)}
          onCreated={handleContractorCreated}
        />
      )}
    </div>
  );
};
