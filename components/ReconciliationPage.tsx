import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Landmark, ArrowDownCircle, ArrowUpCircle, ArrowLeftRight, Info } from 'lucide-react';
import { formatCurrency } from '../utils/format';
import { getMoscowNow } from '../utils/moscow';

interface SettlementAccount {
  id: number;
  name: string;
}

interface TxDetail {
  id: number;
  amount: number;
  description: string;
  categoryName?: string;
  studioName?: string;
  fromAccountName?: string;
  toAccountName?: string;
  contractorName?: string;
  status?: string;
  direction?: 'in' | 'out';
}

interface DayData {
  date: string;
  openBalance: number;
  income: number;
  expense: number;
  transferOut: number;
  transferIn: number;
  closeBalance: number;
  incomeDetails: TxDetail[];
  expenseDetails: TxDetail[];
  transferDetails: TxDetail[];
}

interface ReconciliationData {
  accountId: number;
  accountName: string;
  balanceBefore: number;
  days: DayData[];
}

const DAY_NAMES = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const MONTH_NAMES = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

function fmtMoney(v: number) {
  return new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(v);
}

export const ReconciliationPage: React.FC = () => {
  const now = getMoscowNow();
  const [accounts, setAccounts] = useState<SettlementAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState<ReconciliationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch('/api/reconciliation/accounts')
      .then(r => r.json())
      .then(list => {
        setAccounts(list);
        if (list.length > 0 && !selectedAccountId) setSelectedAccountId(list[0].id);
      })
      .catch(() => {});
  }, []);

  const fetchData = useCallback(() => {
    if (!selectedAccountId) return;
    setLoading(true);
    const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    fetch(`/api/reconciliation?settlementAccountId=${selectedAccountId}&startDate=${startDate}&endDate=${endDate}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [selectedAccountId, month, year]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
    setExpandedDays(new Set());
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
    setExpandedDays(new Set());
  };

  const toggleDay = (dateStr: string) => {
    setExpandedDays(prev => {
      const next = new Set(prev);
      if (next.has(dateStr)) next.delete(dateStr);
      else next.add(dateStr);
      return next;
    });
  };

  const isWeekend = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.getDay() === 0 || d.getDay() === 6;
  };

  const isToday = (dateStr: string) => {
    const today = getMoscowNow();
    return dateStr === `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  };

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Landmark className="text-teal-600" size={24} />
          <h1 className="text-xl font-bold text-slate-800">Сверка остатков</h1>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-slate-600">Счёт:</label>
            <select
              value={selectedAccountId || ''}
              onChange={e => { setSelectedAccountId(Number(e.target.value)); setExpandedDays(new Set()); }}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
            >
              {accounts.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
              <ChevronLeft size={20} />
            </button>
            <span className="text-sm font-semibold text-slate-700 min-w-[140px] text-center">
              {MONTH_NAMES[month]} {year}
            </span>
            <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
        </div>
      )}

      {!loading && data && data.days && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <SummaryCard
              label="Остаток на начало"
              value={data.balanceBefore}
              color="text-slate-700"
            />
            <SummaryCard
              label="Поступления за месяц"
              value={data.days.reduce((s, d) => s + d.income, 0)}
              color="text-emerald-600"
              prefix="+"
            />
            <SummaryCard
              label="Расходы за месяц"
              value={data.days.reduce((s, d) => s + d.expense + d.transferOut - d.transferIn, 0)}
              color="text-rose-600"
              prefix="−"
            />
            <SummaryCard
              label="Остаток на конец"
              value={data.days.length > 0 ? data.days[data.days.length - 1].closeBalance : data.balanceBefore}
              color="text-slate-700"
            />
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="hidden sm:grid grid-cols-[60px_60px_1fr_1fr_1fr_1fr_1fr_32px] gap-0 px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wide">
              <div>Дата</div>
              <div>День</div>
              <div className="text-right">На начало</div>
              <div className="text-right text-emerald-600">Поступления</div>
              <div className="text-right text-rose-600">Расходы</div>
              <div className="text-right text-blue-600">Переводы</div>
              <div className="text-right">На конец</div>
              <div></div>
            </div>

            {data.days.map(day => {
              const hasMovement = day.income > 0 || day.expense > 0 || day.transferOut > 0 || day.transferIn > 0;
              const expanded = expandedDays.has(day.date);
              const weekend = isWeekend(day.date);
              const today = isToday(day.date);
              const dayNum = new Date(day.date).getDate();
              const dayName = DAY_NAMES[new Date(day.date).getDay()];
              const netTransfer = day.transferIn - day.transferOut;

              return (
                <div key={day.date}>
                  <div
                    className={`grid grid-cols-[60px_60px_1fr_1fr_1fr_1fr_1fr_32px] gap-0 px-4 py-2.5 border-b border-slate-100 items-center cursor-pointer transition-colors
                      ${today ? 'bg-teal-50/50 border-l-2 border-l-teal-400' : ''}
                      ${weekend && !today ? 'bg-slate-50/50' : ''}
                      ${hasMovement ? 'hover:bg-slate-50' : 'hover:bg-slate-50/30'}
                      ${!hasMovement ? 'opacity-60' : ''}
                    `}
                    onClick={() => hasMovement && toggleDay(day.date)}
                  >
                    <div className={`text-sm font-semibold ${today ? 'text-teal-700' : 'text-slate-700'}`}>{dayNum}</div>
                    <div className={`text-xs ${weekend ? 'text-rose-400 font-medium' : 'text-slate-400'}`}>{dayName}</div>
                    <div className="text-sm text-right text-slate-600 font-medium tabular-nums">{fmtMoney(day.openBalance)}</div>
                    <div className={`text-sm text-right tabular-nums ${day.income > 0 ? 'text-emerald-600 font-medium' : 'text-slate-300'}`}>
                      {day.income > 0 ? `+${fmtMoney(day.income)}` : '—'}
                    </div>
                    <div className={`text-sm text-right tabular-nums ${day.expense > 0 ? 'text-rose-600 font-medium' : 'text-slate-300'}`}>
                      {day.expense > 0 ? `−${fmtMoney(day.expense)}` : '—'}
                    </div>
                    <div className={`text-sm text-right tabular-nums ${netTransfer !== 0 ? (netTransfer > 0 ? 'text-blue-600' : 'text-orange-600') + ' font-medium' : 'text-slate-300'}`}>
                      {netTransfer !== 0 ? `${netTransfer > 0 ? '+' : ''}${fmtMoney(netTransfer)}` : '—'}
                    </div>
                    <div className="text-sm text-right font-semibold tabular-nums text-slate-700">{fmtMoney(day.closeBalance)}</div>
                    <div className="flex justify-center">
                      {hasMovement && (
                        expanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />
                      )}
                    </div>
                  </div>

                  {expanded && hasMovement && (
                    <div className="bg-slate-50/80 border-b border-slate-200 px-6 py-3 space-y-3">
                      {day.incomeDetails.length > 0 && (
                        <DetailSection
                          title="Поступления"
                          icon={<ArrowDownCircle size={14} className="text-emerald-500" />}
                          items={day.incomeDetails}
                          type="income"
                        />
                      )}
                      {day.expenseDetails.length > 0 && (
                        <DetailSection
                          title="Расходы"
                          icon={<ArrowUpCircle size={14} className="text-rose-500" />}
                          items={day.expenseDetails}
                          type="expense"
                        />
                      )}
                      {day.transferDetails.length > 0 && (
                        <DetailSection
                          title="Переводы"
                          icon={<ArrowLeftRight size={14} className="text-blue-500" />}
                          items={day.transferDetails}
                          type="transfer"
                        />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex items-start gap-2 text-xs text-slate-400 px-1">
            <Info size={14} className="shrink-0 mt-0.5" />
            <span>Поступления отображаются по дате зачисления. Расходы — только оплаченные и проверенные. Переводы — подтверждённые.</span>
          </div>
        </>
      )}

      {!loading && accounts.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
          <Landmark size={48} className="text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500 font-medium">Нет настроенных счетов зачисления</p>
          <p className="text-sm text-slate-400 mt-1">Настройте правила счетов зачисления в разделе Настройки → Правила</p>
        </div>
      )}
    </div>
  );
};

const SummaryCard: React.FC<{ label: string; value: number; color: string; prefix?: string }> = ({ label, value, color, prefix }) => (
  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
    <div className="text-xs text-slate-500 mb-1">{label}</div>
    <div className={`text-lg font-bold tabular-nums ${color}`}>
      {prefix && value > 0 ? prefix : ''}{fmtMoney(Math.abs(value))} ₽
    </div>
  </div>
);

const DetailSection: React.FC<{ title: string; icon: React.ReactNode; items: TxDetail[]; type: string }> = ({ title, icon, items, type }) => (
  <div>
    <div className="flex items-center gap-1.5 mb-1.5">
      {icon}
      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{title}</span>
      <span className="text-xs text-slate-400">({items.length})</span>
    </div>
    <div className="space-y-1">
      {items.map(item => (
        <div key={item.id} className="flex items-center justify-between gap-2 text-sm px-2 py-1 rounded bg-white border border-slate-100">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {type === 'transfer' ? (
              <span className={`text-xs ${item.direction === 'in' ? 'text-blue-600' : 'text-orange-600'}`}>
                {item.direction === 'in' ? `← ${item.fromAccountName}` : `→ ${item.toAccountName}`}
              </span>
            ) : (
              <>
                {item.categoryName && <span className="text-xs text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded">{item.categoryName}</span>}
                {item.studioName && <span className="text-xs text-slate-400">{item.studioName}</span>}
                {type === 'income' && item.fromAccountName && <span className="text-xs text-slate-400">← {item.fromAccountName}</span>}
                {type === 'expense' && item.contractorName && <span className="text-xs text-slate-400">{item.contractorName}</span>}
              </>
            )}
            {item.description && <span className="text-xs text-slate-400 truncate">{item.description}</span>}
          </div>
          <span className={`text-sm font-medium tabular-nums whitespace-nowrap ${
            type === 'income' ? 'text-emerald-600' :
            type === 'expense' ? 'text-rose-600' :
            item.direction === 'in' ? 'text-blue-600' : 'text-orange-600'
          }`}>
            {type === 'income' ? '+' : type === 'expense' ? '−' : item.direction === 'in' ? '+' : '−'}
            {fmtMoney(item.amount)} ₽
          </span>
        </div>
      ))}
    </div>
  </div>
);
