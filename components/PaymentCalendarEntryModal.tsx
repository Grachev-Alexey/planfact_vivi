import React, { useState } from 'react';
import { X, ArrowRight, Scissors, ThumbsUp, CreditCard, Pencil, Check, ChevronLeft } from 'lucide-react';

interface PREntry {
  id: number;
  amount: number;
  status: 'pending' | 'approved' | 'paid' | 'verified';
  description: string;
  username: string;
  contractorName: string;
  paymentDate: string | null;
  accrualDate: string | null;
}

interface Props {
  catName: string;
  day: number;
  month: number;
  year: number;
  entries: PREntry[];
  userId: number | string;
  onClose: () => void;
  onRefresh: () => void;
  onSuccess?: (message: string, type?: 'success' | 'error') => void;
}

const STATUS_CFG: Record<string, { label: string; pill: string; dot: string }> = {
  pending:  { label: 'Ожидает',    pill: 'bg-amber-100 text-amber-700',     dot: 'bg-amber-500'    },
  approved: { label: 'Утверждено', pill: 'bg-sky-100 text-sky-700',         dot: 'bg-sky-500'      },
  paid:     { label: 'Оплачено',   pill: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500'  },
  verified: { label: 'Проверено',  pill: 'bg-teal-100 text-teal-700',       dot: 'bg-teal-500'     },
};

const MONTH_NAMES_GEN = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];

function fmtFull(v: number) {
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(v);
}

function pluralOp(n: number) {
  if (n % 10 === 1 && n % 100 !== 11) return 'операция';
  if ([2,3,4].includes(n % 10) && ![12,13,14].includes(n % 100)) return 'операции';
  return 'операций';
}

type ActionMode = { entryId: number; type: 'move' } | { entryId: number; type: 'split' } | { entryId: number; type: 'edit' };

