import React, { useState, useEffect } from 'react';
import { useFinance } from '../context/FinanceContext';
import { Button } from './ui/Button';
import { Plus, Trash2, Check, X, Pencil } from 'lucide-react';

interface CreditDateRule {
  id: number;
  accountId: number;
  accountName: string;
  delayDays: number;
  weekendRule: string;
  name: string;
  enabled: boolean;
}

interface AutoTransferRule {
  id: number;
  fromAccountId: number;
  fromAccountName: string;
  toAccountId: number;
  toAccountName: string;
  schedule: string;
  skipWeekends: boolean;
  skipDays: string;
  amount: number | null;
  transferAll: boolean;
  description: string;
  enabled: boolean;
  lastRunDate: string | null;
}

const WEEKEND_RULES: { id: string; label: string }[] = [
  { id: 'next_business_day', label: 'Перенос на следующий рабочий день' },
  { id: 'saturday_ok', label: 'Суббота — рабочий, воскресенье — на понедельник' },
  { id: 'previous_business_day', label: 'Перенос на предыдущий рабочий день' },
  { id: 'no_adjustment', label: 'Без корректировки (выходные считаются)' },
];

const SCHEDULE_OPTIONS: { id: string; label: string }[] = [
  { id: 'daily', label: 'Ежедневно' },
  { id: 'weekdays', label: 'По будням (Пн-Пт)' },
];

