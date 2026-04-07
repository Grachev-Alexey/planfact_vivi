import React, { useState } from 'react';
import { X, ArrowRight, Scissors, ThumbsUp, CreditCard } from 'lucide-react';

interface PREntry {
  id: number;
  amount: number;
  status: 'pending' | 'approved' | 'paid';
  description: string;
  username: string;
  contractorName: string;
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

const STATUS_CFG = {
  pending:  { label: 'Ожидает',    pill: 'bg-amber-100 text-amber-700',    dot: 'bg-amber-500'    },
  approved: { label: 'Утверждено', pill: 'bg-sky-100 text-sky-700',        dot: 'bg-sky-500'      },
  paid:     { label: 'Оплачено',   pill: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500'  },
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

type ActionMode = { entryId: number; type: 'move' } | { entryId: number; type: 'split' };

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

  const activeEntry = action ? entries.find(e => e.id === action.entryId) : null;

  const splitTotal = splitParts.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
  const splitRemainder = activeEntry ? Math.round((activeEntry.amount - splitTotal) * 100) / 100 : 0;
  const splitValid = activeEntry && Math.abs(splitRemainder) < 0.01 && splitParts.every(p => parseFloat(p.amount) > 0 && p.date);

  function openMove(id: number) {
    setAction({ entryId: id, type: 'move' });
    setMoveDate(defaultDate);
    setErr('');
  }

  function openSplit(entry: PREntry) {
    setAction({ entryId: entry.id, type: 'split' });
    const half = Math.floor(entry.amount / 2);
    setSplitParts([
      { amount: String(half), date: defaultDate },
      { amount: String(entry.amount - half), date: defaultDate },
    ]);
    setErr('');
  }

  function updatePart(i: number, field: 'amount' | 'date', val: string) {
    setSplitParts(prev => prev.map((p, idx) => idx === i ? { ...p, [field]: val } : p));
  }

  function addPart() {
    setSplitParts(prev => [...prev, { amount: '', date: defaultDate }]);
  }

  function removePart(i: number) {
    setSplitParts(prev => prev.filter((_, idx) => idx !== i));
  }

  function cancelAction() {
    setAction(null);
    setErr('');
  }

  async function handleStatusChange(entryId: number, newStatus: 'approved' | 'paid') {
    setStatusBusy(entryId);
    try {
      const r = await fetch(`/api/payment-requests/${entryId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-user-id': String(userId) },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!r.ok) throw new Error();
      onSuccess?.(newStatus === 'approved' ? 'Запрос утверждён' : 'Запрос оплачен');
      onClose();
      onRefresh();
    } catch {
      onSuccess?.('Не удалось изменить статус', 'error');
    } finally {
      setStatusBusy(null);
    }
  }

  async function handleMove() {
    if (!action || action.type !== 'move' || !moveDate) return;
    setBusy(true);
    setErr('');
    try {
      const r = await fetch('/api/payment-calendar/move-payment', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-user-id': String(userId) },
        body: JSON.stringify({ ids: [action.entryId], newDate: moveDate }),
      });
      if (!r.ok) throw new Error('Ошибка сервера');
      onClose();
      onSuccess?.(`Операция перенесена на ${moveDate.split('-').reverse().slice(0, 2).join('.')}`);
      onRefresh();
    } catch (e: any) {
      setErr(e.message || 'Ошибка');
      setBusy(false);
    }
  }

  async function handleSplit() {
    if (!action || action.type !== 'split') return;
    if (!splitValid) {
      setErr('Суммы частей должны в точности совпадать с исходной суммой');
      return;
    }
    setBusy(true);
    setErr('');
    try {
      const r = await fetch('/api/payment-calendar/split-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': String(userId) },
        body: JSON.stringify({
          id: action.entryId,
          parts: splitParts.map(p => ({ amount: parseFloat(p.amount), date: p.date })),
        }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error || 'Ошибка сервера');
      }
      onClose();
      onSuccess?.(`Платёж разбит на ${splitParts.length} части`);
      onRefresh();
    } catch (e: any) {
      setErr(e.message || 'Ошибка');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center"
      style={{ background: 'rgba(15,23,42,0.35)', backdropFilter: 'blur(2px)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 flex flex-col"
        style={{ maxHeight: '85vh', animation: 'tooltip-in 0.15s ease-out' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-slate-100 flex items-start justify-between bg-slate-50 rounded-t-2xl flex-shrink-0">
          <div>
            <div className="text-[13px] font-bold text-slate-700 leading-tight">{catName}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">{day} {MONTH_NAMES_GEN[month - 1]} {year}</div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-200 transition-colors ml-2 flex-shrink-0">
            <X size={15} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 divide-y divide-slate-100">
          {entries.map(entry => {
            const cfg = STATUS_CFG[entry.status];
            const isActive = action?.entryId === entry.id;

            return (
              <div key={entry.id} className={`p-4 ${isActive ? 'bg-slate-50' : ''}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.pill}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                    {cfg.label}
                  </span>
                  <span className="text-sm font-bold text-slate-800">{fmtFull(entry.amount)}</span>
                </div>

                {entry.description && (
                  <p className="text-[11px] text-slate-600 mb-2 leading-snug">{entry.description}</p>
                )}
                <div className="flex gap-2 mb-3 text-[10px] text-slate-400 flex-wrap">
                  {entry.contractorName && <span>{entry.contractorName}</span>}
                  {entry.username && <span>· {entry.username}</span>}
                </div>

                {!isActive && (
                  <div className="space-y-2">
                    {(entry.status === 'pending' || entry.status === 'approved') && (
                      <div className="flex gap-2">
                        {entry.status === 'pending' && (
                          <button
                            onClick={() => handleStatusChange(entry.id, 'approved')}
                            disabled={statusBusy === entry.id}
                            className="flex-1 flex items-center justify-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50 transition-colors"
                          >
                            <ThumbsUp size={11} /> {statusBusy === entry.id ? '...' : 'Утвердить'}
                          </button>
                        )}
                        {entry.status === 'approved' && (
                          <button
                            onClick={() => handleStatusChange(entry.id, 'paid')}
                            disabled={statusBusy === entry.id}
                            className="flex-1 flex items-center justify-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                          >
                            <CreditCard size={11} /> {statusBusy === entry.id ? '...' : 'Оплатить'}
                          </button>
                        )}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => openMove(entry.id)}
                        className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 transition-colors"
                      >
                        <ArrowRight size={11} /> Перенести
                      </button>
                      {entry.status !== 'paid' && (
                        <button
                          onClick={() => openSplit(entry)}
                          className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-violet-50 hover:border-violet-200 hover:text-violet-700 transition-colors"
                        >
                          <Scissors size={11} /> Разбить
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {isActive && action?.type === 'move' && (
                  <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 space-y-2">
                    <div className="text-[11px] font-semibold text-blue-700">Новая дата платежа</div>
                    <input
                      type="date"
                      value={moveDate}
                      onChange={e => setMoveDate(e.target.value)}
                      className="w-full text-[12px] border border-blue-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-blue-400 bg-white"
                    />
                    {err && <p className="text-[11px] text-red-500">{err}</p>}
                    <div className="flex gap-2">
                      <button
                        onClick={handleMove} disabled={busy}
                        className="flex-1 py-1.5 text-[11px] font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                      >
                        {busy ? 'Сохраняю…' : 'Перенести'}
                      </button>
                      <button onClick={cancelAction} className="px-3 py-1.5 text-[11px] border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors">
                        Отмена
                      </button>
                    </div>
                  </div>
                )}

                {isActive && action?.type === 'split' && (
                  <div className="p-3 bg-violet-50 rounded-xl border border-violet-100 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] font-semibold text-violet-700">
                        Разбить {fmtFull(entry.amount)} на {splitParts.length} части
                      </div>
                      <div className={`text-[11px] font-bold tabular-nums ${Math.abs(splitRemainder) < 0.01 ? 'text-emerald-600' : 'text-rose-500'}`}>
                        {Math.abs(splitRemainder) < 0.01 ? '✓ сумма совпадает' : `остаток: ${fmtFull(splitRemainder)}`}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      {splitParts.map((part, i) => (
                        <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-1.5 items-end">
                          <div>
                            {i === 0 && <label className="text-[10px] text-slate-400 mb-0.5 block">Сумма, ₽</label>}
                            <input
                              type="number" min={1}
                              value={part.amount}
                              onChange={e => updatePart(i, 'amount', e.target.value)}
                              placeholder="0"
                              className="w-full text-[12px] border border-violet-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-violet-400 bg-white"
                            />
                          </div>
                          <div>
                            {i === 0 && <label className="text-[10px] text-slate-400 mb-0.5 block">Дата</label>}
                            <input
                              type="date" value={part.date}
                              onChange={e => updatePart(i, 'date', e.target.value)}
                              className="w-full text-[12px] border border-violet-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-violet-400 bg-white"
                            />
                          </div>
                          <button
                            onClick={() => removePart(i)}
                            disabled={splitParts.length <= 2}
                            className="mb-0.5 px-2 py-1.5 text-[11px] rounded-lg border border-slate-200 text-slate-400 hover:bg-rose-50 hover:text-rose-500 hover:border-rose-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            title="Удалить часть"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={addPart}
                      className="w-full py-1 text-[11px] font-medium text-violet-600 border border-dashed border-violet-300 rounded-lg hover:bg-violet-100 transition-colors"
                    >
                      + добавить часть
                    </button>

                    {err && <p className="text-[11px] text-red-500">{err}</p>}

                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={handleSplit} disabled={busy || !splitValid}
                        className="flex-1 py-1.5 text-[11px] font-bold bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 transition-colors"
                      >
                        {busy ? 'Сохраняю…' : `Разбить на ${splitParts.length}`}
                      </button>
                      <button onClick={cancelAction} className="px-3 py-1.5 text-[11px] border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors">
                        Отмена
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex justify-between items-center flex-shrink-0">
          <span className="text-[11px] text-slate-400">{entries.length} {pluralOp(entries.length)}</span>
          <span className="text-[13px] font-bold text-slate-700">
            {fmtFull(entries.reduce((s, e) => s + e.amount, 0))}
          </span>
        </div>
      </div>
    </div>
  );
};