export const PaymentCalendarEntryModal: React.FC<Props> = ({
  catName, day, month, year, entries, userId, onClose, onRefresh, onSuccess,
}) => {
  const defaultDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const [action, setAction] = useState<ActionMode | null>(null);
  const [moveDate, setMoveDate] = useState(defaultDate);
  const [splitParts, setSplitParts] = useState<{ amount: string; date: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [statusBusy, setStatusBusy] = useState<number | null>(null);

  // Edit form state
  const [editAmount, setEditAmount] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPaymentDate, setEditPaymentDate] = useState('');
  const [editAccrualDate, setEditAccrualDate] = useState('');

  const activeEntry = action ? entries.find(e => e.id === action.entryId) : null;

  const splitTotal = splitParts.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
  const splitRemainder = activeEntry ? Math.round((activeEntry.amount - splitTotal) * 100) / 100 : 0;
  const splitValid = activeEntry && Math.abs(splitRemainder) < 0.01 && splitParts.every(p => parseFloat(p.amount) > 0 && p.date);

  function openMove(id: number) { setAction({ entryId: id, type: 'move' }); setMoveDate(defaultDate); setErr(''); }

  function openSplit(entry: PREntry) {
    setAction({ entryId: entry.id, type: 'split' });
    const half = Math.floor(entry.amount / 2);
    setSplitParts([{ amount: String(half), date: defaultDate }, { amount: String(entry.amount - half), date: defaultDate }]);
    setErr('');
  }

  function openEdit(entry: PREntry) {
    setAction({ entryId: entry.id, type: 'edit' });
    setEditAmount(String(entry.amount));
    setEditDescription(entry.description);
    setEditPaymentDate(entry.paymentDate ?? defaultDate);
    setEditAccrualDate(entry.accrualDate ?? '');
    setErr('');
  }

  function updatePart(i: number, field: 'amount' | 'date', val: string) {
    setSplitParts(prev => prev.map((p, idx) => idx === i ? { ...p, [field]: val } : p));
  }

  function addPart() { setSplitParts(prev => [...prev, { amount: '', date: defaultDate }]); }
  function removePart(i: number) { setSplitParts(prev => prev.filter((_, idx) => idx !== i)); }
  function cancelAction() { setAction(null); setErr(''); }

  async function handleStatusChange(entryId: number, newStatus: 'approved' | 'paid' | 'verified') {
    setStatusBusy(entryId);
    try {
      const r = await fetch(`/api/payment-requests/${entryId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-user-id': String(userId) },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!r.ok) throw new Error();
      onSuccess?.(newStatus === 'approved' ? 'Запрос утверждён' : newStatus === 'paid' ? 'Запрос оплачен' : 'Отмечено как проверено');
      onClose(); onRefresh();
    } catch {
      onSuccess?.('Не удалось изменить статус', 'error');
    } finally {
      setStatusBusy(null);
    }
  }

  async function handleMove() {
    if (!action || action.type !== 'move' || !moveDate) return;
    setBusy(true); setErr('');
    try {
      const r = await fetch('/api/payment-calendar/move-payment', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-user-id': String(userId) },
        body: JSON.stringify({ ids: [action.entryId], newDate: moveDate }),
      });
      if (!r.ok) throw new Error('Ошибка сервера');
      onClose();
      onSuccess?.(`Перенесено на ${moveDate.split('-').reverse().slice(0, 2).join('.')}`);
      onRefresh();
    } catch (e: any) { setErr(e.message || 'Ошибка'); setBusy(false); }
  }

  async function handleSplit() {
    if (!action || action.type !== 'split') return;
    if (!splitValid) { setErr('Суммы частей должны в точности совпадать с исходной суммой'); return; }
    setBusy(true); setErr('');
    try {
      const r = await fetch('/api/payment-calendar/split-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': String(userId) },
        body: JSON.stringify({ id: action.entryId, parts: splitParts.map(p => ({ amount: parseFloat(p.amount), date: p.date })) }),
      });
      if (!r.ok) { const b = await r.json().catch(() => ({})); throw new Error(b.error || 'Ошибка сервера'); }
      onClose(); onSuccess?.(`Разбито на ${splitParts.length} части`); onRefresh();
    } catch (e: any) { setErr(e.message || 'Ошибка'); }
    finally { setBusy(false); }
  }

  async function handleEdit() {
    if (!action || action.type !== 'edit') return;
    setBusy(true); setErr('');
    try {
      const r = await fetch(`/api/payment-requests/${action.entryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-user-id': String(userId) },
        body: JSON.stringify({
          amount: editAmount,
          description: editDescription,
          paymentDate: editPaymentDate,
          accrualDate: editAccrualDate || null,
        }),
      });
      if (!r.ok) throw new Error('Ошибка сервера');
      onClose(); onSuccess?.('Изменения сохранены'); onRefresh();
    } catch (e: any) { setErr(e.message || 'Ошибка'); }
    finally { setBusy(false); }
  }

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center"
      style={{ background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(3px)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 flex flex-col"
        style={{ maxHeight: '88vh', animation: 'tooltip-in 0.15s ease-out' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-start justify-between bg-slate-50 rounded-t-2xl flex-shrink-0">
          <div>
            <div className="text-[13px] font-bold text-slate-700 leading-tight">{catName}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {day} {MONTH_NAMES_GEN[month - 1]} {year} · {entries.length} {pluralOp(entries.length)}
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-200 transition-colors ml-2 flex-shrink-0">
            <X size={15} />
          </button>
        </div>

        {/* Entries */}
        <div className="overflow-y-auto flex-1 divide-y divide-slate-100">
          {entries.map(entry => {
            const cfg = STATUS_CFG[entry.status];
            const isActive = action?.entryId === entry.id;
            const isEdit = isActive && action?.type === 'edit';
            const isMove = isActive && action?.type === 'move';
            const isSplit = isActive && action?.type === 'split';

            return (
              <div key={entry.id} className={`px-5 py-4 ${isActive ? 'bg-slate-50/80' : ''}`}>

                {/* Amount + status + edit */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="text-xl font-bold text-slate-800 tabular-nums leading-tight">
                      {fmtFull(entry.amount)}
                    </div>
                    {entry.contractorName && (
                      <div className="text-[11px] text-slate-500 mt-0.5">{entry.contractorName}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full ${cfg.pill}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                      {cfg.label}
                    </span>
                    {!isActive && (
                      <button
                        onClick={() => openEdit(entry)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                        title="Редактировать"
                      >
                        <Pencil size={13} />
                      </button>
                    )}
                    {isActive && (
                      <button
                        onClick={cancelAction}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                        title="Отмена"
                      >
                        <ChevronLeft size={13} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Description (view mode) */}
                {!isEdit && entry.description && (
                  <p className="text-[12px] text-slate-600 mb-3 leading-relaxed bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
                    {entry.description}
                  </p>
                )}

                {/* Dates (view mode) */}
                {!isEdit && (entry.paymentDate || entry.accrualDate) && (
                  <div className="flex gap-4 mb-3 text-[11px] text-slate-500">
                    {entry.paymentDate && <span>Оплата: {entry.paymentDate.split('-').reverse().join('.')}</span>}
                    {entry.accrualDate && <span>Начисление: {entry.accrualDate.split('-').reverse().join('.')}</span>}
                  </div>
                )}

                {/* Requester */}
                {!isEdit && entry.username && (
                  <div className="text-[10px] text-slate-400 mb-3">Запросил: {entry.username}</div>
                )}

                {/* === EDIT MODE === */}
                {isEdit && (
                  <div className="space-y-3 mb-3">
                    <div>
                      <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide block mb-1">Сумма</label>
                      <input
                        type="number" min={0} step="0.01"
                        value={editAmount}
                        onChange={e => setEditAmount(e.target.value)}
                        className="w-full text-sm font-semibold border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide block mb-1">Описание</label>
                      <textarea
                        value={editDescription}
                        onChange={e => setEditDescription(e.target.value)}
                        rows={3}
                        className="w-full text-[12px] border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white resize-none"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide block mb-1">Дата оплаты</label>
                        <input
                          type="date"
                          value={editPaymentDate}
                          onChange={e => setEditPaymentDate(e.target.value)}
                          className="w-full text-[12px] border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide block mb-1">Дата начисления</label>
                        <input
                          type="date"
                          value={editAccrualDate}
                          onChange={e => setEditAccrualDate(e.target.value)}
                          className="w-full text-[12px] border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                        />
                      </div>
                    </div>
                    {err && <p className="text-[11px] text-red-500">{err}</p>}
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={handleEdit} disabled={busy}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-bold bg-teal-600 text-white rounded-xl hover:bg-teal-700 disabled:opacity-50 active:scale-[0.98] transition-all"
                      >
                        <Check size={14} /> {busy ? 'Сохраняю…' : 'Сохранить'}
                      </button>
                      <button onClick={cancelAction} className="px-4 py-2.5 text-sm border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 transition-colors">
                        Отмена
                      </button>
                    </div>
                  </div>
                )}

                {/* === ACTION BUTTONS (non-edit mode) === */}
                {!isActive && (
                  <div className="space-y-2">
                    {entry.status === 'pending' && (
                      <button
                        onClick={() => handleStatusChange(entry.id, 'approved')}
                        disabled={statusBusy === entry.id}
                        className="w-full flex items-center justify-center gap-2 text-sm font-semibold py-2.5 rounded-xl bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50 active:scale-[0.98] transition-all"
                      >
                        <ThumbsUp size={14} /> {statusBusy === entry.id ? 'Утверждаю…' : 'Утвердить'}
                      </button>
                    )}
                    {entry.status === 'approved' && (
                      <button
                        onClick={() => handleStatusChange(entry.id, 'paid')}
                        disabled={statusBusy === entry.id}
                        className="w-full flex items-center justify-center gap-2 text-sm font-semibold py-2.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 active:scale-[0.98] transition-all"
                      >
                        <CreditCard size={14} /> {statusBusy === entry.id ? 'Оплачиваю…' : 'Оплатить'}
                      </button>
                    )}
                    {entry.status === 'paid' && (
                      <button
                        onClick={() => handleStatusChange(entry.id, 'verified')}
                        disabled={statusBusy === entry.id}
                        className="w-full flex items-center justify-center gap-2 text-sm font-semibold py-2.5 rounded-xl bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50 active:scale-[0.98] transition-all"
                      >
                        <Check size={14} /> {statusBusy === entry.id ? 'Сохраняю…' : 'Проверено'}
                      </button>
                    )}
                    <div className="flex gap-2">
                      {entry.status !== 'paid' && entry.status !== 'verified' && (
                      <button
                        onClick={() => openMove(entry.id)}
                        className="flex-1 flex items-center justify-center gap-1.5 text-[12px] font-medium py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 transition-colors"
                      >
                        <ArrowRight size={12} /> Перенести
                      </button>
                      )}
                      {entry.status !== 'paid' && entry.status !== 'verified' && (
                        <button
                          onClick={() => openSplit(entry)}
                          className="flex-1 flex items-center justify-center gap-1.5 text-[12px] font-medium py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-violet-50 hover:border-violet-200 hover:text-violet-700 transition-colors"
                        >
                          <Scissors size={12} /> Разбить
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* === MOVE MODE === */}
                {isMove && (
                  <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 space-y-2">
                    <div className="text-[11px] font-semibold text-blue-700">Новая дата платежа</div>
                    <input
                      type="date" value={moveDate} onChange={e => setMoveDate(e.target.value)}
                      className="w-full text-[12px] border border-blue-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-blue-400 bg-white"
                    />
                    {err && <p className="text-[11px] text-red-500">{err}</p>}
                    <div className="flex gap-2">
                      <button onClick={handleMove} disabled={busy}
                        className="flex-1 py-1.5 text-[11px] font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                        {busy ? 'Сохраняю…' : 'Перенести'}
                      </button>
                      <button onClick={cancelAction} className="px-3 py-1.5 text-[11px] border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors">Отмена</button>
                    </div>
                  </div>
                )}

                {/* === SPLIT MODE === */}
                {isSplit && (
                  <div className="p-3 bg-violet-50 rounded-xl border border-violet-100 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] font-semibold text-violet-700">Разбить {fmtFull(entry.amount)}</div>
                      <div className={`text-[11px] font-bold tabular-nums ${Math.abs(splitRemainder) < 0.01 ? 'text-emerald-600' : 'text-rose-500'}`}>
                        {Math.abs(splitRemainder) < 0.01 ? '✓ сумма совпадает' : `остаток: ${fmtFull(splitRemainder)}`}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      {splitParts.map((part, i) => (
                        <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-1.5 items-end">
                          <div>
                            {i === 0 && <label className="text-[10px] text-slate-400 mb-0.5 block">Сумма, ₽</label>}
                            <input type="number" min={1} value={part.amount} onChange={e => updatePart(i, 'amount', e.target.value)} placeholder="0"
                              className="w-full text-[12px] border border-violet-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-violet-400 bg-white" />
                          </div>
                          <div>
                            {i === 0 && <label className="text-[10px] text-slate-400 mb-0.5 block">Дата</label>}
                            <input type="date" value={part.date} onChange={e => updatePart(i, 'date', e.target.value)}
                              className="w-full text-[12px] border border-violet-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-violet-400 bg-white" />
                          </div>
                          <button onClick={() => removePart(i)} disabled={splitParts.length <= 2}
                            className="mb-0.5 px-2 py-1.5 text-[11px] rounded-lg border border-slate-200 text-slate-400 hover:bg-rose-50 hover:text-rose-500 hover:border-rose-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">✕</button>
                        </div>
                      ))}
                    </div>
                    <button onClick={addPart}
                      className="w-full py-1 text-[11px] font-medium text-violet-600 border border-dashed border-violet-300 rounded-lg hover:bg-violet-100 transition-colors">
                      + добавить часть
                    </button>
                    {err && <p className="text-[11px] text-red-500">{err}</p>}
                    <div className="flex gap-2 pt-1">
                      <button onClick={handleSplit} disabled={busy || !splitValid}
                        className="flex-1 py-1.5 text-[11px] font-bold bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 transition-colors">
                        {busy ? 'Сохраняю…' : `Разбить на ${splitParts.length}`}
                      </button>
                      <button onClick={cancelAction} className="px-3 py-1.5 text-[11px] border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors">Отмена</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-2.5 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex justify-between items-center flex-shrink-0">
          <span className="text-[11px] text-slate-400">{entries.length} {pluralOp(entries.length)}</span>
          <span className="text-[13px] font-bold text-slate-700">{fmtFull(entries.reduce((s, e) => s + e.amount, 0))}</span>
        </div>
      </div>
    </div>
  );
};
