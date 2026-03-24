import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext';
import { useFinance } from '../context/FinanceContext';
import { IMaskInput } from 'react-imask';
import {
  LogOut, Send, Search, ChevronDown, Check, Plus, Clock,
  User, Phone, Edit2, Trash2, X, AlertCircle, ArrowLeft,
  CheckCircle2, Loader2, Calendar, Banknote, ChevronRight, ChevronLeft
} from 'lucide-react';
import { formatCurrency, formatDate } from '../utils/format';

interface MasterIncome {
  id: number;
  amount: number;
  paymentType: string;
  categoryId: number | null;
  categoryName: string | null;
  studioName: string | null;
  clientName: string;
  clientPhone: string;
  clientType: string;
  description: string;
  createdAt: string;
}

interface YCVisit {
  visitId: string | null;
  recordIds: string[];
  clientId: number | null;
  clientFirstName: string;
  clientLastName: string;
  clientName: string;
  clientPhone: string;
  services: { title: string; amount: number }[];
  goods: { title: string; amount: number }[];
  totalAmount: number;
  date: string;
}

interface IncomeEntry {
  tempId: string;
  amount: string;
  paymentType: string;
  categoryId: string;
  description: string;
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

const CLIENT_TYPES = [
  { id: 'primary', label: 'Первичный' },
  { id: 'regular', label: 'Постоянный' },
];

type Step = 'phone' | 'visit' | 'entries';

let entryCounter = 0;
function newEntry(): IncomeEntry {
  entryCounter++;
  return { tempId: String(entryCounter), amount: '', paymentType: '', categoryId: '', description: '' };
}

function formatPhoneDisplay(raw: string): string {
  const d = raw.replace(/\D/g, '');
  if (!d) return '';
  const n = d.startsWith('7') ? d.slice(1) : d;
  if (n.length === 0) return '+7';
  if (n.length <= 3) return `+7 (${n}`;
  if (n.length <= 6) return `+7 (${n.slice(0,3)}) ${n.slice(3)}`;
  if (n.length <= 8) return `+7 (${n.slice(0,3)}) ${n.slice(3,6)}-${n.slice(6)}`;
  return `+7 (${n.slice(0,3)}) ${n.slice(3,6)}-${n.slice(6,8)}-${n.slice(8,10)}`;
}

export const MasterIncomePage: React.FC = () => {
  const { user, logout } = useAuth();
  const { categories } = useFinance();

  const [incomes, setIncomes] = useState<MasterIncome[]>([]);
  const [loading, setLoading] = useState(false);

  const [step, setStep] = useState<Step>('phone');

  const [clientPhone, setClientPhone] = useState('');
  const [clientFirstName, setClientFirstName] = useState('');
  const [clientLastName, setClientLastName] = useState('');
  const [clientType, setClientType] = useState<'primary' | 'regular'>('primary');
  const [selectedVisit, setSelectedVisit] = useState<YCVisit | null>(null);
  const [ycClientId, setYcClientId] = useState<number | null>(null);
  const [lastNameWasEmpty, setLastNameWasEmpty] = useState(false);

  const [ycVisits, setYcVisits] = useState<YCVisit[]>([]);
  const [ycLoading, setYcLoading] = useState(false);
  const [ycError, setYcError] = useState<string | null>(null);
  const [ycSearched, setYcSearched] = useState(false);

  const [entries, setEntries] = useState<IncomeEntry[]>([newEntry()]);
  const [submitting, setSubmitting] = useState(false);
  const [submitResults, setSubmitResults] = useState<{ success: boolean; msg: string; ycWarning?: boolean }[]>([]);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const [historyPage, setHistoryPage] = useState(1);
  const HISTORY_PAGE_SIZE = 10;

  const [editingIncome, setEditingIncome] = useState<MasterIncome | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editPaymentType, setEditPaymentType] = useState('');
  const [editCategoryId, setEditCategoryId] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const fetchIncomes = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetch('/api/master-incomes', {
        headers: { 'x-user-id': String(user.id) },
      });
      if (res.ok) setIncomes(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchIncomes(); }, [fetchIncomes]);

  const categoryOptions = useMemo(() => {
    const filtered = categories.filter(c => c.type === 'income');
    const hasChildren = (catId: string) => filtered.some(c => c.parentId === catId);
    const result: { id: string; label: string; indent?: boolean; disabled?: boolean }[] = [];
    const addChildren = (parentId: string | null, depth: number) => {
      const items = filtered.filter(c => depth === 0 ? !c.parentId : c.parentId === parentId);
      items.forEach(item => {
        const isParent = hasChildren(item.id);
        result.push({ id: item.id, label: '\u00A0\u00A0'.repeat(depth) + item.name, indent: depth > 0 && !isParent, disabled: isParent });
        addChildren(item.id, depth + 1);
      });
    };
    addChildren(null, 0);
    return result;
  }, [categories]);

  const searchYclients = useCallback(async (phone: string) => {
    setYcLoading(true);
    setYcError(null);
    setYcSearched(false);
    try {
      const res = await fetch(`/api/yclients/search-by-phone?phone=${encodeURIComponent(phone)}`, {
        headers: { 'x-user-id': String(user?.id || '') },
      });
      if (!res.ok) throw new Error('Ошибка запроса');
      const data = await res.json();
      setYcVisits(data.visits || []);
      setYcSearched(true);
    } catch (e) {
      setYcError('Не удалось загрузить данные YClients');
      setYcVisits([]);
      setYcSearched(true);
    } finally {
      setYcLoading(false);
    }
  }, [user]);

  const handlePhoneComplete = useCallback((phone: string) => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length >= 11) {
      searchYclients(phone);
      setStep('visit');
    }
  }, [searchYclients]);

  const handleSelectVisit = (visit: YCVisit) => {
    setSelectedVisit(visit);
    setYcClientId(visit.clientId);
    setClientFirstName(visit.clientFirstName || '');
    setClientLastName(visit.clientLastName || '');
    setLastNameWasEmpty(!visit.clientLastName);
    setStep('entries');
  };

  const handleSkipVisit = () => {
    setSelectedVisit(null);
    setYcClientId(null);
    setLastNameWasEmpty(false);
    setStep('entries');
  };

  const handleBackToPhone = () => {
    setStep('phone');
    setYcVisits([]);
    setYcSearched(false);
    setYcError(null);
    setSelectedVisit(null);
    setYcClientId(null);
    setLastNameWasEmpty(false);
  };

  const handleBackToVisit = () => {
    setStep('visit');
    setSelectedVisit(null);
    setYcClientId(null);
    setLastNameWasEmpty(false);
    setDone(false);
    setSubmitResults([]);
    setGlobalError(null);
  };

  const addEntry = () => setEntries(prev => [...prev, newEntry()]);
  const removeEntry = (tempId: string) => setEntries(prev => prev.filter(e => e.tempId !== tempId));
  const updateEntry = (tempId: string, field: keyof IncomeEntry, value: string) => {
    setEntries(prev => prev.map(e => e.tempId === tempId ? { ...e, [field]: value } : e));
  };

  const clientFullName = [clientLastName.trim(), clientFirstName.trim()].filter(Boolean).join(' ');

  const handleSubmitAll = async () => {
    const errs: string[] = [];
    entries.forEach((e, i) => {
      if (!e.amount || parseFloat(e.amount) <= 0) errs.push(`Поступление ${i + 1}: введите сумму`);
      if (!e.paymentType) errs.push(`Поступление ${i + 1}: выберите тип оплаты`);
    });
    if (errs.length > 0) { setGlobalError(errs.join(' · ')); return; }
    setGlobalError(null);
    setSubmitting(true);

    if (ycClientId && lastNameWasEmpty && clientLastName.trim()) {
      try {
        await fetch('/api/yclients/update-client', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'x-user-id': String(user?.id || '') },
          body: JSON.stringify({ clientId: ycClientId, surname: clientLastName.trim() }),
        });
      } catch {
        console.error('Failed to update YClients client surname');
      }
    }

    const results: { success: boolean; msg: string; ycWarning?: boolean }[] = [];

    for (const entry of entries) {
      try {
        const res = await fetch('/api/master-incomes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-user-id': String(user?.id || '') },
          body: JSON.stringify({
            amount: parseFloat(entry.amount),
            paymentType: entry.paymentType,
            categoryId: entry.categoryId || null,
            clientName: clientFullName || clientFirstName.trim(),
            clientPhone,
            clientType,
            description: entry.description,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const ycWarn = data.yclientsResult && (data.yclientsResult.status === 'not_found' || data.yclientsResult.status === 'amount_mismatch');
          const catLabel = categoryOptions.find(c => c.id === entry.categoryId)?.label?.trim() || '';
          const ptLabel = PAYMENT_TYPES.find(p => p.id === entry.paymentType)?.label || entry.paymentType;
          results.push({
            success: true,
            msg: `${formatCurrency(parseFloat(entry.amount))} · ${ptLabel}${catLabel ? ' · ' + catLabel : ''}`,
            ycWarning: ycWarn,
          });
        } else {
          const data = await res.json().catch(() => null);
          results.push({ success: false, msg: data?.error || 'Ошибка сохранения' });
        }
      } catch {
        results.push({ success: false, msg: 'Ошибка сети' });
      }
    }

    setSubmitResults(results);
    setSubmitting(false);
    setDone(true);
    setHistoryPage(1);
    fetchIncomes();
  };

  const handleStartNew = () => {
    setStep('phone');
    setClientPhone('');
    setClientFirstName('');
    setClientLastName('');
    setClientType('primary');
    setSelectedVisit(null);
    setYcClientId(null);
    setLastNameWasEmpty(false);
    setYcVisits([]);
    setYcSearched(false);
    setYcError(null);
    setEntries([newEntry()]);
    setSubmitResults([]);
    setGlobalError(null);
    setDone(false);
  };

  const handleEdit = (inc: MasterIncome) => {
    setEditingIncome(inc);
    setEditAmount(String(inc.amount));
    setEditPaymentType(inc.paymentType);
    setEditCategoryId(String(inc.categoryId || ''));
    setEditDescription(inc.description || '');
    setEditError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingIncome) return;
    if (!editAmount || parseFloat(editAmount) <= 0) { setEditError('Введите сумму'); return; }
    if (!editPaymentType) { setEditError('Выберите тип оплаты'); return; }
    setEditError(null);
    setEditSubmitting(true);
    try {
      const res = await fetch(`/api/master-incomes/${editingIncome.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-user-id': String(user?.id || '') },
        body: JSON.stringify({
          amount: parseFloat(editAmount),
          paymentType: editPaymentType,
          categoryId: editCategoryId || null,
          clientName: editingIncome.clientName,
          clientPhone: editingIncome.clientPhone,
          clientType: editingIncome.clientType,
          description: editDescription,
        }),
      });
      if (res.ok) {
        setEditingIncome(null);
        fetchIncomes();
      } else {
        const data = await res.json().catch(() => null);
        setEditError(data?.error || 'Ошибка сохранения');
      }
    } catch {
      setEditError('Ошибка сети');
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Удалить эту запись?')) return;
    try {
      const res = await fetch(`/api/master-incomes/${id}`, {
        method: 'DELETE',
        headers: { 'x-user-id': String(user?.id || '') },
      });
      if (res.ok) fetchIncomes();
      else { const data = await res.json().catch(() => null); alert(data?.error || 'Ошибка удаления'); }
    } catch (e) { console.error(e); }
  };

  const isToday = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  };

  const phoneDigits = clientPhone.replace(/\D/g, '');
  const phoneComplete = phoneDigits.length >= 11;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-10">
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

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">

        {editingIncome ? (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-semibold text-slate-800 text-sm">Редактирование</h2>
              <button onClick={() => setEditingIncome(null)} className="text-slate-400 hover:text-slate-600">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-4 space-y-3">
              {editError && (
                <div className="bg-rose-50 border border-rose-200 rounded-lg p-2.5 text-sm text-rose-600">{editError}</div>
              )}
              <div className="text-xs text-slate-500 bg-slate-50 rounded-lg p-2 flex items-center gap-2">
                <User size={12} /> <span>{editingIncome.clientName || '—'}</span>
                <Phone size={12} className="ml-2" /> <span>{editingIncome.clientPhone || '—'}</span>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Сумма *</label>
                <input
                  type="number" step="0.01" value={editAmount} onChange={e => setEditAmount(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Тип оплаты *</label>
                <div className="grid grid-cols-4 gap-2">
                  {PAYMENT_TYPES.map(pt => (
                    <button key={pt.id} type="button" onClick={() => setEditPaymentType(pt.id)}
                      className={`px-2 py-2 rounded-lg text-xs font-medium border transition-all ${editPaymentType === pt.id ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-slate-600 border-slate-300 hover:border-teal-400'}`}>
                      {pt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Статья</label>
                <SearchableSelect value={editCategoryId} onChange={setEditCategoryId} placeholder="Выберите статью" options={categoryOptions} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Комментарий</label>
                <textarea value={editDescription} onChange={e => setEditDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none" rows={2} placeholder="Примечание..." />
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setEditingIncome(null)}
                  className="flex-1 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors">
                  Отмена
                </button>
                <button type="submit" disabled={editSubmitting}
                  className="flex-1 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-700 transition-colors disabled:opacity-50">
                  {editSubmitting ? 'Сохранение...' : 'Сохранить'}
                </button>
              </div>
            </form>
          </div>
        ) : done ? (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 size={20} className="text-emerald-500" />
                <h2 className="font-bold text-slate-800">Поступления сохранены</h2>
              </div>
              <div className="text-xs text-slate-500">
                {clientFullName && <span className="font-medium text-slate-700">{clientFullName}</span>}
                {clientFullName && clientPhone && ' · '}
                {clientPhone && <span>{formatPhoneDisplay(clientPhone)}</span>}
              </div>
            </div>
            <div className="divide-y divide-slate-100">
              {submitResults.map((r, i) => (
                <div key={i} className={`px-4 py-3 flex items-start gap-3 ${r.success ? '' : 'bg-rose-50'}`}>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${r.success ? 'bg-emerald-100' : 'bg-rose-100'}`}>
                    {r.success ? <Check size={11} className="text-emerald-600" /> : <X size={11} className="text-rose-600" />}
                  </div>
                  <div>
                    <div className={`text-sm font-medium ${r.success ? 'text-slate-800' : 'text-rose-700'}`}>{r.msg}</div>
                    {r.ycWarning && (
                      <div className="flex items-center gap-1 mt-0.5 text-xs text-amber-600">
                        <AlertCircle size={11} /> Не найдено или сумма не совпадает в YClients
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 flex gap-2">
              <button onClick={handleBackToVisit}
                className="flex-1 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors flex items-center justify-center gap-1">
                <Plus size={14} /> Ещё для этого клиента
              </button>
              <button onClick={handleStartNew}
                className="flex-1 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-700 transition-colors">
                Новый клиент
              </button>
            </div>
          </div>
        ) : step === 'phone' ? (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
            <div>
              <h1 className="text-lg font-bold text-slate-800">Новое поступление</h1>
              <p className="text-xs text-slate-500 mt-0.5">Введите номер телефона клиента</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Phone size={14} /> Телефон клиента *
              </label>
              <IMaskInput
                mask="+7 (000) 000-00-00"
                value={clientPhone}
                unmask={false}
                onAccept={(value: string) => setClientPhone(value)}
                className="w-full px-3 py-3 border border-slate-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono tracking-wide"
                placeholder="+7 (___) ___-__-__"
                autoFocus
              />
            </div>
            <button
              onClick={() => handlePhoneComplete(clientPhone)}
              disabled={!phoneComplete}
              className="w-full py-3 bg-teal-600 text-white rounded-lg font-semibold text-sm hover:bg-teal-700 transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
            >
              Найти запись в YClients <ChevronRight size={16} />
            </button>
            <button
              onClick={handleSkipVisit}
              className="w-full py-2 text-sm text-slate-400 hover:text-slate-600 transition-colors"
            >
              Создать без поиска в YClients
            </button>
          </div>
        ) : step === 'visit' ? (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
              <button onClick={handleBackToPhone} className="text-slate-400 hover:text-slate-700 transition-colors">
                <ArrowLeft size={16} />
              </button>
              <div>
                <div className="text-sm font-semibold text-slate-800">Запись в YClients</div>
                <div className="text-xs text-slate-500 font-mono">{formatPhoneDisplay(clientPhone)}</div>
              </div>
            </div>

            {ycLoading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-slate-400">
                <Loader2 size={18} className="animate-spin" /> Поиск в YClients...
              </div>
            ) : ycError ? (
              <div className="p-4">
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-2 text-sm text-amber-700">
                  <AlertCircle size={15} /> {ycError}
                </div>
                <button onClick={handleSkipVisit} className="mt-3 w-full py-2.5 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors">
                  Продолжить без привязки
                </button>
              </div>
            ) : ycSearched && ycVisits.length === 0 ? (
              <div className="p-4 space-y-3">
                <div className="text-slate-400 text-sm py-2 text-center">
                  <Calendar size={28} className="mx-auto mb-2 opacity-40" />
                  Записей на сегодня не найдено
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">Имя</label>
                    <input
                      type="text" value={clientFirstName} onChange={e => setClientFirstName(e.target.value)}
                      className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                      placeholder="Иван"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">Фамилия</label>
                    <input
                      type="text" value={clientLastName} onChange={e => setClientLastName(e.target.value)}
                      className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                      placeholder="Иванов"
                    />
                  </div>
                </div>
                <button onClick={handleSkipVisit}
                  className="w-full py-2.5 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-700 transition-colors">
                  Продолжить без привязки
                </button>
              </div>
            ) : (
              <div>
                <div className="divide-y divide-slate-100">
                  {ycVisits.map((visit, i) => {
                    const allItems = [...visit.services, ...visit.goods];
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleSelectVisit(visit)}
                        className="w-full text-left px-4 py-3.5 hover:bg-teal-50 transition-colors flex items-start justify-between gap-3 group"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-slate-800 text-sm flex items-center gap-1.5">
                            <User size={13} className="text-teal-500 shrink-0" />
                            {visit.clientName || 'Без имени'}
                          </div>
                          {visit.clientPhone && (
                            <div className="text-xs text-slate-400 mt-0.5 font-mono">{visit.clientPhone}</div>
                          )}
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {allItems.map((s, si) => (
                              <span key={si} className="text-[11px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded">
                                {s.title} {s.amount > 0 ? `(${formatCurrency(s.amount)})` : ''}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="text-sm font-bold text-teal-600">{formatCurrency(visit.totalAmount)}</div>
                          <div className="w-6 h-6 rounded-full border-2 border-slate-300 group-hover:border-teal-500 mt-1 ml-auto transition-colors" />
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className="p-3 border-t border-slate-100 space-y-2">
                  <div className="text-xs font-medium text-slate-500 mb-1">Не нашли нужную запись?</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Имя</label>
                      <input
                        type="text" value={clientFirstName} onChange={e => setClientFirstName(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                        placeholder="Иван"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Фамилия</label>
                      <input
                        type="text" value={clientLastName} onChange={e => setClientLastName(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                        placeholder="Иванов"
                      />
                    </div>
                  </div>
                  <button onClick={handleSkipVisit}
                    className="w-full py-2.5 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors">
                    Продолжить без привязки к записи
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                <button onClick={handleBackToVisit} className="text-slate-400 hover:text-slate-700 transition-colors">
                  <ArrowLeft size={16} />
                </button>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-slate-500 font-mono">{formatPhoneDisplay(clientPhone)}</div>
                  {selectedVisit && (
                    <div className="text-[10px] text-teal-600 font-medium flex items-center gap-1 mt-0.5">
                      <Check size={10} /> Привязано к записи YClients
                    </div>
                  )}
                </div>
              </div>

              <div className="px-4 py-3 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5 flex items-center gap-1">
                      <User size={12} /> Имя *
                    </label>
                    <input
                      type="text" value={clientFirstName} onChange={e => setClientFirstName(e.target.value)}
                      className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                      placeholder="Иван"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5 flex items-center gap-1.5">
                      Фамилия *
                      {lastNameWasEmpty && !clientLastName.trim() && (
                        <span className="text-[10px] text-amber-600 font-medium">не в YClients</span>
                      )}
                    </label>
                    <input
                      type="text" value={clientLastName} onChange={e => setClientLastName(e.target.value)}
                      className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 ${lastNameWasEmpty && !clientLastName.trim() ? 'border-amber-400 bg-amber-50' : 'border-slate-300'}`}
                      placeholder="Иванов"
                      autoFocus={lastNameWasEmpty}
                    />
                  </div>
                </div>
                {lastNameWasEmpty && clientLastName.trim() && ycClientId && (
                  <div className="flex items-center gap-1.5 text-[11px] text-teal-600 bg-teal-50 rounded-lg px-2.5 py-1.5">
                    <Check size={11} /> Фамилия будет добавлена в YClients при сохранении
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Тип клиента</label>
                  <div className="grid grid-cols-2 gap-2">
                    {CLIENT_TYPES.map(ct => (
                      <button key={ct.id} type="button" onClick={() => setClientType(ct.id as 'primary' | 'regular')}
                        className={`py-2 rounded-lg text-sm font-medium border transition-all ${clientType === ct.id ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-slate-600 border-slate-300 hover:border-teal-400'}`}>
                        {ct.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {globalError && (
              <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-sm text-rose-600">
                {globalError}
              </div>
            )}

            {entries.map((entry, idx) => (
              <div key={entry.tempId} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                    <Banknote size={13} /> Поступление {idx + 1}
                  </span>
                  {entries.length > 1 && (
                    <button onClick={() => removeEntry(entry.tempId)} className="text-slate-300 hover:text-rose-500 transition-colors">
                      <X size={15} />
                    </button>
                  )}
                </div>
                <div className="p-4 space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">Сумма *</label>
                    <input
                      type="number" step="0.01" value={entry.amount}
                      onChange={e => updateEntry(entry.tempId, 'amount', e.target.value)}
                      className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                      placeholder="0.00" autoFocus={idx === entries.length - 1 && idx > 0}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">Тип оплаты *</label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {PAYMENT_TYPES.map(pt => (
                        <button key={pt.id} type="button" onClick={() => updateEntry(entry.tempId, 'paymentType', pt.id)}
                          className={`py-2 rounded-lg text-xs font-medium border transition-all ${entry.paymentType === pt.id ? 'bg-teal-600 text-white border-teal-600 shadow-sm' : 'bg-white text-slate-600 border-slate-300 hover:border-teal-400'}`}>
                          {pt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">Статья</label>
                    <SearchableSelect value={entry.categoryId} onChange={v => updateEntry(entry.tempId, 'categoryId', v)} placeholder="Выберите статью" options={categoryOptions} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">Комментарий</label>
                    <input
                      type="text" value={entry.description}
                      onChange={e => updateEntry(entry.tempId, 'description', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                      placeholder="Например: По акции, АБ-Первый платёж..."
                    />
                  </div>
                </div>
              </div>
            ))}

            <button
              onClick={addEntry}
              className="w-full py-2.5 border-2 border-dashed border-slate-300 rounded-xl text-sm text-slate-500 hover:border-teal-400 hover:text-teal-600 transition-colors flex items-center justify-center gap-2"
            >
              <Plus size={15} /> Добавить ещё поступление
            </button>

            <button
              onClick={handleSubmitAll}
              disabled={submitting}
              className="w-full py-3.5 bg-teal-600 text-white rounded-xl font-bold text-sm hover:bg-teal-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
            >
              {submitting ? (
                <><Loader2 size={16} className="animate-spin" /> Сохранение...</>
              ) : (
                <><Send size={16} /> Сохранить {entries.length > 1 ? `${entries.length} поступления` : 'поступление'}</>
              )}
            </button>
          </div>
        )}

        <div className="mt-2 pb-4">
          {loading && incomes.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">Загрузка...</div>
          ) : incomes.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm bg-white rounded-xl border border-slate-200">
              Записей пока нет
            </div>
          ) : (() => {
            const totalPages = Math.ceil(incomes.length / HISTORY_PAGE_SIZE);
            const safePage = Math.min(historyPage, totalPages);
            const pageSlice = incomes.slice((safePage - 1) * HISTORY_PAGE_SIZE, safePage * HISTORY_PAGE_SIZE);
            const fromIdx = (safePage - 1) * HISTORY_PAGE_SIZE + 1;
            const toIdx = Math.min(safePage * HISTORY_PAGE_SIZE, incomes.length);

            const now = new Date();
            const todayStr = now.toISOString().split('T')[0];
            const yesterdayStr = new Date(now.getTime() - 86400000).toISOString().split('T')[0];

            const dateLabel = (dateStr: string) => {
              const d = new Date(dateStr);
              const ds = d.toISOString().split('T')[0];
              if (ds === todayStr) return 'Сегодня';
              if (ds === yesterdayStr) return 'Вчера';
              return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
            };

            let lastDateLabel = '';

            return (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                    <Clock size={16} /> Записи
                  </h2>
                  <span className="text-xs text-slate-400">{fromIdx}–{toIdx} из {incomes.length}</span>
                </div>

                <div className="space-y-1">
                  {pageSlice.map(inc => {
                    const label = dateLabel(inc.createdAt);
                    const showHeader = label !== lastDateLabel;
                    lastDateLabel = label;
                    return (
                      <React.Fragment key={inc.id}>
                        {showHeader && (
                          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide pt-2 pb-1 px-1">
                            {label}
                          </div>
                        )}
                        <div className="bg-white rounded-xl border border-slate-200 p-3.5 flex items-center justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-bold text-emerald-600">+{formatCurrency(inc.amount)}</span>
                              <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-500">
                                {PAYMENT_TYPES.find(p => p.id === inc.paymentType)?.label || inc.paymentType}
                              </span>
                              {inc.clientType && inc.clientType !== 'customer' && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-600 font-medium">
                                  {CLIENT_TYPES.find(ct => ct.id === inc.clientType)?.label}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-500 flex-wrap">
                              {inc.categoryName && <span>{inc.categoryName}</span>}
                              {inc.clientName && <><span>·</span><span>{inc.clientName}</span></>}
                              {inc.clientPhone && <><span>·</span><span className="font-mono">{inc.clientPhone}</span></>}
                            </div>
                            {inc.description && <p className="text-xs text-slate-400 mt-0.5 truncate">{inc.description}</p>}
                          </div>
                          <div className="flex flex-col items-end gap-1.5 shrink-0">
                            <div className="text-[11px] text-slate-400 whitespace-nowrap">
                              {new Date(inc.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                            {isToday(inc.createdAt) && !editingIncome && (
                              <div className="flex items-center gap-1.5">
                                <button onClick={() => handleEdit(inc)} className="p-1 text-slate-300 hover:text-teal-600 transition-colors" title="Редактировать">
                                  <Edit2 size={13} />
                                </button>
                                <button onClick={() => handleDelete(inc.id)} className="p-1 text-slate-300 hover:text-rose-500 transition-colors" title="Удалить">
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </React.Fragment>
                    );
                  })}
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-200">
                    <button
                      onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                      disabled={safePage === 1}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 border border-slate-300 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronLeft size={15} /> Назад
                    </button>
                    <div className="flex items-center gap-1.5">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                        <button
                          key={p}
                          onClick={() => setHistoryPage(p)}
                          className={`w-7 h-7 rounded-full text-xs font-semibold transition-colors ${p === safePage ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'}`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => setHistoryPage(p => Math.min(totalPages, p + 1))}
                      disabled={safePage === totalPages}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 border border-slate-300 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Вперёд <ChevronRight size={15} />
                    </button>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
};
