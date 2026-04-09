import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext';
import { useFinance } from '../context/FinanceContext';
import { getMoscowNow } from '../utils/moscow';

import {
  LogOut, Send, Search, ChevronDown, Check, Plus, Clock,
  User, Phone, Edit2, Trash2, X, AlertCircle, ArrowLeft,
  CheckCircle2, Loader2, Calendar, Banknote, ChevronRight, ChevronLeft,
  BarChart3
} from 'lucide-react';
import { formatCurrency, formatDate } from '../utils/format';
import { MasterDashboard } from './MasterDashboard';

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
  services: { title: string; amount: number; paidByAbonement?: boolean }[];
  goods: { title: string; amount: number; cost?: number }[];
  totalAmount: number;
  date: string;
  time?: string;
  staffName?: string;
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
  { id: 'installment', label: 'Рассрочка' },
  { id: 'visit_only', label: 'Абонемент' },
];

const CLIENT_TYPES = [
  { id: 'primary', label: 'Первичный' },
  { id: 'regular', label: 'Постоянный' },
];

const ARTICLE_BUTTONS = [
  { id: 'promo', label: 'По акции', categoryId: '4', visibility: 'all' },
  { id: 'price', label: 'По прайсу', categoryId: '5', visibility: 'all' },
  { id: 'prepay', label: 'Предоплата', categoryId: '6', visibility: 'all' },
  { id: 'sale', label: 'Продажа', categoryId: null, visibility: 'primary' },
  { id: 'upsale', label: 'Допродажа', categoryId: null, visibility: 'regular' },
  { id: 'surcharge', label: 'Доплата', categoryId: '11', visibility: 'regular' },
] as const;

