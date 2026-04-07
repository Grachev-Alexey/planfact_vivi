import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext';
import { useFinance } from '../context/FinanceContext';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';
import { Plus, Clock, CheckCircle2, XCircle, LogOut, Send, ChevronDown, ChevronRight, Search, Check, X, Calendar, DollarSign, MessageSquare, Filter, ChevronLeft, ThumbsUp, BadgeCheck } from 'lucide-react';
import { formatCurrency, formatDate } from '../utils/format';
import { FilterSelect } from './ui/FilterSelect';
import { DateRangePicker } from './ui/DateRangePicker';
import { DatePicker } from './ui/DatePicker';
import { Category } from '../types';

const REQUESTS_PER_PAGE = 30;

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
  accountId: number | null;
  accountName: string | null;
  description: string;
  status: string;
  paymentDate: string | null;
  accrualDate: string | null;
  telegramMessageId: string | null;
  paidAmount: number | null;
  paidDate: string | null;
  paidComment: string | null;
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
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-5" onClick={e => e.stopPropagation()}>
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
  const { categories, studios, contractors, accounts, refreshData } = useFinance();
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [studioId, setStudioId] = useState('');
  const [contractorId, setContractorId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (showForm && !accountId && accounts.length > 0) {
      const bAccount = accounts.find(a => a.name.toLowerCase().includes('бухгалтер'));
      if (bAccount) {
        setAccountId(bAccount.id.toString());
      }
    }
  }, [showForm, accounts, accountId]);

  const [paymentDate, setPaymentDate] = useState('');
  const [accrualDate, setAccrualDate] = useState('');
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('unpaid');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategories, setFilterCategories] = useState<string[]>([]);
  const [filterStudios, setFilterStudios] = useState<string[]>([]);
  const [filterContractors, setFilterContractors] = useState<string[]>([]);
  const [filterAccounts, setFilterAccounts] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [showNewContractor, setShowNewContractor] = useState(false);
  const [showPayModal, setShowPayModal] = useState<number | null>(null);
  const [payAccountId, setPayAccountId] = useState<string>('');
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState('');
  const [payComment, setPayComment] = useState('');

  const fetchRequests = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (!isAdmin && user) params.set('userId', user.id.toString());
      if (statusFilter && statusFilter !== 'unpaid') params.set('status', statusFilter);
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

  const studioOptions = useMemo(() => studios.map(s => ({ id: s.id, label: s.name })), [studios]);
  const contractorOptions = useMemo(() => contractors.map(c => ({ id: c.id, label: c.name, sublabel: c.inn || undefined })), [contractors]);
  const accountOptions = useMemo(() => accounts.filter(a => !a.isArchived).map(a => ({ id: a.id, label: a.name })), [accounts]);

  const filterCategoryOptions = useMemo(() => {
    const used = new Set(requests.map(r => String(r.categoryId)).filter(Boolean));
    return categories.filter(c => used.has(c.id)).map(c => ({ id: c.id, label: c.name }));
  }, [categories, requests]);

  const filterStudioOptions = useMemo(() => {
    const used = new Set(requests.map(r => String(r.studioId)).filter(Boolean));
    return studios.filter(s => used.has(s.id)).map(s => ({ id: s.id, label: s.name }));
  }, [studios, requests]);

  const filterContractorOptions = useMemo(() => {
    const used = new Set(requests.map(r => String(r.contractorId)).filter(Boolean));
    return contractors.filter(c => used.has(c.id)).map(c => ({ id: c.id, label: c.name }));
  }, [contractors, requests]);

  const filterAccountOptions = useMemo(() => {
    const used = new Set(requests.map(r => String(r.accountId)).filter(Boolean));
    return accounts.filter(a => used.has(a.id)).map(a => ({ id: a.id, label: a.name }));
  }, [accounts, requests]);

  const filteredRequests = useMemo(() => {
    let result = requests;

    if (statusFilter === 'unpaid') {
      result = result.filter(r => r.status === 'pending' || r.status === 'approved');
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(r =>
        (r.description && r.description.toLowerCase().includes(q)) ||
        (r.username && r.username.toLowerCase().includes(q)) ||
        (r.categoryName && r.categoryName.toLowerCase().includes(q)) ||
        (r.studioName && r.studioName.toLowerCase().includes(q)) ||
        (r.contractorName && r.contractorName.toLowerCase().includes(q)) ||
        (r.accountName && r.accountName.toLowerCase().includes(q)) ||
        String(r.amount).includes(q)
      );
    }

    if (filterCategories.length > 0) {
      result = result.filter(r => r.categoryId && filterCategories.includes(String(r.categoryId)));
    }
    if (filterStudios.length > 0) {
      result = result.filter(r => r.studioId && filterStudios.includes(String(r.studioId)));
    }
    if (filterContractors.length > 0) {
      result = result.filter(r => r.contractorId && filterContractors.includes(String(r.contractorId)));
    }
    if (filterAccounts.length > 0) {
      result = result.filter(r => r.accountId && filterAccounts.includes(String(r.accountId)));
    }

    if (dateFrom) {
      result = result.filter(r => {
        const d = r.paymentDate ? r.paymentDate.slice(0, 10) : '';
        return d && d >= dateFrom;
      });
    }
    if (dateTo) {
      result = result.filter(r => {
        const d = r.paymentDate ? r.paymentDate.slice(0, 10) : '';
        return d && d <= dateTo;
      });
    }

    return result;
  }, [requests, searchQuery, filterCategories, filterStudios, filterContractors, filterAccounts, dateFrom, dateTo, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / REQUESTS_PER_PAGE));
  const clampedPage = Math.min(currentPage, totalPages);
  const paginatedRequests = filteredRequests.slice((clampedPage - 1) * REQUESTS_PER_PAGE, clampedPage * REQUESTS_PER_PAGE);

  const groupedRequests = useMemo(() => {
    const groups: { [key: string]: PaymentRequest[] } = {};
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    paginatedRequests.forEach(req => {
      let key: string;
      if (req.paymentDate) {
        const d = new Date(req.paymentDate);
        if (d.toDateString() === today.toDateString()) key = 'Сегодня';
        else if (d.toDateString() === yesterday.toDateString()) key = 'Вчера';
        else key = formatDate(req.paymentDate);
      } else {
        key = 'Без даты оплаты';
      }
      if (!groups[key]) groups[key] = [];
      groups[key].push(req);
    });
    return Object.entries(groups).map(([title, items]) => ({ title, items }));
  }, [paginatedRequests]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [totalPages, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterCategories, filterStudios, filterContractors, filterAccounts, dateFrom, dateTo, statusFilter]);

  const activeFilterCount = [filterCategories, filterStudios, filterContractors, filterAccounts].filter(f => f.length > 0).length + (dateFrom ? 1 : 0) + (dateTo ? 1 : 0);

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
    if (!accountId) {
      setError('Выберите счёт');
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
          accountId: accountId || null,
          description,
          paymentDate: paymentDate || null,
          accrualDate: accrualDate || null
        })
      });

      if (res.ok) {
        setShowForm(false);
        setAmount('');
        setCategoryId('');
        setStudioId('');
        setContractorId('');
        setAccountId('');
        setDescription('');
        setPaymentDate('');
        setAccrualDate('');
        fetchRequests();
        refreshData();
      }
    } catch (err) {
      setError('Ошибка при отправке запроса');
    } finally {
      setLoading(false);
    }
  };

  const handlePayClick = (req: PaymentRequest) => {
    setPayAccountId(req.accountId?.toString() || '');
    setPayAmount(String(req.amount));
    setPayDate(new Date().toISOString().split('T')[0]);
    setPayComment('');
    setShowPayModal(req.id);
  };

  const handlePayConfirm = async () => {
    if (!showPayModal || !payAccountId) return;
    try {
      await fetch(`/api/payment-requests/${showPayModal}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-user-id': user?.id?.toString() || '' },
        body: JSON.stringify({
          status: 'paid',
          accountId: payAccountId,
          paidAmount: parseFloat(payAmount) || 0,
          paidDate: payDate || null,
          paidComment: payComment || ''
        })
      });
      setShowPayModal(null);
      fetchRequests();
      refreshData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Удалить этот запрос на выплату?')) return;
    try {
      await fetch(`/api/payment-requests/${id}`, {
        method: 'DELETE',
        headers: { 'x-user-id': user?.id?.toString() || '' },
      });
      fetchRequests();
      refreshData();
    } catch (err) {
      console.error(err);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700"><Clock size={11} /> Ожидает</span>;
      case 'approved':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-sky-50 text-sky-700"><BadgeCheck size={11} /> Утвержден</span>;
      case 'paid':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700"><CheckCircle2 size={11} /> Оплачен</span>;
      case 'rejected':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-50 text-rose-700"><XCircle size={11} /> Отклонено</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[11px] bg-slate-100 text-slate-600">{status}</span>;
    }
  };

  const handleApprove = async (id: number) => {
    try {
      await fetch(`/api/payment-requests/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-user-id': user?.id?.toString() || '' },
        body: JSON.stringify({ status: 'approved' })
      });
      fetchRequests();
    } catch (err) {
      console.error(err);
    }
  };

  const handleReject = async (id: number) => {
    if (!confirm('Отклонить этот запрос на выплату?')) return;
    try {
      await fetch(`/api/payment-requests/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-user-id': user?.id?.toString() || '' },
        body: JSON.stringify({ status: 'rejected' })
      });
      fetchRequests();
    } catch (err) {
      console.error(err);
    }
  };

  const pendingCount = requests.filter(r => r.status === 'pending' || r.status === 'approved').length;
  const totalPending = requests.filter(r => r.status === 'pending' || r.status === 'approved').reduce((s, r) => s + parseFloat(String(r.amount)), 0);

  const content = (
    <div className={isModal ? '' : 'min-h-screen bg-slate-50'}>
      {!isModal && !isAdmin && (
        <div className="bg-white border-b border-slate-200 shadow-sm safe-area-top">
          <div className="max-w-4xl mx-auto px-3 sm:px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="rounded-lg bg-teal-600 text-white flex items-center justify-center font-bold h-8 w-8 sm:h-9 sm:w-9 text-[10px]">ПФ</div>
              <span className="font-semibold text-slate-800 text-sm sm:text-base">ПланФакт ViVi</span>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
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

      <div className={isModal ? '' : 'max-w-4xl mx-auto px-3 sm:px-6 py-4 sm:py-6'}>
        <div className="flex items-center justify-between gap-3 mb-4 sm:mb-6">
          <div className="min-w-0">
            <h1 className={`${isModal ? 'text-lg' : 'text-lg sm:text-2xl'} font-bold text-slate-800`}>
              {isAdmin ? 'Запросы на выплату' : 'Мои запросы'}
            </h1>
            {pendingCount > 0 && (
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                {pendingCount} {pendingCount === 1 ? 'запрос' : pendingCount < 5 ? 'запроса' : 'запросов'} на {formatCurrency(totalPending)}
              </p>
            )}
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="bg-teal-600 text-white rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-medium flex items-center gap-1.5 shrink-0 shadow-sm hover:bg-teal-700 active:scale-95 transition-all"
          >
            <Plus size={16} /> <span className="hidden xs:inline">Новый</span> <span className="xs:hidden">+</span>
          </button>
        </div>

        <div className="flex items-center gap-2 mb-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              placeholder="Поиск по описанию, контрагенту, студии..."
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`shrink-0 px-3 py-2 border rounded-lg text-sm flex items-center gap-1.5 transition-colors ${
              showFilters || activeFilterCount > 0
                ? 'bg-teal-50 border-teal-300 text-teal-700'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Filter size={14} />
            <span className="hidden sm:inline">Фильтры</span>
            {activeFilterCount > 0 && (
              <span className="bg-teal-600 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">{activeFilterCount}</span>
            )}
          </button>
        </div>

        <div className="flex gap-1.5 sm:gap-2 mb-3 overflow-x-auto pb-1 -mx-1 px-1">
          {[
            { value: 'unpaid', label: 'Не оплачено' },
            { value: '', label: 'Все' },
            { value: 'pending', label: 'Ожидает' },
            { value: 'approved', label: 'Утвержден' },
            { value: 'paid', label: 'Оплачен' },
          ].map(f => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                statusFilter === f.value
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 active:bg-slate-100'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {showFilters && (
          <div className="bg-white rounded-xl border border-slate-200 p-3 mb-3 space-y-2">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <FilterSelect
                value={filterCategories}
                onChange={setFilterCategories}
                placeholder="Статья"
                options={filterCategoryOptions}
              />
              <FilterSelect
                value={filterStudios}
                onChange={setFilterStudios}
                placeholder="Студия"
                options={filterStudioOptions}
              />
              <FilterSelect
                value={filterContractors}
                onChange={setFilterContractors}
                placeholder="Контрагент"
                options={filterContractorOptions}
              />
              <FilterSelect
                value={filterAccounts}
                onChange={setFilterAccounts}
                placeholder="Счёт"
                options={filterAccountOptions}
              />
            </div>
            <div className="w-full sm:w-48">
              <DateRangePicker
                dateFrom={dateFrom}
                dateTo={dateTo}
                onChangeFrom={setDateFrom}
                onChangeTo={setDateTo}
                label="Дата оплаты"
              />
            </div>
            {activeFilterCount > 0 && (
              <button
                onClick={() => { setFilterCategories([]); setFilterStudios([]); setFilterContractors([]); setFilterAccounts([]); setDateFrom(''); setDateTo(''); }}
                className="text-xs text-teal-600 hover:text-teal-700 font-medium"
              >
                Сбросить все фильтры
              </button>
            )}
          </div>
        )}

        {filteredRequests.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 sm:p-12 text-center">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3 sm:mb-4">
              <Send size={22} className="text-slate-400" />
            </div>
            <p className="text-slate-500 text-sm">Запросов пока нет</p>
            <p className="text-slate-400 text-xs mt-1">Нажмите «+» чтобы создать</p>
          </div>
        ) : (
          <div className="space-y-2">
            {groupedRequests.map(group => (
              <div key={group.title}>
                <div className="px-1 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  {group.title}
                </div>
                <div className="space-y-2">
            {group.items.map(req => {
              const isExpanded = expandedId === req.id;
              return (
                <div key={req.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden transition-shadow hover:shadow-sm active:shadow-sm">
                  <div
                    className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 cursor-pointer active:bg-slate-50"
                    onClick={() => setExpandedId(isExpanded ? null : req.id)}
                  >
                    <div className="shrink-0 text-slate-400">
                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-slate-800">{formatCurrency(parseFloat(String(req.amount)))}</span>
                        {getStatusBadge(req.status)}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5 text-[11px] sm:text-xs text-slate-500 flex-wrap">
                        {isAdmin && req.username && <span className="text-teal-600 font-medium shrink-0">{req.username}</span>}
                        {(req.categoryName || req.studioName || req.contractorName) && (
                          <>
                            {isAdmin && req.username && <span>·</span>}
                            <span className="truncate">
                              {[req.categoryName, req.studioName, req.contractorName].filter(Boolean).join(' · ')}
                            </span>
                          </>
                        )}
                        {req.description && !req.categoryName && !req.studioName && !req.contractorName && (
                          <>
                            {isAdmin && req.username && <span>·</span>}
                            <span className="truncate text-slate-400 italic">{req.description}</span>
                          </>
                        )}
                      </div>
                    </div>
                    {req.paymentDate ? (
                      <span className="text-[11px] text-slate-500 shrink-0 flex items-center gap-0.5"><Calendar size={10} /> {formatDate(req.paymentDate)}</span>
                    ) : (
                      <span className="text-[11px] text-slate-300 shrink-0">—</span>
                    )}
                  </div>
                  {isExpanded && (
                    <div className="px-3 sm:px-4 pb-3 sm:pb-4 pt-1 border-t border-slate-100 bg-slate-50/50">
                      <div className="grid grid-cols-2 gap-2 sm:gap-3 text-xs mb-3">
                        <div>
                          <span className="text-slate-400 text-[11px]">Сумма</span>
                          <p className="font-semibold text-slate-700">{formatCurrency(parseFloat(String(req.amount)))}</p>
                        </div>
                        <div>
                          <span className="text-slate-400 text-[11px]">Создан</span>
                          <p className="font-medium text-slate-700">{formatDate(req.createdAt)}</p>
                        </div>
                        {req.categoryName && (
                          <div>
                            <span className="text-slate-400 text-[11px]">Статья</span>
                            <p className="font-medium text-slate-700">{req.categoryName}</p>
                          </div>
                        )}
                        {req.studioName && (
                          <div>
                            <span className="text-slate-400 text-[11px]">Студия</span>
                            <p className="font-medium text-slate-700">{req.studioName}</p>
                          </div>
                        )}
                        {req.contractorName && (
                          <div>
                            <span className="text-slate-400 text-[11px]">Контрагент</span>
                            <p className="font-medium text-slate-700">{req.contractorName}</p>
                          </div>
                        )}
                        {req.accountName && (
                          <div>
                            <span className="text-slate-400 text-[11px]">Счёт</span>
                            <p className="font-medium text-slate-700">{req.accountName}</p>
                          </div>
                        )}
                        {req.paymentDate && (
                          <div>
                            <span className="text-slate-400 text-[11px]">Дата оплаты</span>
                            <p className="font-medium text-slate-700">{formatDate(req.paymentDate)}</p>
                          </div>
                        )}
                        {req.accrualDate && (
                          <div>
                            <span className="text-slate-400 text-[11px]">Дата начисления</span>
                            <p className="font-medium text-slate-700">{formatDate(req.accrualDate)}</p>
                          </div>
                        )}
                        {req.description && (
                          <div className="col-span-2">
                            <span className="text-slate-400 text-[11px]">Описание</span>
                            <p className="font-medium text-slate-700">{req.description}</p>
                          </div>
                        )}
                        {req.status === 'paid' && (
                          <>
                            <div className="col-span-2 border-t border-slate-200 pt-2 mt-1">
                              <span className="text-emerald-600 font-semibold text-[11px]">Данные оплаты</span>
                            </div>
                            {req.paidAmount !== null && (
                              <div>
                                <span className="text-slate-400 text-[11px]">Факт. сумма</span>
                                <p className="font-semibold text-emerald-700">{formatCurrency(parseFloat(String(req.paidAmount)))}</p>
                              </div>
                            )}
                            {req.paidDate && (
                              <div>
                                <span className="text-slate-400 text-[11px]">Факт. дата</span>
                                <p className="font-medium text-emerald-700">{formatDate(req.paidDate)}</p>
                              </div>
                            )}
                            {req.paidAt && (
                              <div>
                                <span className="text-slate-400 text-[11px]">Оплачено</span>
                                <p className="font-medium text-slate-700">{formatDate(req.paidAt)}</p>
                              </div>
                            )}
                            {req.paidComment && (
                              <div className="col-span-2">
                                <span className="text-slate-400 text-[11px]">Комментарий</span>
                                <p className="font-medium text-slate-700">{req.paidComment}</p>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                      {isAdmin && req.status === 'pending' && (
                        <div className="flex gap-2 pt-2 border-t border-slate-200">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleApprove(req.id); }}
                            className="flex-1 bg-sky-600 text-white text-xs font-medium py-2 px-3 rounded-lg flex items-center justify-center gap-1 hover:bg-sky-700 active:scale-95 transition-all"
                          >
                            <ThumbsUp size={14} /> Утвердить
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handlePayClick(req); }}
                            className="flex-1 bg-emerald-600 text-white text-xs font-medium py-2 px-3 rounded-lg flex items-center justify-center gap-1 hover:bg-emerald-700 active:scale-95 transition-all"
                          >
                            <CheckCircle2 size={14} /> Оплатить
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(req.id); }}
                            className="bg-white border border-slate-200 text-rose-600 text-xs font-medium py-2 px-2 rounded-lg flex items-center justify-center gap-1 hover:bg-rose-50 active:scale-95 transition-all"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      )}
                      {!isAdmin && req.status === 'pending' && req.userId === user?.id && (
                        <div className="flex gap-2 pt-2 border-t border-slate-200">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(req.id); }}
                            className="bg-white border border-slate-200 text-rose-600 text-xs font-medium py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 hover:bg-rose-50 active:scale-95 transition-all"
                          >
                            <X size={14} /> Удалить
                          </button>
                        </div>
                      )}
                      {isAdmin && req.status === 'approved' && (
                        <div className="flex gap-2 pt-2 border-t border-slate-200">
                          <button
                            onClick={(e) => { e.stopPropagation(); handlePayClick(req); }}
                            className="flex-1 bg-emerald-600 text-white text-xs font-medium py-2 px-3 rounded-lg flex items-center justify-center gap-1 hover:bg-emerald-700 active:scale-95 transition-all"
                          >
                            <CheckCircle2 size={14} /> Оплатить
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(req.id); }}
                            className="bg-white border border-slate-200 text-rose-600 text-xs font-medium py-2 px-3 rounded-lg flex items-center justify-center gap-1 hover:bg-rose-50 active:scale-95 transition-all"
                          >
                            <XCircle size={14} /> Удалить
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
                </div>
              </div>
            ))}

            {totalPages > 1 && (
              <div className="flex items-center justify-between bg-white rounded-xl border border-slate-200 px-3 sm:px-4 py-2.5 mt-3">
                <span className="text-xs text-slate-500">
                  {filteredRequests.length} {filteredRequests.length === 1 ? 'запрос' : filteredRequests.length < 5 ? 'запроса' : 'запросов'}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={clampedPage <= 1}
                    className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed text-slate-600"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(p => p === 1 || p === totalPages || Math.abs(p - clampedPage) <= 1)
                    .reduce<(number | string)[]>((acc, p, idx, arr) => {
                      if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('...');
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((p, i) =>
                      typeof p === 'string' ? (
                        <span key={`dots-${i}`} className="px-1 text-xs text-slate-400">...</span>
                      ) : (
                        <button
                          key={p}
                          onClick={() => setCurrentPage(p)}
                          className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors ${
                            p === clampedPage ? 'bg-teal-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          {p}
                        </button>
                      )
                    )}
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={clampedPage >= totalPages}
                    className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed text-slate-600"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title="Новый запрос на выплату">
        <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
          <div>
            <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">Сумма *</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="0.00"
              autoFocus
            />
          </div>
          <div className="hidden">
            <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">Счёт *</label>
            <SearchableSelect
              value={accountId}
              onChange={setAccountId}
              placeholder="— Выберите счёт —"
              options={accountOptions}
              required
            />
          </div>
          <div>
            <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">Статья расхода</label>
            <SearchableSelect
              value={categoryId}
              onChange={setCategoryId}
              placeholder="— Не указана —"
              options={categoryOptions}
            />
          </div>
          <div>
            <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">Студия</label>
            <SearchableSelect
              value={studioId}
              onChange={setStudioId}
              placeholder="— Не указана —"
              options={studioOptions}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">Дата оплаты</label>
              <DatePicker
                value={paymentDate}
                onChange={setPaymentDate}
                placeholder="Выберите дату"
              />
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">Дата начисления</label>
              <DatePicker
                value={accrualDate}
                onChange={setAccrualDate}
                placeholder="Выберите дату"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">Описание</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
              rows={3}
              placeholder="Опишите за что нужна выплата..."
            />
          </div>
          {error && <p className="text-xs sm:text-sm text-rose-600">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setShowForm(false)} className="flex-1 px-3 py-2.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-200">Отмена</button>
            <button type="submit" disabled={loading} className="flex-1 px-3 py-2.5 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 flex items-center justify-center gap-1.5 font-medium">
              <Send size={14} /> {loading ? 'Отправка...' : 'Отправить'}
            </button>
          </div>
        </form>
      </Modal>

      {showNewContractor && (
        <NewContractorModal
          onClose={() => setShowNewContractor(false)}
          onCreated={handleContractorCreated}
        />
      )}

      {showPayModal !== null && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/30 p-0 sm:p-4" onClick={() => setShowPayModal(null)}>
          <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-2xl w-full sm:max-w-md p-4 sm:p-5 safe-area-bottom" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-800">Подтверждение оплаты</h3>
              <button onClick={() => setShowPayModal(null)} className="text-slate-400 hover:text-slate-600 p-1"><X size={18} /></button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Счёт оплаты *</label>
                <SearchableSelect
                  value={payAccountId}
                  onChange={setPayAccountId}
                  placeholder="— Выберите счёт —"
                  options={accountOptions}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Факт. сумма *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={payAmount}
                    onChange={e => setPayAmount(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Факт. дата *</label>
                  <DatePicker
                    value={payDate}
                    onChange={setPayDate}
                    placeholder="Выберите дату"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Комментарий</label>
                <textarea
                  value={payComment}
                  onChange={e => setPayComment(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                  rows={2}
                  placeholder="Комментарий к оплате..."
                />
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <button type="button" onClick={() => setShowPayModal(null)} className="flex-1 px-3 py-2.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-200">Отмена</button>
              <button
                type="button"
                onClick={handlePayConfirm}
                disabled={!payAccountId || !payAmount || !payDate}
                className="flex-1 px-3 py-2.5 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-1.5 font-medium active:scale-95 transition-all"
              >
                <CheckCircle2 size={14} /> Оплатить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return content;
};
