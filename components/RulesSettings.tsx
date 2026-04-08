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
  dayDelays: string;
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
  intervalValue: number;
}

const WEEKEND_RULES: { id: string; label: string }[] = [
  { id: 'next_business_day', label: 'Следующий рабочий день' },
  { id: 'saturday_ok', label: 'Суббота — рабочий' },
  { id: 'previous_business_day', label: 'Предыдущий рабочий день' },
  { id: 'no_adjustment', label: 'Без корректировки' },
];

const SCHEDULE_OPTIONS: { id: string; label: string; hint?: string }[] = [
  { id: 'daily', label: 'Ежедневно' },
  { id: 'weekdays', label: 'По будням (Пн–Пт)' },
  { id: 'weekly', label: 'По дням недели', hint: 'Выберите конкретные дни' },
  { id: 'biweekly', label: 'Раз в 2 недели', hint: 'Выберите день недели' },
  { id: 'every_n_days', label: 'Каждые N дней', hint: 'Задайте интервал' },
  { id: 'monthly', label: 'По числам месяца', hint: 'Выберите числа' },
  { id: 'last_day_of_month', label: 'Последний день месяца' },
  { id: 'first_business_day', label: 'Первый рабочий день месяца' },
  { id: 'last_business_day', label: 'Последний рабочий день месяца' },
];

const DAYS_OF_WEEK: { id: string; short: string }[] = [
  { id: 'mon', short: 'Пн' },
  { id: 'tue', short: 'Вт' },
  { id: 'wed', short: 'Ср' },
  { id: 'thu', short: 'Чт' },
  { id: 'fri', short: 'Пт' },
  { id: 'sat', short: 'Сб' },
  { id: 'sun', short: 'Вс' },
];

function parseJsonArray(v: any): any[] {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') { try { return JSON.parse(v); } catch { return []; } }
  return [];
}

function parseJsonObj(v: any): Record<string, any> {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v;
  if (typeof v === 'string') { try { const p = JSON.parse(v); return (p && typeof p === 'object') ? p : {}; } catch { return {}; } }
  return {};
}

