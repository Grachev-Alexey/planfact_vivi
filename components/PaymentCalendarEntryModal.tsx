import React, { useState } from 'react';
import { X, ArrowRight, Scissors } from 'lucide-react';

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
}

const STATUS_CFG = {
  pending:  { label: 'Ожидает',   pill: 'bg-blue-100 text-blue-700',    dot: 'bg-blue-500'    },
  approved: { label: 'Утверждён', pill: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500'  },
  paid:     { label: 'Оплачен',   pill: 'bg-green-100 text-green-700',   dot: 'bg-green-500'   },
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
  catName, day, month, year, entries, userId, onClose, onRefresh,
}) => {
  const defaultDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const [action, setAction] = useState<ActionMode | null>(null);
  const [moveDate, setMoveDate] = useState(defaultDate);
  const [splitAmt1, setSplitAmt1] = useState('');
  const [splitDate1, setSplitDate1] = useState(defaultDate);
  const [splitDate2, setSplitDate2] = useState(defaultDate);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const activeEntry = action ? entries.find(e => e.id === action.entryId) : null;
  const splitAmt2 = activeEntry && splitAmt1 ? Math.round((activeEntry.amount - parseFloat(splitAmt1)) * 100) / 100 : 0;

  function openMove(id: number) {
    setAction({ entryId: id, type: 'move' });
    setMoveDate(defaultDate);
    setErr('');
  }

  function openSplit(entry: PREntry) {
    setAction({ entryId: entry.id, type: 'split' });
    setSplitAmt1(String(Math.floor(entry.amount / 2)));
    setSplitDate1(defaultDate);
    setSplitDate2(defaultDate);
    setErr('');
  }

  function cancelAction() {
    setAction(null);
    setErr('');
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
      onRefresh();
      onClose();
    } catch (e: any) {
      setErr(e.message || 'Ошибка');
    } finally {
      setBusy(false);
    }
  }

  async function handleSplit() {
    if (!action || action.type !== 'split') return;
    const amt1 = parseFloat(splitAmt1);
    if (isNaN(amt1) || amt1 <= 0 || splitAmt2 <= 0) {
      setErr('Некорректное разбиение сумм');
      return;
    }
    if (!splitDate1 || !splitDate2) {
      setErr('Укажите обе даты');
      return;
    }
    setBusy(true);
    setErr('');
    try {
      const r = await fetch('/api/payment-calendar/split-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': String(userId) },
        body: JSON.stringify({ id: action.entryId, amount1: amt1, date1: splitDate1, amount2: splitAmt2, date2: splitDate2 }),
      });
      if (!r.ok) throw new Error('Ошибка сервера');
      onRefresh();
      onClose();
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
                  <div className="p-3 bg-violet-50 rounded-xl border border-violet-100 space-y-3">
                    <div className="text-[11px] font-semibold text-violet-700">Разбить платёж {fmtFull(entry.amount)}</div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-500 mb-1 block">1-я часть, ₽</label>
                        <input
                          type="number" min={1} max={entry.amount - 1}
                          value={splitAmt1}
                          onChange={e => setSplitAmt1(e.target.value)}
                          className="w-full text-[12px] border border-violet-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-violet-400 bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 mb-1 block">Дата</label>
                        <input
                          type="date" value={splitDate1}
                          onChange={e => setSplitDate1(e.target.value)}
                          className="w-full text-[12px] border border-violet-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-violet-400 bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 mb-1 block">2-я часть, ₽</label>
                        <input
                          type="number" value={splitAmt2 > 0 ? splitAmt2 : ''} readOnly
                          className="w-full text-[12px] border border-slate-200 rounded-lg px-2 py-1.5 bg-slate-100 text-slate-500"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 mb-1 block">Дата</label>
                        <input
                          type="date" value={splitDate2}
                          onChange={e => setSplitDate2(e.target.value)}
                          className="w-full text-[12px] border border-violet-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-violet-400 bg-white"
                        />
                      </div>
                    </div>
                    {splitAmt1 && splitAmt2 <= 0 && (
                      <p className="text-[11px] text-red-500">1-я часть не может быть ≥ общей суммы</p>
                    )}
                    {err && <p className="text-[11px] text-red-500">{err}</p>}
                    <div className="flex gap-2">
                      <button
                        onClick={handleSplit} disabled={busy || splitAmt2 <= 0}
                        className="flex-1 py-1.5 text-[11px] font-bold bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 transition-colors"
                      >
                        {busy ? 'Сохраняю…' : 'Разбить'}
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
