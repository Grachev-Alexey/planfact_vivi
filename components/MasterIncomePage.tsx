import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext';
import { useFinance } from '../context/FinanceContext';
import { LogOut, Send, Search, ChevronDown, Check, Plus, Clock, ChevronLeft, ChevronRight, User, Phone, Edit2, Trash2, X } from 'lucide-react';
import { formatCurrency, formatDate } from '../utils/format';
import { Category } from '../types';

interface MasterIncome {
  id: number;
  amount: number;
  paymentType: string;
  categoryId: number | null;
  categoryName: string | null;
  studioName: string | null;
  clientName: string;
  clientPhone: string;
  description: string;
  createdAt: string;
}

interface SearchableSelectProps {
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
  options: { id: string; label: string; sublabel?: string; indent?: boolean; disabled?: boolean }[];
  required?: boolean;
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

const SearchableSelect: React.FC<SearchableSelectProps> = ({ value, onChange, placeholder, options, required }) => {
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
      requestAnimationFrame(() => positionDropdown(trigger, dd));
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
      if (ref.current?.contains(e.target as Node)) return;
      if (dropdownRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return options;
    const q = search.toLowerCase();
    return options.filter(o => o.label.toLowerCase().includes(q));
  }, [options, search]);

  const selectedOpt = options.find(o => o.id === value);
  const selectedLabel = selectedOpt?.label || '';

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={handleOpen}
        className={`w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm bg-white text-left focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all flex items-center justify-between overflow-hidden ${value ? 'text-slate-900' : 'text-slate-400'}`}
      >
        <span className="truncate min-w-0 block">{selectedLabel || placeholder}</span>
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
                </span>
              </button>
            ))}

            {filtered.length === 0 && (
              <div className="px-3 py-4 text-center text-sm text-slate-400">Ничего не найдено</div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

const PAYMENT_TYPES = [
  { id: 'cash', label: 'Наличные' },
  { id: 'card', label: 'Карта' },
  { id: 'sbp', label: 'СБП' },
  { id: 'ukassa', label: 'Ю-Касса' },
];

export const MasterIncomePage: React.FC = () => {
  const { user, logout } = useAuth();
  const { categories } = useFinance();

  const [incomes, setIncomes] = useState<MasterIncome[]>([]);
  const [loading, setLoading] = useState(false);

  const [amount, setAmount] = useState('');
  const [paymentType, setPaymentType] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [successMsg, setSuccessMsg] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);

  const fetchIncomes = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/master-incomes`, {
        headers: { 'x-user-id': String(user.id) },
      });
      if (res.ok) {
        setIncomes(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchIncomes();
  }, [fetchIncomes]);

  const categoryOptions = useMemo(() => {
    const filtered = categories.filter(c => c.type === 'income');
    const hasChildren = (catId: string) => filtered.some(c => c.parentId === catId);
    const result: { id: string; label: string; indent?: boolean; disabled?: boolean }[] = [];
    const addChildren = (parentId: string | null, depth: number) => {
      const items = filtered.filter(c => depth === 0 ? !c.parentId : c.parentId === parentId);
      items.forEach(item => {
        const isParent = hasChildren(item.id);
        result.push({
          id: item.id,
          label: '\u00A0\u00A0'.repeat(depth) + item.name,
          indent: depth > 0 && !isParent,
          disabled: isParent,
        });
        addChildren(item.id, depth + 1);
      });
    };
    addChildren(null, 0);
    return result;
  }, [categories]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: string[] = [];
    if (!amount || parseFloat(amount) <= 0) errs.push('Введите сумму');
    if (!paymentType) errs.push('Выберите тип оплаты');
    if (errs.length > 0) { setErrors(errs); return; }
    setErrors([]);
    setSubmitting(true);

    try {
      const url = editingId ? `/api/master-incomes/${editingId}` : '/api/master-incomes';
      const method = editingId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': String(user?.id || ''),
        },
        body: JSON.stringify({
          amount: parseFloat(amount),
          paymentType,
          categoryId: categoryId || null,
          clientName,
          clientPhone,
          description,
        }),
      });

      if (res.ok) {
        setAmount('');
        setPaymentType('');
        setCategoryId('');
        setClientName('');
        setClientPhone('');
        setDescription('');
        setEditingId(null);
        setSuccessMsg(editingId ? 'Запись обновлена' : 'Поступление записано');
        setTimeout(() => setSuccessMsg(''), 3000);
        fetchIncomes();
      } else {
        const data = await res.json().catch(() => null);
        setErrors([data?.error || 'Ошибка сохранения']);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (inc: MasterIncome) => {
    setEditingId(inc.id);
    setAmount(String(inc.amount));
    setPaymentType(inc.paymentType);
    setCategoryId(String(inc.categoryId || ''));
    setClientName(inc.clientName || '');
    setClientPhone(inc.clientPhone || '');
    setDescription(inc.description || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Удалить эту запись?')) return;
    try {
      const res = await fetch(`/api/master-incomes/${id}`, {
        method: 'DELETE',
        headers: { 'x-user-id': String(user?.id || '') },
      });
      if (res.ok) {
        fetchIncomes();
      } else {
        const data = await res.json().catch(() => null);
        alert(data?.error || 'Ошибка удаления');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const isToday = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    return d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">V</span>
            </div>
            <span className="font-bold text-slate-800 text-sm sm:text-base">ViVi</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-teal-50 flex items-center justify-center text-teal-600 font-bold text-xs">
                {user?.username?.[0]?.toUpperCase() || '?'}
              </div>
              <span className="text-xs font-medium text-slate-600 hidden sm:inline">{user?.username}</span>
            </div>
            <button onClick={logout} className="text-slate-400 hover:text-rose-500 transition-colors" title="Выйти">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">
            {editingId ? 'Редактирование' : 'Новое поступление'}
          </h1>
          {editingId && (
            <button
              onClick={() => {
                setEditingId(null);
                setAmount('');
                setPaymentType('');
                setCategoryId('');
                setClientName('');
                setClientPhone('');
                setDescription('');
              }}
              className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
            >
              <X size={16} /> Отмена
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-6 space-y-4">
          {errors.length > 0 && (
            <div className="bg-rose-50 border border-rose-200 rounded-lg p-3">
              {errors.map((e, i) => (
                <p key={i} className="text-sm text-rose-600">{e}</p>
              ))}
            </div>
          )}

          {successMsg && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
              <p className="text-sm text-emerald-700 font-medium">{successMsg}</p>
            </div>
          )}

          <div>
            <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">Сумма *</label>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="0.00"
            />
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">Тип оплаты *</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {PAYMENT_TYPES.map(pt => (
                <button
                  key={pt.id}
                  type="button"
                  onClick={() => setPaymentType(pt.id)}
                  className={`px-3 py-2.5 rounded-lg text-sm font-medium border transition-all ${
                    paymentType === pt.id
                      ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                      : 'bg-white text-slate-600 border-slate-300 hover:border-teal-400 hover:text-teal-600'
                  }`}
                >
                  {pt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">Статья</label>
            <SearchableSelect
              value={categoryId}
              onChange={setCategoryId}
              placeholder="Выберите статью"
              options={categoryOptions}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">
                <span className="flex items-center gap-1.5"><User size={13} /> ФИО клиента</span>
              </label>
              <input
                type="text"
                value={clientName}
                onChange={e => setClientName(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                placeholder="Иванов Иван Иванович"
              />
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">
                <span className="flex items-center gap-1.5"><Phone size={13} /> Телефон</span>
              </label>
              <input
                type="tel"
                value={clientPhone}
                onChange={e => setClientPhone(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                placeholder="+7 (999) 123-45-67"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">Комментарий</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
              rows={2}
              placeholder="Примечание..."
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-teal-600 text-white rounded-lg font-semibold text-sm hover:bg-teal-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Send size={16} />
            {submitting ? 'Сохранение...' : editingId ? 'Обновить запись' : 'Записать поступление'}
          </button>
        </form>

        <div className="mt-8">
          <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Clock size={18} />
            Последние записи
          </h2>

          {loading && incomes.length === 0 ? (
            <div className="text-center py-8 text-slate-400">Загрузка...</div>
          ) : incomes.length === 0 ? (
            <div className="text-center py-8 text-slate-400 bg-white rounded-xl border border-slate-200">
              Записей пока нет
            </div>
          ) : (
            <div className="space-y-2">
              {incomes.map(inc => (
                <div key={inc.id} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-emerald-600">+{formatCurrency(inc.amount)}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-500">
                        {PAYMENT_TYPES.find(p => p.id === inc.paymentType)?.label || inc.paymentType}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 flex-wrap">
                      {inc.categoryName && <span>{inc.categoryName}</span>}
                      {inc.categoryName && inc.clientName && <span>·</span>}
                      {inc.clientName && <span>{inc.clientName}</span>}
                      {inc.clientPhone && <span>· {inc.clientPhone}</span>}
                    </div>
                    {inc.description && (
                      <p className="text-xs text-slate-400 mt-1 truncate">{inc.description}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <div className="text-[11px] text-slate-400 whitespace-nowrap">
                      {formatDate(inc.createdAt)}
                    </div>
                    {isToday(inc.createdAt) && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEdit(inc)}
                          className="p-1 text-slate-400 hover:text-teal-600 transition-colors"
                          title="Редактировать"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(inc.id)}
                          className="p-1 text-slate-400 hover:text-rose-500 transition-colors"
                          title="Удалить"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