export const RulesSettings: React.FC = () => {
  const { accounts, categories, studios } = useFinance();
  const [creditRules, setCreditRules] = useState<CreditDateRule[]>([]);
  const [transferRules, setTransferRules] = useState<AutoTransferRule[]>([]);
  const [rulesTab, setRulesTab] = useState<'credit' | 'transfer'>('credit');
  const [editingCr, setEditingCr] = useState<Partial<CreditDateRule> | null>(null);
  const [editingTr, setEditingTr] = useState<Partial<AutoTransferRule> | null>(null);
  const [showAdvancedTr, setShowAdvancedTr] = useState(false);
  const [useDayDelays, setUseDayDelays] = useState(false);

  const loadCreditRules = () => { fetch('/api/credit-date-rules').then(r => r.json()).then(setCreditRules).catch(() => {}); };
  const loadTransferRules = () => { fetch('/api/auto-transfer-rules').then(r => r.json()).then(setTransferRules).catch(() => {}); };
  useEffect(() => { loadCreditRules(); loadTransferRules(); }, []);

  const startEditCr = (rule?: CreditDateRule) => {
    if (rule) {
      setEditingCr(rule);
      const dd = parseJsonObj(rule.dayDelays);
      setUseDayDelays(Object.keys(dd).length > 0);
    } else {
      setEditingCr({ delayDays: 1, weekendRule: 'next_business_day', enabled: true, categoryId: null, studioId: null, dayDelays: '{}' });
      setUseDayDelays(false);
    }
  };

  const saveCreditRule = async () => {
    if (!editingCr || !editingCr.accountId) return;
    const dayDelays = useDayDelays ? parseJsonObj(editingCr.dayDelays) : {};
    const method = editingCr.id ? 'PUT' : 'POST';
    const url = editingCr.id ? `/api/credit-date-rules/${editingCr.id}` : '/api/credit-date-rules';
    await fetch(url, {
      method, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: editingCr.accountId, delayDays: editingCr.delayDays || 1,
        weekendRule: editingCr.weekendRule || 'next_business_day', name: editingCr.name || '',
        enabled: editingCr.enabled !== false, categoryId: editingCr.categoryId || null,
        studioId: editingCr.studioId || null, dayDelays,
      }),
    });
    setEditingCr(null);
    loadCreditRules();
  };

  const toggleCreditEnabled = async (rule: CreditDateRule) => {
    await fetch(`/api/credit-date-rules/${rule.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...rule, enabled: !rule.enabled, dayDelays: parseJsonObj(rule.dayDelays) }),
    });
    loadCreditRules();
  };

  const deleteCreditRule = async (id: number) => {
    await fetch(`/api/credit-date-rules/${id}`, { method: 'DELETE' });
    loadCreditRules();
  };

  const saveTransferRule = async () => {
    if (!editingTr || !editingTr.fromAccountId || !editingTr.toAccountId) return;
    const sched = editingTr.schedule || 'daily';
    if ((sched === 'weekly' || sched === 'biweekly' || sched === 'monthly') && parseJsonArray(editingTr.specificDays).length === 0) {
      alert(sched === 'monthly' ? 'Выберите хотя бы одно число месяца' : 'Выберите хотя бы один день недели');
      return;
    }
    const method = editingTr.id ? 'PUT' : 'POST';
    const url = editingTr.id ? `/api/auto-transfer-rules/${editingTr.id}` : '/api/auto-transfer-rules';
    await fetch(url, {
      method, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromAccountId: editingTr.fromAccountId, toAccountId: editingTr.toAccountId,
        schedule: sched, skipWeekends: editingTr.skipWeekends || false,
        skipDays: parseJsonArray(editingTr.skipDays),
        amount: editingTr.transferAll ? null : (editingTr.amount || 0),
        transferAll: editingTr.transferAll || false, description: editingTr.description || '',
        enabled: editingTr.enabled !== false, leaveMinBalance: editingTr.leaveMinBalance || 0,
        specificDays: parseJsonArray(editingTr.specificDays), maxAmount: editingTr.maxAmount || null,
        intervalValue: editingTr.intervalValue || 1,
      }),
    });
    setEditingTr(null); setShowAdvancedTr(false);
    loadTransferRules();
  };

  const toggleTransferEnabled = async (rule: AutoTransferRule) => {
    await fetch(`/api/auto-transfer-rules/${rule.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
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
    alert(data.executed?.length > 0 ? `Выполнено ${data.executed.length} перемещений` : 'Нет перемещений для выполнения');
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

  const setDayDelay = (dayId: string, value: string) => {
    if (!editingCr) return;
    const dd = parseJsonObj(editingCr.dayDelays);
    if (value === '' || value === undefined) {
      delete dd[dayId];
    } else {
      dd[dayId] = parseInt(value) || 0;
    }
    setEditingCr({ ...editingCr, dayDelays: JSON.stringify(dd) });
  };

  const pluralDays = (n: number) => n === 1 ? 'день' : (n >= 2 && n <= 4) ? 'дня' : 'дней';

  const formatSchedule = (rule: AutoTransferRule) => {
    const specific = parseJsonArray(rule.specificDays);
    switch (rule.schedule) {
      case 'daily': return 'Ежедневно';
      case 'weekdays': return 'По будням';
      case 'weekly':
        return specific.length > 0 ? `Еженедельно: ${specific.map((d: string) => DAYS_OF_WEEK.find(dw => dw.id === d)?.short || d).join(', ')}` : 'Еженедельно';
      case 'biweekly':
        return specific.length > 0 ? `Раз в 2 нед: ${specific.map((d: string) => DAYS_OF_WEEK.find(dw => dw.id === d)?.short || d).join(', ')}` : 'Раз в 2 недели';
      case 'every_n_days':
        return `Каждые ${rule.intervalValue || 1} ${pluralDays(rule.intervalValue || 1)}`;
      case 'monthly':
        return specific.length > 0 ? `Ежемесячно: ${specific.sort((a: number, b: number) => a - b).join(', ')} числа` : 'Ежемесячно';
      case 'last_day_of_month': return 'Последний день месяца';
      case 'first_business_day': return '1-й рабочий день';
      case 'last_business_day': return 'Последний рабочий день';
      default: return rule.schedule;
    }
  };

  const formatAmount = (rule: AutoTransferRule) => {
    const parts: string[] = [];
    if (rule.transferAll) parts.push('весь остаток');
    else if (rule.amount) parts.push(`${Number(rule.amount).toLocaleString('ru-RU')} ₽`);
    if (rule.leaveMinBalance && parseFloat(String(rule.leaveMinBalance)) > 0)
      parts.push(`мин. ${Number(rule.leaveMinBalance).toLocaleString('ru-RU')} ₽`);
    if (rule.maxAmount && parseFloat(String(rule.maxAmount)) > 0)
      parts.push(`макс. ${Number(rule.maxAmount).toLocaleString('ru-RU')} ₽`);
    return parts.join(' · ');
  };

  const formatCreditDelays = (rule: CreditDateRule) => {
    const dd = parseJsonObj(rule.dayDelays);
    const hasDayDelays = Object.keys(dd).length > 0;
    if (!hasDayDelays) {
      return `+${rule.delayDays} ${pluralDays(rule.delayDays)}`;
    }
    const parts = DAYS_OF_WEEK.map(d => {
      const val = dd[d.id] !== undefined ? dd[d.id] : rule.delayDays;
      return `${d.short}:${val}`;
    });
    return parts.join(' · ');
  };

  const needsDayPicker = (sched: string) => sched === 'weekly' || sched === 'biweekly';
  const needsMonthPicker = (sched: string) => sched === 'monthly';
  const needsInterval = (sched: string) => sched === 'every_n_days';

  const inputCls = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400 transition-colors";
  const labelCls = "block text-xs font-medium text-slate-500 mb-1.5";
  const pillActive = "bg-teal-600 text-white";
  const pillInactive = "bg-slate-100 text-slate-500 hover:bg-slate-200";

  return (
    <div className="space-y-5">
      <div className="flex gap-4 border-b border-slate-200">
        <button onClick={() => setRulesTab('credit')}
          className={`pb-3 text-sm font-semibold transition-colors border-b-2 px-1 ${rulesTab === 'credit' ? 'text-slate-800 border-teal-500' : 'text-slate-400 border-transparent hover:text-slate-600'}`}>
          Даты зачисления
        </button>
        <button onClick={() => setRulesTab('transfer')}
          className={`pb-3 text-sm font-semibold transition-colors border-b-2 px-1 ${rulesTab === 'transfer' ? 'text-slate-800 border-teal-500' : 'text-slate-400 border-transparent hover:text-slate-600'}`}>
          Авто-перемещения
        </button>
      </div>

      {rulesTab === 'credit' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm text-slate-500">Настройте задержку зачисления по счетам. Можно задать разную задержку для каждого дня недели.</p>
            <Button onClick={() => startEditCr()}
              className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 shrink-0">
              <Plus size={16} /> Добавить
            </Button>
          </div>

          {editingCr && (
            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Счёт *</label>
                  <select value={editingCr.accountId || ''} onChange={e => setEditingCr({ ...editingCr, accountId: Number(e.target.value) })} className={inputCls}>
                    <option value="">Выберите счёт</option>
                    {accountOptions.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Название</label>
                  <input value={editingCr.name || ''} onChange={e => setEditingCr({ ...editingCr, name: e.target.value })} className={inputCls} placeholder="Например: Карта Сбербанк" />
                </div>
              </div>

              <div>
                <div className="flex items-center gap-3 mb-2">
                  <label className="text-xs font-medium text-slate-500">Режим задержки</label>
                  <div className="flex bg-slate-100 rounded-lg p-0.5">
                    <button onClick={() => setUseDayDelays(false)}
                      className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${!useDayDelays ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                      Единая
                    </button>
                    <button onClick={() => setUseDayDelays(true)}
                      className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${useDayDelays ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                      По дням недели
                    </button>
                  </div>
                </div>

                {!useDayDelays ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Задержка (дней)</label>
                      <input type="number" min="0" value={editingCr.delayDays ?? 1}
                        onChange={e => setEditingCr({ ...editingCr, delayDays: parseInt(e.target.value) || 0 })} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Выходные</label>
                      <select value={editingCr.weekendRule || 'next_business_day'} onChange={e => setEditingCr({ ...editingCr, weekendRule: e.target.value })} className={inputCls}>
                        {WEEKEND_RULES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                      </select>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                      <div className="grid grid-cols-7 gap-2">
                        {DAYS_OF_WEEK.map(d => {
                          const dd = parseJsonObj(editingCr.dayDelays);
                          const val = dd[d.id] !== undefined ? String(dd[d.id]) : '';
                          return (
                            <div key={d.id} className="text-center">
                              <div className={`text-xs font-medium mb-1 ${d.id === 'sat' || d.id === 'sun' ? 'text-rose-400' : 'text-slate-500'}`}>{d.short}</div>
                              <input
                                type="number" min="0" value={val}
                                onChange={e => setDayDelay(d.id, e.target.value)}
                                className="w-full border border-slate-200 rounded-lg px-1.5 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400"
                                placeholder={String(editingCr.delayDays ?? 1)}
                              />
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-xs text-slate-400 mt-2 text-center">Пустое поле = задержка по умолчанию ({editingCr.delayDays ?? 1} {pluralDays(editingCr.delayDays ?? 1)})</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className={labelCls}>Задержка по умолчанию (дней)</label>
                        <input type="number" min="0" value={editingCr.delayDays ?? 1}
                          onChange={e => setEditingCr({ ...editingCr, delayDays: parseInt(e.target.value) || 0 })} className={inputCls} />
                      </div>
                      <div>
                        <label className={labelCls}>Выходные</label>
                        <select value={editingCr.weekendRule || 'next_business_day'} onChange={e => setEditingCr({ ...editingCr, weekendRule: e.target.value })} className={inputCls}>
                          {WEEKEND_RULES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Категория дохода (необязательно)</label>
                  <select value={editingCr.categoryId || ''} onChange={e => setEditingCr({ ...editingCr, categoryId: e.target.value ? Number(e.target.value) : null })} className={inputCls}>
                    <option value="">Все категории</option>
                    {incomeCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Студия (необязательно)</label>
                  <select value={editingCr.studioId || ''} onChange={e => setEditingCr({ ...editingCr, studioId: e.target.value ? Number(e.target.value) : null })} className={inputCls}>
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
                <p className="text-sm text-slate-400">Нет правил. Нажмите «Добавить» для создания.</p>
              </div>
            )}
            {creditRules.map(rule => (
              <div key={rule.id} className={`flex items-center justify-between bg-white rounded-xl px-4 py-3 border transition-all ${rule.enabled ? 'border-slate-200 shadow-sm' : 'border-slate-100 opacity-50'}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-slate-700">{rule.accountName}</span>
                    {rule.name && <span className="text-xs text-slate-400">({rule.name})</span>}
                    {rule.categoryName && <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{rule.categoryName}</span>}
                    {rule.studioName && <span className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full">{rule.studioName}</span>}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    {formatCreditDelays(rule)} · {WEEKEND_RULES.find(r => r.id === rule.weekendRule)?.label || rule.weekendRule}
                  </div>
                </div>
                <div className="flex items-center gap-1 ml-3 shrink-0">
                  <button onClick={() => toggleCreditEnabled(rule)}
                    className={`p-1.5 rounded transition-colors ${rule.enabled ? 'text-teal-500 hover:text-teal-700' : 'text-slate-300 hover:text-slate-500'}`}
                    title={rule.enabled ? 'Выключить' : 'Включить'}>
                    {rule.enabled ? <Power size={14} /> : <PowerOff size={14} />}
                  </button>
                  <button onClick={() => startEditCr(rule)} className="p-1.5 text-slate-400 hover:text-teal-600 rounded transition-colors"><Pencil size={14} /></button>
                  <button onClick={() => deleteCreditRule(rule.id)} className="p-1.5 text-slate-400 hover:text-rose-500 rounded transition-colors"><Trash2 size={14} /></button>
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
              <Button onClick={executeTransfers}
                className="bg-slate-600 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5">
                <Play size={14} /> Выполнить сейчас
              </Button>
              <Button onClick={() => { setEditingTr({ schedule: 'daily', enabled: true, transferAll: false, skipWeekends: false, leaveMinBalance: 0, specificDays: '[]', skipDays: '[]', maxAmount: null, intervalValue: 1 }); setShowAdvancedTr(false); }}
                className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5">
                <Plus size={16} /> Добавить
              </Button>
            </div>
          </div>

          {editingTr && (
            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Со счёта *</label>
                  <select value={editingTr.fromAccountId || ''} onChange={e => setEditingTr({ ...editingTr, fromAccountId: Number(e.target.value) })} className={inputCls}>
                    <option value="">Выберите счёт</option>
                    {accountOptions.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>На счёт *</label>
                  <select value={editingTr.toAccountId || ''} onChange={e => setEditingTr({ ...editingTr, toAccountId: Number(e.target.value) })} className={inputCls}>
                    <option value="">Выберите счёт</option>
                    {accountOptions.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className={labelCls}>Расписание</label>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {SCHEDULE_OPTIONS.map(s => (
                    <button key={s.id} onClick={() => setEditingTr({ ...editingTr, schedule: s.id, specificDays: '[]' })}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${editingTr.schedule === s.id ? pillActive : pillInactive}`}>
                      {s.label}
                    </button>
                  ))}
                </div>

                {needsInterval(editingTr.schedule || '') && (
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-sm text-slate-500">Каждые</span>
                    <input type="number" min="1" value={editingTr.intervalValue || 1}
                      onChange={e => setEditingTr({ ...editingTr, intervalValue: parseInt(e.target.value) || 1 })}
                      className="w-20 border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-teal-500/30" />
                    <span className="text-sm text-slate-500">{pluralDays(editingTr.intervalValue || 1)}</span>
                  </div>
                )}

                {needsDayPicker(editingTr.schedule || '') && (
                  <div className="mb-3">
                    <label className={labelCls}>{editingTr.schedule === 'biweekly' ? 'День недели' : 'Дни недели'}</label>
                    <div className="flex flex-wrap gap-1.5">
                      {DAYS_OF_WEEK.map(d => {
                        const active = parseJsonArray(editingTr.specificDays).includes(d.id);
                        return (
                          <button key={d.id} onClick={() => toggleSpecificDay(d.id)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${active ? pillActive : pillInactive}`}>
                            {d.short}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {needsMonthPicker(editingTr.schedule || '') && (
                  <div className="mb-3">
                    <label className={labelCls}>Числа месяца</label>
                    <div className="flex flex-wrap gap-1">
                      {Array.from({ length: 31 }, (_, i) => i + 1).map(day => {
                        const active = parseJsonArray(editingTr.specificDays).includes(day);
                        return (
                          <button key={day} onClick={() => toggleSpecificDay(day)}
                            className={`w-9 h-9 rounded-lg text-xs font-medium transition-colors ${active ? pillActive : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}>
                            {day}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Описание</label>
                  <input value={editingTr.description || ''} onChange={e => setEditingTr({ ...editingTr, description: e.target.value })} className={inputCls} placeholder="Авто-перемещение" />
                </div>
              </div>

              <div>
                <label className={labelCls}>Сумма</label>
                <div className="flex items-center gap-4 flex-wrap">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="radio" name="trAmountMode" checked={editingTr.transferAll || false}
                      onChange={() => setEditingTr({ ...editingTr, transferAll: true })} className="accent-teal-600" />
                    <span className="text-sm text-slate-600">Весь остаток</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="radio" name="trAmountMode" checked={!editingTr.transferAll}
                      onChange={() => setEditingTr({ ...editingTr, transferAll: false })} className="accent-teal-600" />
                    <span className="text-sm text-slate-600">Фиксированная сумма</span>
                  </label>
                  {!editingTr.transferAll && (
                    <input type="number" min="0" step="0.01" value={editingTr.amount ?? ''}
                      onChange={e => setEditingTr({ ...editingTr, amount: parseFloat(e.target.value) || 0 })}
                      className={`${inputCls} max-w-[180px]`} placeholder="Сумма ₽" />
                  )}
                </div>
              </div>

              <div>
                <button onClick={() => setShowAdvancedTr(!showAdvancedTr)}
                  className="flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-slate-600 transition-colors">
                  {showAdvancedTr ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  Дополнительные настройки
                </button>
              </div>

              {showAdvancedTr && (
                <div className="space-y-4 pt-2 border-t border-slate-100">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Мин. остаток на счёте-источнике</label>
                      <input type="number" min="0" step="0.01" value={editingTr.leaveMinBalance || ''}
                        onChange={e => setEditingTr({ ...editingTr, leaveMinBalance: parseFloat(e.target.value) || 0 })}
                        className={inputCls} placeholder="0" />
                      <p className="text-xs text-slate-400 mt-1">Не переводить если остаток станет ниже</p>
                    </div>
                    <div>
                      <label className={labelCls}>Макс. сумма перевода</label>
                      <input type="number" min="0" step="0.01" value={editingTr.maxAmount ?? ''}
                        onChange={e => setEditingTr({ ...editingTr, maxAmount: e.target.value ? parseFloat(e.target.value) : null })}
                        className={inputCls} placeholder="Без ограничений" />
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
                            <button key={d.id} onClick={() => toggleSkipDay(d.id)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${active ? 'bg-rose-100 text-rose-600' : pillInactive}`}>
                              {d.short}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {editingTr.schedule !== 'daily' && editingTr.schedule !== 'weekdays' && (
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input type="checkbox" checked={editingTr.skipWeekends || false}
                        onChange={e => setEditingTr({ ...editingTr, skipWeekends: e.target.checked })} className="rounded accent-teal-600" />
                      <span className="text-sm text-slate-600">Пропускать выходные</span>
                    </label>
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
                    {rule.lastRunDate && <div className="text-xs text-slate-300 mt-0.5">Последний запуск: {rule.lastRunDate}</div>}
                  </div>
                  <div className="flex items-center gap-1 ml-3 shrink-0">
                    <button onClick={() => toggleTransferEnabled(rule)}
                      className={`p-1.5 rounded transition-colors ${rule.enabled ? 'text-teal-500 hover:text-teal-700' : 'text-slate-300 hover:text-slate-500'}`}
                      title={rule.enabled ? 'Выключить' : 'Включить'}>
                      {rule.enabled ? <Power size={14} /> : <PowerOff size={14} />}
                    </button>
                    <button onClick={() => { setEditingTr(rule); setShowAdvancedTr(false); }} className="p-1.5 text-slate-400 hover:text-teal-600 rounded transition-colors"><Pencil size={14} /></button>
                    <button onClick={() => deleteTransferRule(rule.id)} className="p-1.5 text-slate-400 hover:text-rose-500 rounded transition-colors"><Trash2 size={14} /></button>
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
