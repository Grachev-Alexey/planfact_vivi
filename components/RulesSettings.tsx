import React, { useState, useEffect } from 'react';
import { useFinance } from '../context/FinanceContext';
import { Button } from './ui/Button';
import { Plus, Trash2, Check, X, Pencil, Power, PowerOff, Play, ChevronDown, ChevronUp } from 'lucide-react';

interface CreditDateRule {
  id: number;
  accountId: number;
  accountName: string;
  delayDays: number;
  weekendRule: string;
  name: string;
  enabled: boolean;
  categoryId: number | null;
  categoryName: string | null;
  studioId: number | null;
  studioName: string | null;
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
  leaveMinBalance: number;
  specificDays: string;
  maxAmount: number | null;
}

const WEEKEND_RULES: { id: string; label: string }[] = [
  { id: 'next_business_day', label: 'Следующий рабочий день' },
  { id: 'saturday_ok', label: 'Суббота — рабочий' },
  { id: 'previous_business_day', label: 'Предыдущий рабочий день' },
  { id: 'no_adjustment', label: 'Без корректировки' },
];

const SCHEDULE_OPTIONS: { id: string; label: string }[] = [
  { id: 'daily', label: 'Ежедневно' },
  { id: 'weekdays', label: 'По будням (Пн–Пт)' },
  { id: 'weekly', label: 'По дням недели' },
  { id: 'monthly', label: 'По дням месяца' },
];

const DAYS_OF_WEEK: { id: string; label: string; short: string }[] = [
  { id: 'mon', label: 'Понедельник', short: 'Пн' },
  { id: 'tue', label: 'Вторник', short: 'Вт' },
  { id: 'wed', label: 'Среда', short: 'Ср' },
  { id: 'thu', label: 'Четверг', short: 'Чт' },
  { id: 'fri', label: 'Пятница', short: 'Пт' },
  { id: 'sat', label: 'Суббота', short: 'Сб' },
  { id: 'sun', label: 'Воскресенье', short: 'Вс' },
];

function parseJsonArray(v: any): any[] {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') {
    try { return JSON.parse(v); } catch { return []; }
  }
  return [];
}

