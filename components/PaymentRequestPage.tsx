import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext';
import { useFinance } from '../context/FinanceContext';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';
import { Plus, Clock, CheckCircle2, XCircle, LogOut, Send, ChevronDown, ChevronRight, Search, Check, X } from 'lucide-react';
import { formatCurrency, formatDate } from '../utils/format';
import { Category } from '../types';

interface PaymentRequest {
  id: number;
  userId: number;
  username: string;
  amount: number;
  categoryId: number | null;
  categoryName: string | null;
  studioId: number | null;
  studioName: string | null;
  contractorId: number | null;
  contractorName: string | null;
  description: string;
  status: string;
  paidAt: string | null;
  createdAt: string;
}

interface PaymentRequestPageProps {
  isAdmin?: boolean;
  isModal?: boolean;
  onClose?: () => void;
}

interface SearchableSelectProps {
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
  options: { id: string; label: string; sublabel?: string; indent?: boolean }[];
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

export const PaymentRequestPage: React.FC<PaymentRequestPageProps> = ({ isAdmin = false, isModal = false }) => {
  const { user, logout } = useAuth();
  const { categories, studios, contractors, refreshData } = useFinance();
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [studioId, setStudioId] = useState('');
  const [contractorId, setContractorId] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [showNewContractor, setShowNewContractor] = useState(false);

  const fetchRequests = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (!isAdmin && user) params.set('userId', user.id.toString());
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`/api/payment-requests?${params.toString()}`);
      const data = await res.json();
      setRequests(data);
    } catch (err) {
      console.error(err);
    }
  }, [user, isAdmin, statusFilter]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const categoryOptions = useMemo(() => {
    const filtered = categories.filter(c => c.type === 'expense');
    const hasChildren = (catId: string) => filtered.some(c => c.parentId === catId);
    const result: { id: string; label: string; indent?: boolean }[] = [];
    const addChildren = (parentId: string | null, depth: number) => {
      const items = filtered.filter(c => depth === 0 ? !c.parentId : c.parentId === parentId);
      items.forEach(item => {
        if (!hasChildren(item.id)) {
          result.push({ id: item.id, label: '\u00A0\u00A0'.repeat(depth) + item.name, indent: depth > 0 });
        }
        addChildren(item.id, depth + 1);
      });
    };
    addChildren(null, 0);
    return result;
  }, [categories]);

  const studioOptions = useMemo(() => {
    return studios.map(s => ({ id: s.id, label: s.name }));
  }, [studios]);

  const contractorOptions = useMemo(() => {
    return contractors.map(c => ({ id: c.id, label: c.name, sublabel: c.inn || undefined }));
  }, [contractors]);

  const handleContractorCreated = (id: string) => {
    setContractorId(id);
    setShowNewContractor(false);
    refreshData();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!amount || parseFloat(amount) <= 0) {
      setError('Укажите сумму');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/payment-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id,
          amount: parseFloat(amount),
          categoryId: categoryId || null,
          studioId: studioId || null,
          contractorId: contractorId || null,
          description
        })
      });

      if (res.ok) {
        setShowForm(false);
        setAmount('');
        setCategoryId('');
        setStudioId('');
        setContractorId('');
        setDescription('');
        fetchRequests();
      }
    } catch (err) {
      setError('Ошибка при отправке запроса');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (id: number, status: string) => {
    try {
      await fetch(`/api/payment-requests/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      fetchRequests();
    } catch (err) {
      console.error(err);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700"><Clock size={12} /> Ожидает</span>;
      case 'paid':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700"><CheckCircle2 size={12} /> Оплачено</span>;
      case 'rejected':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700"><XCircle size={12} /> Отклонено</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600">{status}</span>;
    }
  };

  const pendingCount = requests.filter(r => r.status === 'pending').length;
  const totalPending = requests.filter(r => r.status === 'pending').reduce((s, r) => s + parseFloat(String(r.amount)), 0);

  const content = (
    <div className={isModal ? '' : 'min-h-screen bg-slate-50'}>
      {!isModal && !isAdmin && (
        <div className="bg-white border-b border-slate-200 shadow-sm">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-teal-600 text-white flex items-center justify-center font-bold h-9 w-9 text-[10px]">ПФ</div>
              <span className="font-semibold text-slate-800">ПланФакт ViVi</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-teal-50 flex items-center justify-center text-teal-600 font-bold text-xs">
                {user?.username?.[0]?.toUpperCase() || '?'}
              </div>
              <span className="text-sm text-slate-600 hidden sm:inline">{user?.username}</span>
              <button onClick={logout} className="text-slate-400 hover:text-rose-500 ml-1" title="Выйти">
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={isModal ? '' : 'max-w-4xl mx-auto px-4 sm:px-6 py-6'}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className={`${isModal ? 'text-lg' : 'text-xl sm:text-2xl'} font-bold text-slate-800`}>
              {isAdmin ? 'Запросы на выплату' : 'Мои запросы на выплату'}
            </h1>
            {pendingCount > 0 && (
              <p className="text-sm text-slate-500 mt-1">
                {pendingCount} {pendingCount === 1 ? 'запрос' : pendingCount < 5 ? 'запроса' : 'запросов'} на сумму {formatCurrency(totalPending)}
              </p>
            )}
          </div>
          <Button onClick={() => setShowForm(true)} className="bg-teal-600 text-white flex items-center gap-2 shrink-0">
            <Plus size={16} /> Новый запрос
          </Button>
        </div>

        <div className="flex gap-2 mb-4 overflow-x-auto">
          {[
            { value: '', label: 'Все' },
            { value: 'pending', label: 'Ожидающие' },
            { value: 'paid', label: 'Оплаченные' },
          ].map(f => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                statusFilter === f.value
                  ? 'bg-teal-600 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {requests.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <Send size={24} className="text-slate-400" />
            </div>
            <p className="text-slate-500 text-sm">Запросов пока нет</p>
            <p className="text-slate-400 text-xs mt-1">Нажмите «Новый запрос» чтобы создать</p>
          </div>
        ) : (
          <div className="space-y-2">
            {requests.map(req => {
              const isExpanded = expandedId === req.id;
              return (
                <div key={req.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden transition-shadow hover:shadow-sm">
                  <div
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : req.id)}
                  >
                    <div className="shrink-0 text-slate-400">
                      {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-slate-800">{formatCurrency(parseFloat(String(req.amount)))}</span>
                        {getStatusBadge(req.status)}
                        {isAdmin && <span className="text-xs text-slate-400">от {req.username}</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 truncate">
                        {req.categoryName && <span>{req.categoryName}</span>}
                        {req.categoryName && req.studioName && <span>·</span>}
                        {req.studioName && <span>{req.studioName}</span>}
                        {(req.categoryName || req.studioName) && req.description && <span>·</span>}
                        {req.description && <span className="truncate">{req.description}</span>}
                      </div>
                    </div>
                    <span className="text-xs text-slate-400 shrink-0 hidden sm:inline">{formatDate(req.createdAt)}</span>
                  </div>
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-1 border-t border-slate-100 bg-slate-50/50">
                      <div className="grid grid-cols-2 gap-3 text-xs mb-3">
                        <div>
                          <span className="text-slate-400">Сумма</span>
                          <p className="font-semibold text-slate-700">{formatCurrency(parseFloat(String(req.amount)))}</p>
                        </div>
                        <div>
                          <span className="text-slate-400">Дата создания</span>
                          <p className="font-medium text-slate-700">{formatDate(req.createdAt)}</p>
                        </div>
                        {req.categoryName && (
                          <div>
                            <span className="text-slate-400">Статья</span>
                            <p className="font-medium text-slate-700">{req.categoryName}</p>
                          </div>
                        )}
                        {req.studioName && (
                          <div>
                            <span className="text-slate-400">Студия</span>
                            <p className="font-medium text-slate-700">{req.studioName}</p>
                          </div>
                        )}
                        {req.contractorName && (
                          <div>
                            <span className="text-slate-400">Контрагент</span>
                            <p className="font-medium text-slate-700">{req.contractorName}</p>
                          </div>
                        )}
                        {req.description && (
                          <div className="col-span-2">
                            <span className="text-slate-400">Описание</span>
                            <p className="font-medium text-slate-700">{req.description}</p>
                          </div>
                        )}
                        {req.paidAt && (
                          <div>
                            <span className="text-slate-400">Дата оплаты</span>
                            <p className="font-medium text-emerald-600">{formatDate(req.paidAt)}</p>
                          </div>
                        )}
                        <div>
                          <span className="text-slate-400">Статус</span>
                          <p>{getStatusBadge(req.status)}</p>
                        </div>
                      </div>
                      {isAdmin && req.status === 'pending' && (
                        <div className="flex gap-2 pt-2 border-t border-slate-200">
                          <Button
                            onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleStatusChange(req.id, 'paid'); }}
                            className="bg-emerald-600 text-white text-xs flex items-center gap-1"
                          >
                            <CheckCircle2 size={14} /> Оплатить
                          </Button>
                          <Button
                            onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleStatusChange(req.id, 'rejected'); }}
                            variant="secondary"
                            className="text-xs flex items-center gap-1 text-rose-600"
                          >
                            <XCircle size={14} /> Отклонить
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title="Новый запрос на выплату">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Сумма *</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-teal-500"
              placeholder="0.00"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Статья расхода</label>
            <SearchableSelect
              value={categoryId}
              onChange={setCategoryId}
              placeholder="— Не указана —"
              options={categoryOptions}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Студия</label>
            <SearchableSelect
              value={studioId}
              onChange={setStudioId}
              placeholder="— Не указана —"
              options={studioOptions}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Контрагент</label>
            <SearchableSelect
              value={contractorId}
              onChange={setContractorId}
              placeholder="— Не указан —"
              options={contractorOptions}
              onCreateNew={() => setShowNewContractor(true)}
              createLabel="Создать контрагента"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Описание</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-teal-500 resize-none"
              rows={3}
              placeholder="Опишите за что нужна выплата..."
            />
          </div>
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Отмена</Button>
            <Button type="submit" className="bg-teal-600 text-white flex items-center gap-2" disabled={loading}>
              <Send size={16} /> {loading ? 'Отправка...' : 'Отправить запрос'}
            </Button>
          </div>
        </form>
      </Modal>

      {showNewContractor && (
        <NewContractorModal
          onClose={() => setShowNewContractor(false)}
          onCreated={handleContractorCreated}
        />
      )}
    </div>
  );

  return content;
};