export const RulesSettings: React.FC = () => {
  const { accounts } = useFinance();

  const [creditRules, setCreditRules] = useState<CreditDateRule[]>([]);
  const [transferRules, setTransferRules] = useState<AutoTransferRule[]>([]);
  const [rulesTab, setRulesTab] = useState<'credit' | 'transfer'>('credit');

  const [editingCr, setEditingCr] = useState<Partial<CreditDateRule> | null>(null);
  const [editingTr, setEditingTr] = useState<Partial<AutoTransferRule> | null>(null);

  const loadCreditRules = () => {
    fetch('/api/credit-date-rules').then(r => r.json()).then(setCreditRules).catch(() => {});
  };
  const loadTransferRules = () => {
    fetch('/api/auto-transfer-rules').then(r => r.json()).then(setTransferRules).catch(() => {});
  };

  useEffect(() => {
    loadCreditRules();
    loadTransferRules();
  }, []);

  const saveCreditRule = async () => {
    if (!editingCr || !editingCr.accountId) return;
    const method = editingCr.id ? 'PUT' : 'POST';
    const url = editingCr.id ? `/api/credit-date-rules/${editingCr.id}` : '/api/credit-date-rules';
    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: editingCr.accountId,
        delayDays: editingCr.delayDays || 1,
        weekendRule: editingCr.weekendRule || 'next_business_day',
        name: editingCr.name || '',
        enabled: editingCr.enabled !== false,
      }),
    });
    setEditingCr(null);
    loadCreditRules();
  };

  const deleteCreditRule = async (id: number) => {
    await fetch(`/api/credit-date-rules/${id}`, { method: 'DELETE' });
    loadCreditRules();
  };

  const saveTransferRule = async () => {
    if (!editingTr || !editingTr.fromAccountId || !editingTr.toAccountId) return;
    const method = editingTr.id ? 'PUT' : 'POST';
    const url = editingTr.id ? `/api/auto-transfer-rules/${editingTr.id}` : '/api/auto-transfer-rules';
    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromAccountId: editingTr.fromAccountId,
        toAccountId: editingTr.toAccountId,
        schedule: editingTr.schedule || 'daily',
        skipWeekends: editingTr.skipWeekends || false,
        skipDays: [],
        amount: editingTr.transferAll ? null : (editingTr.amount || 0),
        transferAll: editingTr.transferAll || false,
        description: editingTr.description || '',
        enabled: editingTr.enabled !== false,
      }),
    });
    setEditingTr(null);
    loadTransferRules();
  };

  const deleteTransferRule = async (id: number) => {
    await fetch(`/api/auto-transfer-rules/${id}`, { method: 'DELETE' });
    loadTransferRules();
  };

  const executeTransfers = async () => {
    const res = await fetch('/api/auto-transfer-rules/execute', { method: 'POST' });
    const data = await res.json();
    if (data.executed?.length > 0) {
      alert(`Выполнено ${data.executed.length} перемещений`);
    } else {
      alert('Нет перемещений для выполнения');
    }
    loadTransferRules();
  };

  const accountOptions = accounts.map(a => ({ id: String(a.id), name: a.name }));

  return (
    <div className="space-y-6">
      <div className="flex gap-4 border-b border-slate-200 mb-4">
        <button
          onClick={() => setRulesTab('credit')}
          className={`pb-3 text-sm font-semibold transition-colors border-b-2 px-1 ${rulesTab === 'credit' ? 'text-slate-800 border-teal-500' : 'text-slate-400 border-transparent hover:text-slate-600'}`}
        >
          Даты зачисления
        </button>
        <button
          onClick={() => setRulesTab('transfer')}
          className={`pb-3 text-sm font-semibold transition-colors border-b-2 px-1 ${rulesTab === 'transfer' ? 'text-slate-800 border-teal-500' : 'text-slate-400 border-transparent hover:text-slate-600'}`}
        >
          Авто-перемещения
        </button>
      </div>

      {rulesTab === 'credit' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">Настройте, через сколько дней после операции деньги фактически зачисляются на счёт</p>
            <Button
              onClick={() => setEditingCr({ delayDays: 1, weekendRule: 'next_business_day', enabled: true })}
              className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5"
            >
              <Plus size={16} /> Добавить правило
            </Button>
          </div>

          {editingCr && (
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Счёт</label>
                  <select
                    value={editingCr.accountId || ''}
                    onChange={e => setEditingCr({ ...editingCr, accountId: Number(e.target.value) })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">Выберите счёт</option>
                    {accountOptions.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Название (необязательно)</label>
                  <input
                    value={editingCr.name || ''}
                    onChange={e => setEditingCr({ ...editingCr, name: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                    placeholder="Например: Карта Сбербанк"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Задержка (дней)</label>
                  <input
                    type="number"
                    min="0"
                    value={editingCr.delayDays ?? 1}
                    onChange={e => setEditingCr({ ...editingCr, delayDays: parseInt(e.target.value) || 0 })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Правило выходных</label>
                  <select
                    value={editingCr.weekendRule || 'next_business_day'}
                    onChange={e => setEditingCr({ ...editingCr, weekendRule: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  >
                    {WEEKEND_RULES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setEditingCr(null)} className="px-3 py-1.5 text-sm text-slate-500 hover:text-slate-700"><X size={16} /></button>
                <Button onClick={saveCreditRule} className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1"><Check size={16} /> Сохранить</Button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {creditRules.length === 0 && !editingCr && (
              <p className="text-sm text-slate-400 text-center py-8">Нет правил. Добавьте первое правило.</p>
            )}
            {creditRules.map(rule => (
              <div key={rule.id} className={`flex items-center justify-between bg-white rounded-xl px-4 py-3 border ${rule.enabled ? 'border-slate-200' : 'border-slate-100 opacity-60'}`}>
                <div>
                  <div className="text-sm font-medium text-slate-700">
                    {rule.accountName}
                    {rule.name && <span className="text-slate-400 ml-2">({rule.name})</span>}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    +{rule.delayDays} {rule.delayDays === 1 ? 'день' : rule.delayDays < 5 ? 'дня' : 'дней'} · {WEEKEND_RULES.find(r => r.id === rule.weekendRule)?.label || rule.weekendRule}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setEditingCr(rule)}
                    className="p-1.5 text-slate-400 hover:text-teal-600 rounded"
                  ><Pencil size={14} /></button>
                  <button
                    onClick={() => deleteCreditRule(rule.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-500 rounded"
                  ><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {rulesTab === 'transfer' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">Настройте автоматические перемещения между счетами</p>
            <div className="flex gap-2">
              <Button
                onClick={executeTransfers}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
              >
                Выполнить сейчас
              </Button>
              <Button
                onClick={() => setEditingTr({ schedule: 'daily', enabled: true, transferAll: false, skipWeekends: false })}
                className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5"
              >
                <Plus size={16} /> Добавить правило
              </Button>
            </div>
          </div>

          {editingTr && (
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Со счёта</label>
                  <select
                    value={editingTr.fromAccountId || ''}
                    onChange={e => setEditingTr({ ...editingTr, fromAccountId: Number(e.target.value) })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">Выберите счёт</option>
                    {accountOptions.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">На счёт</label>
                  <select
                    value={editingTr.toAccountId || ''}
                    onChange={e => setEditingTr({ ...editingTr, toAccountId: Number(e.target.value) })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">Выберите счёт</option>
                    {accountOptions.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Расписание</label>
                  <select
                    value={editingTr.schedule || 'daily'}
                    onChange={e => setEditingTr({ ...editingTr, schedule: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  >
                    {SCHEDULE_OPTIONS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Сумма</label>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingTr.transferAll || false}
                        onChange={e => setEditingTr({ ...editingTr, transferAll: e.target.checked })}
                        className="rounded"
                      />
                      Весь остаток
                    </label>
                    {!editingTr.transferAll && (
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editingTr.amount ?? ''}
                        onChange={e => setEditingTr({ ...editingTr, amount: parseFloat(e.target.value) || 0 })}
                        className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm"
                        placeholder="Сумма"
                      />
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Пропускать выходные</label>
                  <label className="flex items-center gap-1.5 text-sm cursor-pointer mt-2">
                    <input
                      type="checkbox"
                      checked={editingTr.skipWeekends || false}
                      onChange={e => setEditingTr({ ...editingTr, skipWeekends: e.target.checked })}
                      className="rounded"
                    />
                    Да
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Описание</label>
                <input
                  value={editingTr.description || ''}
                  onChange={e => setEditingTr({ ...editingTr, description: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  placeholder="Авто-перемещение"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setEditingTr(null)} className="px-3 py-1.5 text-sm text-slate-500 hover:text-slate-700"><X size={16} /></button>
                <Button onClick={saveTransferRule} className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1"><Check size={16} /> Сохранить</Button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {transferRules.length === 0 && !editingTr && (
              <p className="text-sm text-slate-400 text-center py-8">Нет правил автоматических перемещений.</p>
            )}
            {transferRules.map(rule => (
              <div key={rule.id} className={`flex items-center justify-between bg-white rounded-xl px-4 py-3 border ${rule.enabled ? 'border-slate-200' : 'border-slate-100 opacity-60'}`}>
                <div>
                  <div className="text-sm font-medium text-slate-700">
                    {rule.fromAccountName} → {rule.toAccountName}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {SCHEDULE_OPTIONS.find(s => s.id === rule.schedule)?.label || rule.schedule}
                    {rule.skipWeekends && ' · без выходных'}
                    {' · '}
                    {rule.transferAll ? 'весь остаток' : `${rule.amount?.toLocaleString('ru-RU')} ₽`}
                    {rule.description && ` · ${rule.description}`}
                    {rule.lastRunDate && <span className="ml-2 text-slate-300">последний: {rule.lastRunDate}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setEditingTr(rule)}
                    className="p-1.5 text-slate-400 hover:text-teal-600 rounded"
                  ><Pencil size={14} /></button>
                  <button
                    onClick={() => deleteTransferRule(rule.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-500 rounded"
                  ><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