export const RulesSettings: React.FC = () => {
  const { accounts, categories, studios } = useFinance();

  const [creditRules, setCreditRules] = useState<CreditDateRule[]>([]);
  const [transferRules, setTransferRules] = useState<AutoTransferRule[]>([]);
  const [rulesTab, setRulesTab] = useState<'credit' | 'transfer'>('credit');

  const [editingCr, setEditingCr] = useState<Partial<CreditDateRule> | null>(null);
  const [editingTr, setEditingTr] = useState<Partial<AutoTransferRule> | null>(null);
  const [showAdvancedTr, setShowAdvancedTr] = useState(false);

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
        categoryId: editingCr.categoryId || null,
        studioId: editingCr.studioId || null,
      }),
    });
    setEditingCr(null);
    loadCreditRules();
  };

  const toggleCreditEnabled = async (rule: CreditDateRule) => {
    await fetch(`/api/credit-date-rules/${rule.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...rule, enabled: !rule.enabled }),
    });
    loadCreditRules();
  };

  const deleteCreditRule = async (id: number) => {
    await fetch(`/api/credit-date-rules/${id}`, { method: 'DELETE' });
    loadCreditRules();
  };

  const saveTransferRule = async () => {
    if (!editingTr || !editingTr.fromAccountId || !editingTr.toAccountId) return;
    if ((editingTr.schedule === 'weekly' || editingTr.schedule === 'monthly') && parseJsonArray(editingTr.specificDays).length === 0) {
      alert(editingTr.schedule === 'weekly' ? 'Выберите хотя бы один день недели' : 'Выберите хотя бы одно число месяца');
      return;
    }
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
        skipDays: parseJsonArray(editingTr.skipDays),
        amount: editingTr.transferAll ? null : (editingTr.amount || 0),
        transferAll: editingTr.transferAll || false,
        description: editingTr.description || '',
        enabled: editingTr.enabled !== false,
        leaveMinBalance: editingTr.leaveMinBalance || 0,
        specificDays: parseJsonArray(editingTr.specificDays),
        maxAmount: editingTr.maxAmount || null,
      }),
    });
    setEditingTr(null);
    setShowAdvancedTr(false);
    loadTransferRules();
  };

  const toggleTransferEnabled = async (rule: AutoTransferRule) => {
    await fetch(`/api/auto-transfer-rules/${rule.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...rule, enabled: !rule.enabled, skipDays: parseJsonArray(rule.skipDays), specificDays: parseJsonArray(rule.specificDays) }),
    });
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
  const incomeCategories = categories.filter(c => c.type === 'income');

  const toggleSpecificDay = (day: string | number) => {
    if (!editingTr) return;
    const current = parseJsonArray(editingTr.specificDays);
    const next = current.includes(day) ? current.filter((d: any) => d !== day) : [...current, day];
    setEditingTr({ ...editingTr, specificDays: JSON.stringify(next) });
  };

  const toggleSkipDay = (day: string) => {
    if (!editingTr) return;
    const current = parseJsonArray(editingTr.skipDays);
    const next = current.includes(day) ? current.filter((d: string) => d !== day) : [...current, day];
    setEditingTr({ ...editingTr, skipDays: JSON.stringify(next) });
  };

  const pluralDays = (n: number) => {
    if (n === 1) return 'день';
    if (n >= 2 && n <= 4) return 'дня';
    return 'дней';
  };

  const formatSchedule = (rule: AutoTransferRule) => {
    const sched = SCHEDULE_OPTIONS.find(s => s.id === rule.schedule)?.label || rule.schedule;
    const specific = parseJsonArray(rule.specificDays);
    if (rule.schedule === 'weekly' && specific.length > 0) {
      const dayLabels = specific.map((d: string) => DAYS_OF_WEEK.find(dw => dw.id === d)?.short || d);
      return `Еженедельно: ${dayLabels.join(', ')}`;
    }
    if (rule.schedule === 'monthly' && specific.length > 0) {
      return `Ежемесячно: ${specific.sort((a: number, b: number) => a - b).join(', ')} числа`;
    }
    return sched;
  };

  const formatAmount = (rule: AutoTransferRule) => {
    const parts: string[] = [];
    if (rule.transferAll) {
      parts.push('весь остаток');
    } else if (rule.amount) {
      parts.push(`${Number(rule.amount).toLocaleString('ru-RU')} ₽`);
    }
    if (rule.leaveMinBalance && parseFloat(String(rule.leaveMinBalance)) > 0) {
      parts.push(`мин. остаток ${Number(rule.leaveMinBalance).toLocaleString('ru-RU')} ₽`);
    }
    if (rule.maxAmount && parseFloat(String(rule.maxAmount)) > 0) {
      parts.push(`макс. ${Number(rule.maxAmount).toLocaleString('ru-RU')} ₽`);
    }
    return parts.join(' · ');
  };

  const inputCls = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400 transition-colors";
  const labelCls = "block text-xs font-medium text-slate-500 mb-1.5";

  return (
    <div className="space-y-5">
      <div className="flex gap-4 border-b border-slate-200">
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
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm text-slate-500">Через сколько дней деньги фактически зачисляются на счёт. Можно задать разные правила по счёту, категории или студии.</p>
            <Button
              onClick={() => setEditingCr({ delayDays: 1, weekendRule: 'next_business_day', enabled: true, categoryId: null, studioId: null })}
              className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 shrink-0"
            >
              <Plus size={16} /> Добавить
            </Button>
          </div>

          {editingCr && (
            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Счёт *</label>
                  <select
                    value={editingCr.accountId || ''}
                    onChange={e => setEditingCr({ ...editingCr, accountId: Number(e.target.value) })}
                    className={inputCls}
                  >
                    <option value="">Выберите счёт</option>
                    {accountOptions.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Название</label>
                  <input
                    value={editingCr.name || ''}
                    onChange={e => setEditingCr({ ...editingCr, name: e.target.value })}
                    className={inputCls}
                    placeholder="Например: Карта Сбербанк"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Задержка (дней)</label>
                  <input
                    type="number"
                    min="0"
                    value={editingCr.delayDays ?? 1}
                    onChange={e => setEditingCr({ ...editingCr, delayDays: parseInt(e.target.value) || 0 })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Выходные</label>
                  <select
                    value={editingCr.weekendRule || 'next_business_day'}
                    onChange={e => setEditingCr({ ...editingCr, weekendRule: e.target.value })}
                    className={inputCls}
                  >
                    {WEEKEND_RULES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Категория дохода (необязательно)</label>
                  <select
                    value={editingCr.categoryId || ''}
                    onChange={e => setEditingCr({ ...editingCr, categoryId: e.target.value ? Number(e.target.value) : null })}
                    className={inputCls}
                  >
                    <option value="">Все категории</option>
                    {incomeCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Студия (необязательно)</label>
                  <select
                    value={editingCr.studioId || ''}
                    onChange={e => setEditingCr({ ...editingCr, studioId: e.target.value ? Number(e.target.value) : null })}
                    className={inputCls}
                  >
                    <option value="">Все студии</option>
                    {studios.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1 border-t border-slate-100">
                <button onClick={() => setEditingCr(null)} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-lg transition-colors">Отмена</button>
                <Button onClick={saveCreditRule} className="bg-teal-600 hover:bg-teal-700 text-white px-5 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5">
                  <Check size={16} /> Сохранить
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {creditRules.length === 0 && !editingCr && (
              <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <p className="text-sm text-slate-400">Нет правил. Нажмите «Добавить» для создания первого правила.</p>
              </div>
            )}
            {creditRules.map(rule => (
              <div key={rule.id} className={`flex items-center justify-between bg-white rounded-xl px-4 py-3 border transition-all ${rule.enabled ? 'border-slate-200 shadow-sm' : 'border-slate-100 opacity-50'}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-slate-700">{rule.accountName}</span>
                    {rule.name && <span className="text-xs text-slate-400">({rule.name})</span>}
                    {rule.categoryName && (
                      <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{rule.categoryName}</span>
                    )}
                    {rule.studioName && (
                      <span className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full">{rule.studioName}</span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    +{rule.delayDays} {pluralDays(rule.delayDays)} · {WEEKEND_RULES.find(r => r.id === rule.weekendRule)?.label || rule.weekendRule}
                  </div>
                </div>
                <div className="flex items-center gap-1 ml-3 shrink-0">
                  <button
                    onClick={() => toggleCreditEnabled(rule)}
                    className={`p-1.5 rounded transition-colors ${rule.enabled ? 'text-teal-500 hover:text-teal-700' : 'text-slate-300 hover:text-slate-500'}`}
                    title={rule.enabled ? 'Выключить' : 'Включить'}
                  >
                    {rule.enabled ? <Power size={14} /> : <PowerOff size={14} />}
                  </button>
                  <button
                    onClick={() => setEditingCr(rule)}
                    className="p-1.5 text-slate-400 hover:text-teal-600 rounded transition-colors"
                  ><Pencil size={14} /></button>
                  <button
                    onClick={() => deleteCreditRule(rule.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-500 rounded transition-colors"
                  ><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {rulesTab === 'transfer' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm text-slate-500">Автоматические перемещения между счетами по расписанию</p>
            <div className="flex gap-2 shrink-0">
              <Button
                onClick={executeTransfers}
                className="bg-slate-600 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5"
              >
                <Play size={14} /> Выполнить сейчас
              </Button>
              <Button
                onClick={() => { setEditingTr({ schedule: 'daily', enabled: true, transferAll: false, skipWeekends: false, leaveMinBalance: 0, specificDays: '[]', skipDays: '[]', maxAmount: null }); setShowAdvancedTr(false); }}
                className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5"
              >
                <Plus size={16} /> Добавить
              </Button>
            </div>
          </div>

          {editingTr && (
            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Со счёта *</label>
                  <select
                    value={editingTr.fromAccountId || ''}
                    onChange={e => setEditingTr({ ...editingTr, fromAccountId: Number(e.target.value) })}
                    className={inputCls}
                  >
                    <option value="">Выберите счёт</option>
                    {accountOptions.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>На счёт *</label>
                  <select
                    value={editingTr.toAccountId || ''}
                    onChange={e => setEditingTr({ ...editingTr, toAccountId: Number(e.target.value) })}
                    className={inputCls}
                  >
                    <option value="">Выберите счёт</option>
                    {accountOptions.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Расписание</label>
                  <select
                    value={editingTr.schedule || 'daily'}
                    onChange={e => setEditingTr({ ...editingTr, schedule: e.target.value, specificDays: '[]' })}
                    className={inputCls}
                  >
                    {SCHEDULE_OPTIONS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Описание</label>
                  <input
                    value={editingTr.description || ''}
                    onChange={e => setEditingTr({ ...editingTr, description: e.target.value })}
                    className={inputCls}
                    placeholder="Авто-перемещение"
                  />
                </div>
              </div>

              {editingTr.schedule === 'weekly' && (
                <div>
                  <label className={labelCls}>Дни недели</label>
                  <div className="flex flex-wrap gap-1.5">
                    {DAYS_OF_WEEK.map(d => {
                      const active = parseJsonArray(editingTr.specificDays).includes(d.id);
                      return (
                        <button
                          key={d.id}
                          onClick={() => toggleSpecificDay(d.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${active ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                        >
                          {d.short}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {editingTr.schedule === 'monthly' && (
                <div>
                  <label className={labelCls}>Числа месяца</label>
                  <div className="flex flex-wrap gap-1">
                    {Array.from({ length: 31 }, (_, i) => i + 1).map(day => {
                      const active = parseJsonArray(editingTr.specificDays).includes(day);
                      return (
                        <button
                          key={day}
                          onClick={() => toggleSpecificDay(day)}
                          className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${active ? 'bg-teal-600 text-white' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <label className={labelCls}>Сумма</label>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="radio"
                      name="trAmountMode"
                      checked={editingTr.transferAll || false}
                      onChange={() => setEditingTr({ ...editingTr, transferAll: true })}
                      className="accent-teal-600"
                    />
                    <span className="text-sm text-slate-600">Весь остаток</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="radio"
                      name="trAmountMode"
                      checked={!editingTr.transferAll}
                      onChange={() => setEditingTr({ ...editingTr, transferAll: false })}
                      className="accent-teal-600"
                    />
                    <span className="text-sm text-slate-600">Фиксированная сумма</span>
                  </label>
                  {!editingTr.transferAll && (
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editingTr.amount ?? ''}
                      onChange={e => setEditingTr({ ...editingTr, amount: parseFloat(e.target.value) || 0 })}
                      className={`${inputCls} max-w-[180px]`}
                      placeholder="Сумма ₽"
                    />
                  )}
                </div>
              </div>

              <div>
                <button
                  onClick={() => setShowAdvancedTr(!showAdvancedTr)}
                  className="flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showAdvancedTr ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  Дополнительные настройки
                </button>
              </div>

              {showAdvancedTr && (
                <div className="space-y-4 pt-2 border-t border-slate-100">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Мин. остаток на счёте-источнике</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editingTr.leaveMinBalance || ''}
                        onChange={e => setEditingTr({ ...editingTr, leaveMinBalance: parseFloat(e.target.value) || 0 })}
                        className={inputCls}
                        placeholder="0"
                      />
                      <p className="text-xs text-slate-400 mt-1">Не переводить если остаток станет ниже</p>
                    </div>
                    <div>
                      <label className={labelCls}>Макс. сумма перевода</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editingTr.maxAmount ?? ''}
                        onChange={e => setEditingTr({ ...editingTr, maxAmount: e.target.value ? parseFloat(e.target.value) : null })}
                        className={inputCls}
                        placeholder="Без ограничений"
                      />
                      <p className="text-xs text-slate-400 mt-1">Ограничить макс. сумму за раз</p>
                    </div>
                  </div>

                  {editingTr.schedule === 'daily' && (
                    <div>
                      <label className={labelCls}>Пропускать дни</label>
                      <div className="flex flex-wrap gap-1.5">
                        {DAYS_OF_WEEK.map(d => {
                          const active = parseJsonArray(editingTr.skipDays).includes(d.id);
                          return (
                            <button
                              key={d.id}
                              onClick={() => toggleSkipDay(d.id)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${active ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                            >
                              {d.short}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {editingTr.schedule !== 'daily' && (
                    <div>
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={editingTr.skipWeekends || false}
                          onChange={e => setEditingTr({ ...editingTr, skipWeekends: e.target.checked })}
                          className="rounded accent-teal-600"
                        />
                        <span className="text-sm text-slate-600">Пропускать выходные</span>
                      </label>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1 border-t border-slate-100">
                <button onClick={() => { setEditingTr(null); setShowAdvancedTr(false); }} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-lg transition-colors">Отмена</button>
                <Button onClick={saveTransferRule} className="bg-teal-600 hover:bg-teal-700 text-white px-5 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5">
                  <Check size={16} /> Сохранить
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {transferRules.length === 0 && !editingTr && (
              <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <p className="text-sm text-slate-400">Нет правил автоматических перемещений.</p>
              </div>
            )}
            {transferRules.map(rule => (
              <div key={rule.id} className={`bg-white rounded-xl px-4 py-3 border transition-all ${rule.enabled ? 'border-slate-200 shadow-sm' : 'border-slate-100 opacity-50'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-700">
                      {rule.fromAccountName} <span className="text-slate-400 mx-1">→</span> {rule.toAccountName}
                    </div>
                    <div className="text-xs text-slate-400 mt-1 flex flex-wrap gap-x-2 gap-y-0.5">
                      <span>{formatSchedule(rule)}</span>
                      <span>·</span>
                      <span>{formatAmount(rule)}</span>
                      {rule.skipWeekends && <><span>·</span><span>без выходных</span></>}
                      {parseJsonArray(rule.skipDays).length > 0 && (
                        <><span>·</span><span>кроме {parseJsonArray(rule.skipDays).map((d: string) => DAYS_OF_WEEK.find(dw => dw.id === d)?.short || d).join(', ')}</span></>
                      )}
                      {rule.description && <><span>·</span><span>{rule.description}</span></>}
                    </div>
                    {rule.lastRunDate && (
                      <div className="text-xs text-slate-300 mt-0.5">Последний запуск: {rule.lastRunDate}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 ml-3 shrink-0">
                    <button
                      onClick={() => toggleTransferEnabled(rule)}
                      className={`p-1.5 rounded transition-colors ${rule.enabled ? 'text-teal-500 hover:text-teal-700' : 'text-slate-300 hover:text-slate-500'}`}
                      title={rule.enabled ? 'Выключить' : 'Включить'}
                    >
                      {rule.enabled ? <Power size={14} /> : <PowerOff size={14} />}
                    </button>
                    <button
                      onClick={() => { setEditingTr(rule); setShowAdvancedTr(false); }}
                      className="p-1.5 text-slate-400 hover:text-teal-600 rounded transition-colors"
                    ><Pencil size={14} /></button>
                    <button
                      onClick={() => deleteTransferRule(rule.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-500 rounded transition-colors"
                    ><Trash2 size={14} /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