type Step = 'schedule' | 'entries';

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

  const [mainTab, setMainTab] = useState<'income' | 'dashboard'>('income');
  const [step, setStep] = useState<Step>('schedule');

  const [clientPhone, setClientPhone] = useState('');
  const [clientFirstName, setClientFirstName] = useState('');
  const [clientLastName, setClientLastName] = useState('');
  const [clientType, setClientType] = useState<'primary' | 'regular'>('primary');
  const [selectedVisit, setSelectedVisit] = useState<YCVisit | null>(null);
  const [ycClientId, setYcClientId] = useState<number | null>(null);
  const [lastNameWasEmpty, setLastNameWasEmpty] = useState(false);

  const [scheduleVisits, setScheduleVisits] = useState<YCVisit[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [todayTotal, setTodayTotal] = useState(0);
  const [recordedPhones, setRecordedPhones] = useState<string[]>([]);
  const [recordedRecordIds, setRecordedRecordIds] = useState<string[]>([]);


  const [entries, setEntries] = useState<IncomeEntry[]>([newEntry()]);
  const [submitting, setSubmitting] = useState(false);
  const [submitResults, setSubmitResults] = useState<{ success: boolean; msg: string; ycWarning?: boolean }[]>([]);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const [historyPage, setHistoryPage] = useState(1);
  const HISTORY_PAGE_SIZE = 10;

  interface YcFormSettings {
    commentEnabled: boolean;
    commentEditable: boolean;
    fields: { id: string; label: string; ycFieldId: string; ycFieldCode?: string; target: 'record' | 'client'; enabled: boolean; editable: boolean }[];
  }
  interface YcRecordData {
    comment: string;
    recordCustomFields: { id: number; title: string; value: string }[];
    clientCustomFields: { id: number; title: string; value: string }[];
  }

  const [ycFormSettings, setYcFormSettings] = useState<YcFormSettings | null>(null);
  const [ycRecordData, setYcRecordData] = useState<YcRecordData | null>(null);
  const [ycRecordLoading, setYcRecordLoading] = useState(false);
  const [ycComment, setYcComment] = useState('');
  const [ycFieldValues, setYcFieldValues] = useState<Record<string, string>>({});
  const [ycSectionOpen, setYcSectionOpen] = useState(true);
  const ycSectionRef = useRef<HTMLDivElement>(null);
  const [ycClientTypeLoading, setYcClientTypeLoading] = useState(false);

  const [forDate, setForDate] = useState<'today' | 'yesterday'>('today');

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

  const fetchSchedule = useCallback(async (dateParam?: 'today' | 'yesterday') => {
    if (!user) return;
    setScheduleLoading(true);
    setScheduleError(null);
    const d = dateParam ?? forDate;
    try {
      const url = d === 'yesterday'
        ? '/api/yclients/today-schedule?date=yesterday'
        : '/api/yclients/today-schedule';
      const res = await fetch(url, {
        headers: { 'x-user-id': String(user.id) },
      });
      if (!res.ok) throw new Error('Ошибка загрузки');
      const data = await res.json();
      setScheduleVisits(data.visits || []);
      setTodayTotal(data.todayTotal || 0);
      setRecordedPhones(data.recordedPhones || []);
      setRecordedRecordIds(data.recordedRecordIds || []);
    } catch {
      setScheduleError('Не удалось загрузить расписание');
    } finally {
      setScheduleLoading(false);
    }
  }, [user, forDate]);

  useEffect(() => { fetchIncomes(); fetchSchedule(); }, [fetchIncomes, fetchSchedule]);

  useEffect(() => {
    fetch('/api/yclients/form-settings')
      .then(r => r.json())
      .then(d => setYcFormSettings(d))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!ycRecordData) return;
    const hasComment = !!(ycRecordData.comment);
    const hasFields = (ycRecordData.recordCustomFields || []).some((f: { value?: string }) => f.value) ||
                      (ycRecordData.clientCustomFields || []).some((f: { value?: string }) => f.value);
    if (hasComment || hasFields) {
      setYcSectionOpen(true);
      setTimeout(() => {
        ycSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 100);
    }
  }, [ycRecordData]);

  const fetchYcRecordData = async (recordId: string, clientId: number | null) => {
    setYcRecordLoading(true);
    setYcRecordData(null);
    setYcComment('');
    setYcFieldValues({});
    try {
      const params = new URLSearchParams();
      if (recordId) params.set('recordId', recordId);
      if (clientId) params.set('clientId', String(clientId));
      const res = await fetch(`/api/yclients/record-details?${params.toString()}`, {
        headers: { 'x-user-id': String(user?.id || '') },
      });
      if (res.ok) {
        const data = await res.json();
        setYcRecordData(data);
        setYcComment(data.comment || '');
        const vals: Record<string, string> = {};
        (data.recordCustomFields || []).forEach((f: { id: number; code?: string; value: string }) => {
          const val = f.value || '';
          vals[`record_${f.id}`] = val;
          if (f.code) vals[`record_code_${f.code}`] = val;
        });
        (data.clientCustomFields || []).forEach((f: { id: number; code?: string; value: string }) => {
          const val = f.value || '';
          vals[`client_${f.id}`] = val;
          if (f.code) vals[`client_code_${f.code}`] = val;
        });
        setYcFieldValues(vals);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('fetchYcRecordData error:', msg);
    } finally {
      setYcRecordLoading(false);
    }
  };

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


  const handleSelectVisit = (visit: YCVisit) => {
    setSelectedVisit(visit);
    setYcClientId(visit.clientId);
    setClientPhone(visit.clientPhone || '');
    setClientFirstName(visit.clientFirstName || '');
    setClientLastName(visit.clientLastName || '');
    setLastNameWasEmpty(!visit.clientLastName);
    setClientType('primary');
    setEntries([newEntry()]);
    setDone(false);
    setSubmitResults([]);
    setGlobalError(null);
    setYcRecordData(null);
    setYcComment('');
    setYcFieldValues({});
    setStep('entries');
    if (ycFormSettings && (ycFormSettings.commentEnabled || (ycFormSettings.fields ?? []).some(f => f.enabled))) {
      fetchYcRecordData(visit.recordIds[0], visit.clientId);
    }
    if (visit.clientId) {
      setYcClientTypeLoading(true);
      fetch(`/api/yclients/client-type?clientId=${visit.clientId}`, {
        headers: { 'x-user-id': String(user?.id || '') },
      })
        .then(r => r.json())
        .then(d => { if (d.clientType) setClientType(d.clientType); })
        .catch(() => {})
        .finally(() => setYcClientTypeLoading(false));
    }
  };

  const handleSkipVisit = () => {
    setSelectedVisit(null);
    setYcClientId(null);
    setLastNameWasEmpty(false);
    setClientPhone('');
    setClientFirstName('');
    setClientLastName('');
    setStep('entries');
  };

  const handleBackToSchedule = () => {
    setStep('schedule');
    setSelectedVisit(null);
    setYcClientId(null);
    setLastNameWasEmpty(false);
    setDone(false);
    setSubmitResults([]);
    setGlobalError(null);
    setEntries([newEntry()]);
    fetchSchedule();
  };

  const addEntry = () => setEntries(prev => [...prev, newEntry()]);
  const removeEntry = (tempId: string) => setEntries(prev => prev.filter(e => e.tempId !== tempId));
  const updateEntry = (tempId: string, field: keyof IncomeEntry, value: string) => {
    setEntries(prev => prev.map(e => e.tempId === tempId ? { ...e, [field]: value } : e));
  };

  const clientFullName = [clientLastName.trim(), clientFirstName.trim()].filter(Boolean).join(' ');
  const isZeroAmountVisit = selectedVisit && selectedVisit.totalAmount === 0;

  const handleMarkVisitOnly = async () => {
    setGlobalError(null);
    setSubmitting(true);

    if (ycClientId && lastNameWasEmpty && clientLastName.trim()) {
      try {
        await fetch('/api/yclients/update-client', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'x-user-id': String(user?.id || '') },
          body: JSON.stringify({ clientId: ycClientId, name: clientFirstName.trim(), surname: clientLastName.trim() }),
        });
      } catch {}
    }

    let yclientsDataSnapshot: Record<string, unknown> | null = null;
    if (selectedVisit) {
      yclientsDataSnapshot = {
        recordIds: selectedVisit.recordIds,
        visitId: selectedVisit.visitId,
        clientId: selectedVisit.clientId,
        services: selectedVisit.services,
        goods: selectedVisit.goods,
      };
    }

    try {
      const res = await fetch('/api/master-incomes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': String(user?.id || '') },
        body: JSON.stringify({
          amount: 0,
          paymentType: 'visit_only',
          clientName: clientFullName || clientFirstName.trim(),
          clientPhone,
          clientType,
          description: 'Визит без оплаты',
          visitOnly: true,
          ...(yclientsDataSnapshot ? { yclientsData: yclientsDataSnapshot } : {}),
        }),
      });
      if (res.ok) {
        setSubmitResults([{ success: true, msg: 'Визит отмечен' }]);
      } else {
        const data = await res.json().catch(() => null);
        setSubmitResults([{ success: false, msg: data?.error || 'Ошибка' }]);
      }
    } catch {
      setSubmitResults([{ success: false, msg: 'Ошибка сети' }]);
    }
    setSubmitting(false);
    setDone(true);
    setHistoryPage(1);
    fetchIncomes();
  };

  const handleSubmitAll = async () => {
    const errs: string[] = [];
    entries.forEach((e, i) => {
      if (!e.amount || parseFloat(e.amount) <= 0) errs.push(`Поступление ${i + 1}: введите сумму`);
      if (!e.paymentType) errs.push(`Поступление ${i + 1}: выберите тип оплаты`);
      if (!e.categoryId) errs.push(`Поступление ${i + 1}: выберите статью`);
    });
    if (errs.length > 0) { setGlobalError(errs.join(' · ')); return; }
    setGlobalError(null);
    setSubmitting(true);

    if (ycClientId && lastNameWasEmpty && clientLastName.trim()) {
      try {
        await fetch('/api/yclients/update-client', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'x-user-id': String(user?.id || '') },
          body: JSON.stringify({ clientId: ycClientId, name: clientFirstName.trim(), surname: clientLastName.trim() }),
        });
      } catch {
        console.error('Failed to update YClients client surname');
      }
    }

    let yclientsDataSnapshot: Record<string, unknown> | null = null;
    if (selectedVisit) {
      yclientsDataSnapshot = {
        recordIds: selectedVisit.recordIds,
        visitId: selectedVisit.visitId,
        clientId: selectedVisit.clientId,
        services: selectedVisit.services,
        goods: selectedVisit.goods,
      };
    }
    if (selectedVisit && ycRecordData !== null && ycFormSettings) {
      try {
        const recordId = selectedVisit.recordIds[0];
        const originalComment = ycRecordData.comment || '';
        const commentChanged = ycFormSettings.commentEditable && ycComment !== originalComment;

        const recordFields: { id: number; code?: string; value: string }[] = [];
        const clientFields: { id: number; code?: string; value: string }[] = [];
        ycFormSettings.fields.filter(f => f.enabled && f.editable).forEach(f => {
          const numId = parseInt(f.ycFieldId);
          if (!numId) return;
          const key = f.ycFieldCode ? `${f.target}_code_${f.ycFieldCode}` : `${f.target}_${numId}`;
          const newVal = ycFieldValues[key] ?? '';
          const sourceFields = f.target === 'record'
            ? (ycRecordData.recordCustomFields as { id: number; code?: string; value?: string }[])
            : (ycRecordData.clientCustomFields as { id: number; code?: string; value?: string }[]);
          const original = f.ycFieldCode
            ? (sourceFields.find(x => x.code === f.ycFieldCode)?.value || '')
            : (sourceFields.find(x => x.id === numId)?.value || '');
          if (newVal !== original) {
            const entry: { id: number; code?: string; value: string } = { id: numId, value: newVal };
            if (f.ycFieldCode) entry.code = f.ycFieldCode;
            if (f.target === 'record') recordFields.push(entry);
            else clientFields.push(entry);
          }
        });

        if (commentChanged || recordFields.length > 0 || clientFields.length > 0) {
          await fetch('/api/yclients/update-record', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'x-user-id': String(user?.id || '') },
            body: JSON.stringify({
              recordId,
              clientId: ycClientId,
              ...(commentChanged ? { comment: ycComment } : {}),
              recordCustomFields: recordFields,
              clientCustomFields: clientFields,
            }),
          });
        }

        // Snapshot of all visible field values for DB storage
        const fieldSnapshot = ycFormSettings.fields.filter(f => f.enabled).map(f => {
          const numId = parseInt(f.ycFieldId);
          const key = f.ycFieldCode ? `${f.target}_code_${f.ycFieldCode}` : `${f.target}_${numId}`;
          return { label: f.label, id: f.ycFieldId, target: f.target, value: ycFieldValues[key] ?? '' };
        });
        yclientsDataSnapshot = {
          ...yclientsDataSnapshot,
          recordId,
          comment: ycFormSettings.commentEnabled ? ycComment : undefined,
          fields: fieldSnapshot,
        };
      } catch (err) {
        console.error('Failed to update YClients record data:', err);
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
            ...(yclientsDataSnapshot ? { yclientsData: yclientsDataSnapshot } : {}),
            ...(forDate === 'yesterday' ? { forDate: 'yesterday' } : {}),
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
    setStep('schedule');
    setClientPhone('');
    setClientFirstName('');
    setClientLastName('');
    setClientType('primary');
    setSelectedVisit(null);
    setYcClientId(null);
    setLastNameWasEmpty(false);
    setEntries([newEntry()]);
    setSubmitResults([]);
    setGlobalError(null);
    setDone(false);
    setYcRecordData(null);
    setYcComment('');
    setYcFieldValues({});
    setForDate('today');
    fetchSchedule();
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
    const now = getMoscowNow();
    return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  };

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
        <div className="max-w-2xl mx-auto flex border-t border-slate-100">
          <button
            onClick={() => setMainTab('income')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium border-b-2 transition-colors ${mainTab === 'income' ? 'border-teal-600 text-teal-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
          >
            <Calendar size={14} />
            Записи
          </button>
          <button
            onClick={() => setMainTab('dashboard')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium border-b-2 transition-colors ${mainTab === 'dashboard' ? 'border-teal-600 text-teal-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
          >
            <BarChart3 size={14} />
            Показатели
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">

        {mainTab === 'dashboard' ? (
          <MasterDashboard />
        ) : editingIncome ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 flex items-center gap-3 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
              <button onClick={() => setEditingIncome(null)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors">
                <ArrowLeft size={18} />
              </button>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-700">{editingIncome.clientName || '—'}</div>
                <div className="text-xs text-slate-400 font-mono">{formatPhoneDisplay(editingIncome.clientPhone || '')}</div>
              </div>
              <span className={`px-3 py-1.5 rounded-full text-xs font-medium border ${editingIncome.clientType === 'regular' ? 'bg-teal-50 text-teal-700 border-teal-200' : 'bg-orange-50 text-orange-700 border-orange-200'}`}>
                {editingIncome.clientType === 'regular' ? 'Постоянный' : 'Первичный'}
              </span>
            </div>
            <form onSubmit={handleEditSubmit} className="px-4 py-3 space-y-3">
              {editError && (
                <div className="bg-rose-50 border border-rose-200 rounded-lg p-2.5 text-sm text-rose-600">{editError}</div>
              )}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Сумма *</label>
                <input
                  type="number" step="0.01" value={editAmount} onChange={e => setEditAmount(e.target.value)}
                  className="w-full px-3 py-3 border border-slate-300 rounded-xl text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Тип оплаты *</label>
                <div className="flex flex-wrap gap-1.5">
                  {PAYMENT_TYPES.filter(pt => pt.id !== 'visit_only').map(pt => (
                    <button key={pt.id} type="button" onClick={() => setEditPaymentType(pt.id)}
                      className={`px-3 py-2 rounded-full text-xs font-medium border transition-all ${editPaymentType === pt.id ? 'bg-teal-600 text-white border-teal-600 shadow-sm' : 'bg-white text-slate-600 border-slate-300 hover:border-teal-400'}`}>
                      {pt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Статья</label>
                <div className="flex flex-wrap gap-1.5">
                  {ARTICLE_BUTTONS
                    .filter(ab => ab.visibility === 'all' || ab.visibility === (editingIncome?.clientType || clientType))
                    .map(ab => {
                      const isSelected = editCategoryId && (
                        ab.categoryId === editCategoryId ||
                        (ab.id === 'sale' && ['9', '10'].includes(editCategoryId)) ||
                        (ab.id === 'upsale' && ['9', '10'].includes(editCategoryId))
                      );
                      return (
                        <button key={ab.id} type="button"
                          onClick={() => {
                            if (ab.categoryId) {
                              setEditCategoryId(ab.categoryId);
                            } else if (ab.id === 'sale' || ab.id === 'upsale') {
                              setEditCategoryId(editCategoryId === '9' ? '10' : editCategoryId === '10' ? '9' : '9');
                            }
                          }}
                          className={`px-3 py-2 rounded-full text-xs font-medium border transition-all ${isSelected ? 'bg-teal-600 text-white border-teal-600 shadow-sm' : 'bg-white text-slate-600 border-slate-300 hover:border-teal-400'}`}>
                          {ab.label}
                        </button>
                      );
                    })}
                </div>
                {(editCategoryId === '9' || editCategoryId === '10') && (
                  <div className="mt-1.5 flex gap-1.5">
                    <button type="button" onClick={() => setEditCategoryId('9')}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${editCategoryId === '9' ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-slate-500 border-slate-200 hover:border-amber-400'}`}>
                      Первый платёж
                    </button>
                    <button type="button" onClick={() => setEditCategoryId('10')}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${editCategoryId === '10' ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-slate-500 border-slate-200 hover:border-amber-400'}`}>
                      Полная оплата
                    </button>
                  </div>
                )}
                {editCategoryId && (
                  <p className="mt-1 text-xs text-slate-400">
                    Статья: {categoryOptions.find(c => c.id === editCategoryId)?.label?.trim() || editCategoryId}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Комментарий</label>
                <textarea value={editDescription} onChange={e => setEditDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none" rows={2} placeholder="Примечание..." />
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setEditingIncome(null)}
                  className="flex-1 py-2.5 border border-slate-300 rounded-xl text-sm text-slate-600 hover:bg-slate-50 transition-colors">
                  Отмена
                </button>
                <button type="submit" disabled={editSubmitting}
                  className="flex-1 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-semibold hover:bg-teal-700 transition-colors disabled:opacity-50 shadow-md shadow-teal-600/20">
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
                <div key={i}>
                  <div className={`px-4 py-3 flex items-start gap-3 ${r.success ? '' : 'bg-rose-50'}`}>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${r.success ? 'bg-emerald-100' : 'bg-rose-100'}`}>
                      {r.success ? <Check size={11} className="text-emerald-600" /> : <X size={11} className="text-rose-600" />}
                    </div>
                    <div className="text-sm font-medium text-slate-800">{r.msg}</div>
                  </div>
                  {r.ycWarning && (
                    <div className="mx-4 mb-3 flex items-start gap-2.5 bg-amber-50 border border-amber-300 rounded-lg px-3 py-2.5">
                      <AlertCircle size={16} className="text-amber-500 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-sm font-semibold text-amber-800">Проверьте запись в YClients</div>
                        <div className="text-xs text-amber-700 mt-0.5">Сумма поступления не совпадает с суммой в YClients или запись не найдена</div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="p-4 flex gap-2">
              <button onClick={handleBackToSchedule}
                className="flex-1 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors flex items-center justify-center gap-1">
                <Plus size={14} /> Ещё запись
              </button>
              <button onClick={handleStartNew}
                className="flex-1 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-700 transition-colors">
                Новый клиент
              </button>
            </div>
          </div>
        ) : step === 'schedule' ? (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-lg font-bold text-slate-800">
                    {forDate === 'yesterday' ? 'Записи за вчера' : 'Записи на сегодня'}
                  </h1>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {(() => {
                      const d = getMoscowNow();
                      if (forDate === 'yesterday') d.setDate(d.getDate() - 1);
                      return d.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
                    })()}
                  </p>
                </div>
                {todayTotal > 0 && (
                  <div className="text-right">
                    <div className="text-xs text-slate-500">Итого за день</div>
                    <div className="text-sm font-bold text-teal-600">{formatCurrency(todayTotal)}</div>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  const next = forDate === 'today' ? 'yesterday' : 'today';
                  setForDate(next);
                  fetchSchedule(next);
                }}
                className={`mt-2 text-[11px] flex items-center gap-1 transition-colors ${forDate === 'yesterday' ? 'text-amber-600 hover:text-amber-700' : 'text-slate-400 hover:text-slate-500'}`}
              >
                <Clock size={11} />
                {forDate === 'yesterday' ? 'Вернуться к сегодня' : 'Показать вчерашние записи'}
              </button>
            </div>

            {scheduleLoading ? (
              <div className="flex items-center justify-center gap-2 py-12 text-slate-400">
                <Loader2 size={18} className="animate-spin" /> Загрузка расписания...
              </div>
            ) : scheduleError ? (
              <div className="p-4">
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-2 text-sm text-amber-700">
                  <AlertCircle size={15} /> {scheduleError}
                </div>
                <button onClick={fetchSchedule} className="mt-3 w-full py-2.5 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors">
                  Повторить
                </button>
              </div>
            ) : scheduleVisits.length === 0 ? (
              <div className="p-6 text-center">
                <Calendar size={32} className="mx-auto mb-2 text-slate-300" />
                <div className="text-slate-400 text-sm">Записей на сегодня нет</div>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {scheduleVisits.map((visit, i) => {
                  const visitPhone = (visit.clientPhone || '').replace(/\D/g, '').slice(-10);
                  const isRecorded = visit.recordIds.some(rid => recordedRecordIds.includes(rid)) ||
                    (visitPhone.length >= 10 && recordedPhones.includes(visitPhone));
                  const allItems = [...visit.services, ...visit.goods];
                  const isZeroAmount = visit.totalAmount === 0;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleSelectVisit(visit)}
                      className={`w-full text-left px-4 py-3.5 transition-colors flex items-start gap-3 group ${isRecorded ? 'bg-green-50/50' : 'hover:bg-teal-50'}`}
                    >
                      <div className="shrink-0 pt-0.5">
                        <div className="text-sm font-bold text-slate-700 tabular-nums">{visit.time || '—'}</div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-slate-800 text-sm flex items-center gap-1.5">
                          <User size={13} className="text-teal-500 shrink-0" />
                          {visit.clientName || 'Без имени'}
                          {isRecorded && <CheckCircle2 size={14} className="text-green-500 shrink-0" />}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {allItems.slice(0, 3).map((s, si) => {
                            const isAbonement = 'paidByAbonement' in s && s.paidByAbonement;
                            const isGoods = 'cost' in s;
                            return (
                              <span key={si} className={`text-[11px] px-1.5 py-0.5 rounded ${isAbonement ? 'bg-violet-50 text-violet-600' : isGoods ? 'bg-violet-50 text-violet-600' : 'bg-slate-100 text-slate-500'}`}>
                                {(isAbonement || isGoods) ? 'АБ ' : ''}{s.title}
                              </span>
                            );
                          })}
                          {allItems.length > 3 && (
                            <span className="text-[11px] px-1.5 py-0.5 bg-slate-100 text-slate-400 rounded">
                              +{allItems.length - 3}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        {isZeroAmount ? (
                          <div className="text-xs font-medium text-slate-400">0 ₽</div>
                        ) : (
                          <div className="text-sm font-bold text-teal-600">{formatCurrency(visit.totalAmount)}</div>
                        )}
                        {!isRecorded && (
                          <ChevronRight size={16} className="text-slate-300 group-hover:text-teal-500 mt-1 ml-auto transition-colors" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="p-3 border-t border-slate-100">
              <button onClick={handleSkipVisit}
                className="w-full py-2.5 border border-dashed border-slate-300 rounded-lg text-sm text-slate-500 hover:bg-slate-50 hover:border-slate-400 transition-colors flex items-center justify-center gap-1.5">
                <Plus size={14} /> Создать без привязки к записи
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 flex items-center gap-3 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
                <button onClick={handleBackToSchedule} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors">
                  <ArrowLeft size={18} />
                </button>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-700">{formatPhoneDisplay(clientPhone)}</div>
                  {selectedVisit && (
                    <div className="text-[11px] text-teal-600 flex items-center gap-1 mt-0.5">
                      <Check size={10} /> Привязано к YClients
                    </div>
                  )}
                </div>
                {ycClientTypeLoading ? (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-full text-xs text-slate-400">
                    <Loader2 size={11} className="animate-spin" /> ...
                  </div>
                ) : (
                  <button type="button"
                    onClick={() => setClientType(prev => prev === 'regular' ? 'primary' : 'regular')}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${clientType === 'regular' ? 'bg-teal-50 text-teal-700 border-teal-200' : 'bg-orange-50 text-orange-700 border-orange-200'}`}>
                    {CLIENT_TYPES.find(ct => ct.id === clientType)?.label ?? 'Первичный'}
                  </button>
                )}
              </div>

              <div className="px-4 py-3 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Имя</label>
                    <input
                      type="text" value={clientFirstName} onChange={e => setClientFirstName(e.target.value)}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-slate-50 focus:bg-white transition-colors"
                      placeholder="Имя"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">
                      Фамилия
                      {lastNameWasEmpty && !clientLastName.trim() && (
                        <span className="text-amber-500 ml-1">*</span>
                      )}
                    </label>
                    <input
                      type="text" value={clientLastName} onChange={e => setClientLastName(e.target.value)}
                      className={`w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 transition-colors ${lastNameWasEmpty && !clientLastName.trim() ? 'border-amber-300 bg-amber-50/50' : 'border-slate-200 bg-slate-50 focus:bg-white'}`}
                      placeholder="Фамилия"
                      autoFocus={lastNameWasEmpty}
                    />
                  </div>
                </div>
                {lastNameWasEmpty && clientLastName.trim() && ycClientId && (
                  <div className="text-[11px] text-teal-600 flex items-center gap-1">
                    <Check size={10} /> Фамилия сохранится в YClients
                  </div>
                )}
              </div>
            </div>

            {selectedVisit && ycFormSettings && (ycFormSettings.commentEnabled || (ycFormSettings.fields ?? []).some(f => f.enabled)) && (() => {
              const filledCount = ycRecordData
                ? [
                    ycRecordData.comment ? 1 : 0,
                    ...((ycRecordData.recordCustomFields || []) as { value?: string }[]).map(f => f.value ? 1 : 0),
                    ...((ycRecordData.clientCustomFields || []) as { value?: string }[]).map(f => f.value ? 1 : 0),
                  ].reduce((a: number, b: number) => a + b, 0)
                : 0;
              return (
              <div ref={ycSectionRef} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <button
                  type="button"
                  onClick={() => setYcSectionOpen(o => !o)}
                  className="w-full px-4 py-3 flex items-center justify-between bg-slate-50 border-b border-slate-100"
                >
                  <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded bg-teal-100 text-teal-600 text-[10px] flex items-center justify-center font-bold">Y</span>
                    Данные в YClients
                    {filledCount > 0 && (
                      <span className="ml-1 px-1.5 py-0.5 rounded-full bg-teal-500 text-white text-[10px] font-bold leading-none">
                        {filledCount}
                      </span>
                    )}
                  </span>
                  <span className="text-slate-400 text-xs">{ycSectionOpen ? '▲' : '▼'}</span>
                </button>

                {ycSectionOpen && (
                  <div className="px-4 py-3 space-y-3">
                    {ycRecordLoading ? (
                      <div className="text-xs text-slate-400 text-center py-2">Загружаем данные из YClients...</div>
                    ) : (
                      <>
                        {ycFormSettings.commentEnabled && (() => {
                          const originalComment = ycRecordData?.comment || '';
                          const isChanged = ycComment !== originalComment;
                          return (
                            <div>
                              <div className="flex items-center justify-between mb-1.5">
                                <label className="text-xs font-medium text-slate-600">Комментарий к записи</label>
                                {ycFormSettings.commentEditable && isChanged && (
                                  <button
                                    type="button"
                                    onClick={() => setYcComment(originalComment)}
                                    className="text-[10px] text-slate-400 hover:text-rose-500 transition-colors flex items-center gap-0.5"
                                  >
                                    <X size={10} /> сбросить
                                  </button>
                                )}
                              </div>
                              {ycFormSettings.commentEditable ? (
                                <div className={`relative rounded-lg border transition-colors ${isChanged ? 'border-teal-400 ring-1 ring-teal-200' : 'border-slate-300'}`}>
                                  <textarea
                                    ref={el => {
                                      if (el) {
                                        el.style.height = 'auto';
                                        el.style.height = Math.max(el.scrollHeight, 60) + 'px';
                                      }
                                    }}
                                    value={ycComment}
                                    onChange={e => {
                                      setYcComment(e.target.value);
                                      e.target.style.height = 'auto';
                                      e.target.style.height = Math.max(e.target.scrollHeight, 60) + 'px';
                                    }}
                                    className="w-full px-3 py-2.5 text-sm focus:outline-none resize-none bg-transparent rounded-lg"
                                    placeholder="Добавьте комментарий..."
                                    style={{ minHeight: '60px', overflow: 'hidden' }}
                                  />
                                  {isChanged && (
                                    <div className="px-3 pb-2 text-[10px] text-teal-600 font-medium">Изменено</div>
                                  )}
                                  {!isChanged && ycComment.length > 0 && (
                                    <div className="px-3 pb-1.5 text-[10px] text-slate-300">{ycComment.length} симв.</div>
                                  )}
                                </div>
                              ) : (
                                <div className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 leading-relaxed min-h-[44px]">
                                  {ycComment
                                    ? ycComment.split('\n').map((line, i) => <div key={i}>{line || <br />}</div>)
                                    : <span className="text-slate-400 italic text-xs">Нет комментария</span>}
                                </div>
                              )}
                              {ycFormSettings.commentEditable && isChanged && originalComment && (
                                <div className="mt-1.5 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg">
                                  <div className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5 font-medium">Было</div>
                                  <div className="text-xs text-slate-500 leading-relaxed">{originalComment}</div>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                        {ycFormSettings.fields.filter(f => f.enabled).map(f => {
                          const numId = parseInt(f.ycFieldId);
                          const key = f.ycFieldCode ? `${f.target}_code_${f.ycFieldCode}` : `${f.target}_${numId}`;
                          const currentVal = ycFieldValues[key] ?? '';
                          const sourceFields = (f.target === 'record'
                            ? (ycRecordData?.recordCustomFields || [])
                            : (ycRecordData?.clientCustomFields || [])) as { id: number; code?: string; value?: string }[];
                          const ycField = f.ycFieldCode
                            ? sourceFields.find(x => x.code === f.ycFieldCode)
                            : sourceFields.find(x => x.id === numId);
                          return (
                            <div key={f.id}>
                              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                                {f.label}
                              </label>
                              {f.editable ? (
                                <input
                                  type="text"
                                  value={currentVal}
                                  onChange={e => setYcFieldValues(v => ({ ...v, [key]: e.target.value }))}
                                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                                  placeholder={ycField ? `Сейчас: ${ycField.value}` : 'Нет значения'}
                                />
                              ) : (
                                <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600">
                                  {currentVal || <span className="text-slate-400 italic">Нет значения</span>}
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {!ycRecordData && !ycRecordLoading && (
                          <div className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                            Данные YClients недоступны — не сохранено в YClients
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
              );
            })()}

            {globalError && (
              <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-sm text-rose-600">
                {globalError}
              </div>
            )}

            {isZeroAmountVisit ? (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto">
                    <User size={20} className="text-slate-400" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-700">Визит без оплаты</div>
                    <div className="text-xs text-slate-500 mt-1 space-y-0.5">
                      {selectedVisit && selectedVisit.services.map((s, i) => (
                        <span key={i} className={`inline-block mr-1 px-1.5 py-0.5 rounded ${s.paidByAbonement ? 'bg-violet-50 text-violet-600' : 'bg-slate-100 text-slate-500'}`}>
                          {s.paidByAbonement ? '📋 ' : ''}{s.title}
                        </span>
                      ))}
                      {selectedVisit && selectedVisit.goods.map((g, i) => (
                        <span key={`g${i}`} className="inline-block mr-1 px-1.5 py-0.5 rounded bg-teal-50 text-teal-600">
                          🎫 {g.title}
                        </span>
                      ))}
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      {selectedVisit?.services.some(s => s.paidByAbonement) ? 'Оплачено абонементом' : 'Бесплатная процедура'}
                    </div>
                  </div>
                  <button
                    onClick={handleMarkVisitOnly}
                    disabled={submitting}
                    className="w-full py-3.5 bg-teal-600 text-white rounded-xl font-bold text-sm hover:bg-teal-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-teal-600/20"
                  >
                    {submitting ? (
                      <><Loader2 size={16} className="animate-spin" /> Отмечаем...</>
                    ) : (
                      <><CheckCircle2 size={16} /> Отметить визит</>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <>
                {entries.map((entry, idx) => (
                  <div key={entry.tempId} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    {entries.length > 1 && (
                      <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-400">Оплата {idx + 1}</span>
                        <button onClick={() => removeEntry(entry.tempId)} className="text-slate-300 hover:text-rose-500 transition-colors p-1">
                          <X size={14} />
                        </button>
                      </div>
                    )}
                    <div className="p-4 space-y-4">
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Сумма</label>
                        <input
                          type="number" step="0.01" value={entry.amount}
                          onChange={e => updateEntry(entry.tempId, 'amount', e.target.value)}
                          className="w-full px-4 py-3 border border-slate-200 rounded-xl text-lg font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-slate-50 focus:bg-white transition-colors placeholder:text-slate-300 placeholder:font-normal"
                          placeholder="0" autoFocus={idx === entries.length - 1 && idx > 0}
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-slate-500 mb-1.5">Способ оплаты</label>
                        <div className="flex flex-wrap gap-1.5">
                          {PAYMENT_TYPES.filter(pt => pt.id !== 'visit_only').map(pt => (
                            <button key={pt.id} type="button" onClick={() => updateEntry(entry.tempId, 'paymentType', pt.id)}
                              className={`px-3.5 py-2 rounded-xl text-xs font-medium border transition-all ${entry.paymentType === pt.id ? 'bg-teal-600 text-white border-teal-600 shadow-sm' : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-teal-300 hover:bg-teal-50'}`}>
                              {pt.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs text-slate-500 mb-1.5">Статья</label>
                        <div className="flex flex-wrap gap-1.5">
                          {ARTICLE_BUTTONS
                            .filter(ab => ab.visibility === 'all' || ab.visibility === clientType)
                            .map(ab => {
                              const isSelected = entry.categoryId && (
                                ab.categoryId === entry.categoryId ||
                                (ab.id === 'sale' && ['9', '10'].includes(entry.categoryId)) ||
                                (ab.id === 'upsale' && ['9', '10'].includes(entry.categoryId))
                              );
                              return (
                                <button key={ab.id} type="button"
                                  onClick={() => {
                                    if (ab.categoryId) {
                                      updateEntry(entry.tempId, 'categoryId', ab.categoryId);
                                    } else if (ab.id === 'sale' || ab.id === 'upsale') {
                                      updateEntry(entry.tempId, 'categoryId', entry.categoryId === '9' ? '10' : entry.categoryId === '10' ? '9' : '9');
                                    }
                                  }}
                                  className={`px-3.5 py-2 rounded-xl text-xs font-medium border transition-all ${isSelected ? 'bg-teal-600 text-white border-teal-600 shadow-sm' : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-teal-300 hover:bg-teal-50'}`}>
                                  {ab.label}
                                </button>
                              );
                            })}
                        </div>
                        {(entry.categoryId === '9' || entry.categoryId === '10') && (
                          <div className="mt-2 flex gap-1.5">
                            <button type="button" onClick={() => updateEntry(entry.tempId, 'categoryId', '9')}
                              className={`flex-1 py-2 rounded-xl text-xs font-medium border transition-all ${entry.categoryId === '9' ? 'bg-amber-500 text-white border-amber-500 shadow-sm' : 'bg-white text-slate-500 border-slate-200 hover:border-amber-300'}`}>
                              Первый платёж
                            </button>
                            <button type="button" onClick={() => updateEntry(entry.tempId, 'categoryId', '10')}
                              className={`flex-1 py-2 rounded-xl text-xs font-medium border transition-all ${entry.categoryId === '10' ? 'bg-amber-500 text-white border-amber-500 shadow-sm' : 'bg-white text-slate-500 border-slate-200 hover:border-amber-300'}`}>
                              Полная оплата
                            </button>
                          </div>
                        )}
                        {entry.categoryId && (
                          <p className="mt-1.5 text-[11px] text-slate-400">
                            {categoryOptions.find(c => c.id === entry.categoryId)?.label?.trim() || ''}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Комментарий</label>
                        <input
                          type="text" value={entry.description}
                          onChange={e => updateEntry(entry.tempId, 'description', e.target.value)}
                          className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-slate-50 focus:bg-white transition-colors"
                          placeholder="Необязательно"
                        />
                      </div>
                    </div>
                  </div>
                ))}

                <button
                  onClick={addEntry}
                  className="w-full py-3 border-2 border-dashed border-slate-200 rounded-2xl text-sm text-slate-400 hover:border-teal-300 hover:text-teal-600 hover:bg-teal-50/50 transition-all flex items-center justify-center gap-2"
                >
                  <Plus size={15} /> Ещё оплата
                </button>

                {forDate === 'yesterday' && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-700">
                    <Clock size={11} />
                    Запись за {(() => { const d = getMoscowNow(); d.setDate(d.getDate() - 1); return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }); })()}
                  </div>
                )}

                <button
                  onClick={handleSubmitAll}
                  disabled={submitting}
                  className={`w-full py-4 text-white rounded-2xl font-bold text-base transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg ${forDate === 'yesterday' ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20' : 'bg-teal-600 hover:bg-teal-700 shadow-teal-600/20'}`}
                >
                  {submitting ? (
                    <><Loader2 size={18} className="animate-spin" /> Сохраняем...</>
                  ) : forDate === 'yesterday' ? (
                    <>Сохранить за вчера</>
                  ) : (
                    <>Сохранить</>
                  )}
                </button>
              </>
            )}
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

            const now = getMoscowNow();
            const fmtLocal = (dt: Date) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
            const todayStr = fmtLocal(now);
            const yest = new Date(now); yest.setDate(yest.getDate() - 1);
            const yesterdayStr = fmtLocal(yest);

            const dateLabel = (dateStr: string) => {
              const d = new Date(dateStr);
              const ds = fmtLocal(d);
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
                              {inc.clientPhone && <><span>·</span><span className="font-mono">{formatPhoneDisplay(inc.clientPhone)}</span></>}
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
