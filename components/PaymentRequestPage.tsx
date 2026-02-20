import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useFinance } from '../context/FinanceContext';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';
import { Plus, Clock, CheckCircle2, XCircle, LogOut, Send, ChevronDown, ChevronRight } from 'lucide-react';
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

export const PaymentRequestPage: React.FC<PaymentRequestPageProps> = ({ isAdmin = false, isModal = false }) => {
  const { user, logout } = useAuth();
  const { categories, studios, contractors } = useFinance();
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
    const result: { id: string; label: string }[] = [];
    const addChildren = (parentId: string | null, depth: number) => {
      const items = filtered.filter(c => depth === 0 ? !c.parentId : c.parentId === parentId);
      items.forEach(item => {
        if (!hasChildren(item.id)) {
          result.push({ id: item.id, label: '\u00A0\u00A0'.repeat(depth) + item.name });
        }
        addChildren(item.id, depth + 1);
      });
    };
    addChildren(null, 0);
    return result;
  }, [categories]);

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
            { value: 'rejected', label: 'Отклонённые' },
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
            <select
              value={categoryId}
              onChange={e => setCategoryId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:border-teal-500"
            >
              <option value="">— Не указана —</option>
              {categoryOptions.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Студия</label>
            <select
              value={studioId}
              onChange={e => setStudioId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:border-teal-500"
            >
              <option value="">— Не указана —</option>
              {studios.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Контрагент</label>
            <select
              value={contractorId}
              onChange={e => setContractorId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:border-teal-500"
            >
              <option value="">— Не указан —</option>
              {contractors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
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
    </div>
  );

  return content;
};
