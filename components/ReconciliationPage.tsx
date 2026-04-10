import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, Landmark, TrendingUp, TrendingDown, ArrowRightLeft, Wallet, CircleDollarSign, ArrowDownRight, ArrowUpRight, Building2 } from 'lucide-react';
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

const DAY_NAMES_SHORT = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const MONTH_NAMES = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const MONTH_NAMES_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

function fmt(v: number) {
  return new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(v);
}

function fmtSigned(v: number, showPlus = true) {
  const sign = v > 0 && showPlus ? '+' : v < 0 ? '' : '';
  return sign + fmt(v);
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

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); setExpandedDays(new Set()); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); setExpandedDays(new Set()); };

  const toggleDay = (dateStr: string) => {
    setExpandedDays(prev => {
      const next = new Set(prev);
      if (next.has(dateStr)) next.delete(dateStr); else next.add(dateStr);
      return next;
    });
  };

  const todayStr = useMemo(() => {
    const t = getMoscowNow();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  }, []);

  const totals = useMemo(() => {
    if (!data?.days) return { income: 0, expense: 0, transferNet: 0, closeBalance: 0, activeDays: 0 };
    const income = data.days.reduce((s, d) => s + d.income, 0);
    const expense = data.days.reduce((s, d) => s + d.expense, 0);
    const transferNet = data.days.reduce((s, d) => s + d.transferIn - d.transferOut, 0);
    const closeBalance = data.days.length > 0 ? data.days[data.days.length - 1].closeBalance : data.balanceBefore;
    const activeDays = data.days.filter(d => d.income > 0 || d.expense > 0 || d.transferIn > 0 || d.transferOut > 0).length;
    return { income, expense, transferNet, closeBalance, activeDays };
  }, [data]);

  const balanceChange = data ? totals.closeBalance - data.balanceBefore : 0;

  if (!loading && accounts.length === 0) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center mx-auto mb-6">
            <Building2 size={36} className="text-slate-400" />
          </div>
          <h2 className="text-lg font-semibold text-slate-700 mb-2">Нет настроенных счетов зачисления</h2>
          <p className="text-sm text-slate-500 leading-relaxed">Чтобы использовать сверку, настройте правила счетов зачисления в разделе <span className="font-medium text-slate-600">Настройки → Правила → Счета зачисления</span></p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto">

      <div className="sticky top-[56px] z-20 bg-[#f1f5f9]/95 backdrop-blur-md -mx-4 lg:-mx-6 px-4 lg:px-6 pt-3 pb-3 border-b border-slate-200/60">
        <div className="flex items-center justify-between flex-wrap gap-3 max-w-[1400px] mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center shadow-md shadow-teal-500/20">
              <Landmark size={18} className="text-white" />
            </div>
            <h1 className="text-lg font-bold text-slate-800 tracking-tight">Сверка остатков</h1>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="relative">
              <select
                value={selectedAccountId || ''}
                onChange={e => { setSelectedAccountId(Number(e.target.value)); setExpandedDays(new Set()); }}
                className="appearance-none bg-white border border-slate-200 rounded-xl pl-9 pr-7 py-2 text-sm font-medium text-slate-700 shadow-sm hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 transition-all cursor-pointer"
              >
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
              <Wallet size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>

            <div className="flex items-center bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <button onClick={prevMonth} className="p-2 hover:bg-slate-50 text-slate-500 hover:text-slate-700 transition-colors">
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm font-semibold text-slate-700 min-w-[120px] text-center select-none">
                {MONTH_NAMES[month]} {year}
              </span>
              <button onClick={nextMonth} className="p-2 hover:bg-slate-50 text-slate-500 hover:text-slate-700 transition-colors">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 lg:px-6 -mx-4 lg:-mx-6 pt-4 space-y-5">

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-full border-[3px] border-slate-200"></div>
            <div className="absolute inset-0 w-10 h-10 rounded-full border-[3px] border-teal-500 border-t-transparent animate-spin"></div>
          </div>
          <span className="text-sm text-slate-400">Загрузка данных...</span>
        </div>
      ) : data && data.days ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-gradient-to-br from-slate-50 to-white rounded-2xl border border-slate-200/80 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center">
                  <Wallet size={14} className="text-slate-500" />
                </div>
                <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">На начало</span>
              </div>
              <div className={`text-xl font-bold tabular-nums ${data.balanceBefore >= 0 ? 'text-slate-700' : 'text-rose-600'}`}>
                {fmt(data.balanceBefore)} <span className="text-sm font-semibold text-slate-400">₽</span>
              </div>
            </div>

            <div className="bg-gradient-to-br from-emerald-50/80 to-white rounded-2xl border border-emerald-200/60 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <TrendingUp size={14} className="text-emerald-600" />
                </div>
                <span className="text-[11px] font-medium text-emerald-500 uppercase tracking-wider">Поступления</span>
              </div>
              <div className="text-xl font-bold tabular-nums text-emerald-600">
                +{fmt(totals.income)} <span className="text-sm font-semibold text-emerald-400">₽</span>
              </div>
            </div>

            <div className="bg-gradient-to-br from-rose-50/80 to-white rounded-2xl border border-rose-200/60 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-rose-100 flex items-center justify-center">
                  <TrendingDown size={14} className="text-rose-600" />
                </div>
                <span className="text-[11px] font-medium text-rose-500 uppercase tracking-wider">Расходы</span>
              </div>
              <div className="text-xl font-bold tabular-nums text-rose-600">
                −{fmt(totals.expense)} <span className="text-sm font-semibold text-rose-400">₽</span>
              </div>
              {totals.transferNet !== 0 && (
                <div className={`text-[11px] mt-1 tabular-nums ${totals.transferNet > 0 ? 'text-blue-500' : 'text-orange-500'}`}>
                  переводы: {fmtSigned(totals.transferNet)} ₽
                </div>
              )}
            </div>

            <div className={`bg-gradient-to-br ${balanceChange >= 0 ? 'from-teal-50/80 to-white border-teal-200/60' : 'from-amber-50/80 to-white border-amber-200/60'} rounded-2xl border p-4 shadow-sm`}>
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-7 h-7 rounded-lg ${balanceChange >= 0 ? 'bg-teal-100' : 'bg-amber-100'} flex items-center justify-center`}>
                  <CircleDollarSign size={14} className={balanceChange >= 0 ? 'text-teal-600' : 'text-amber-600'} />
                </div>
                <span className={`text-[11px] font-medium uppercase tracking-wider ${balanceChange >= 0 ? 'text-teal-500' : 'text-amber-500'}`}>На конец</span>
              </div>
              <div className={`text-xl font-bold tabular-nums ${totals.closeBalance >= 0 ? 'text-slate-700' : 'text-rose-600'}`}>
                {fmt(totals.closeBalance)} <span className="text-sm font-semibold text-slate-400">₽</span>
              </div>
              <div className={`text-[11px] mt-1 tabular-nums font-medium ${balanceChange >= 0 ? 'text-teal-500' : 'text-rose-500'}`}>
                {balanceChange >= 0 ? '↑' : '↓'} {fmtSigned(balanceChange)} за месяц
              </div>
            </div>
          </div>

          <div className="sticky top-[116px] z-10 bg-gradient-to-r from-slate-50 to-slate-100 border border-slate-200 rounded-t-2xl shadow-sm">
            <div className="grid grid-cols-[52px_44px_1fr_1fr_1fr_1fr_1fr_28px] gap-0 px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-[0.08em]">
              <div>Дата</div>
              <div></div>
              <div className="text-right">Начало дня</div>
              <div className="text-right">Поступления</div>
              <div className="text-right">Расходы</div>
              <div className="text-right">Переводы</div>
              <div className="text-right">Конец дня</div>
              <div></div>
            </div>
          </div>
          <div className="bg-white border-x border-b border-slate-200/80 rounded-b-2xl shadow-sm overflow-hidden">

            <div className="divide-y divide-slate-100/80">
              {data.days.map((day, idx) => {
                const hasMovement = day.income > 0 || day.expense > 0 || day.transferOut > 0 || day.transferIn > 0;
                const expanded = expandedDays.has(day.date);
                const d = new Date(day.date);
                const weekend = d.getDay() === 0 || d.getDay() === 6;
                const today = day.date === todayStr;
                const dayNum = d.getDate();
                const dayName = DAY_NAMES_SHORT[d.getDay()];
                const netTransfer = day.transferIn - day.transferOut;
                const balDelta = day.closeBalance - day.openBalance;

                return (
                  <div key={day.date} className={expanded ? 'bg-slate-50/30' : ''}>
                    <div
                      className={`group grid grid-cols-[52px_44px_1fr_1fr_1fr_1fr_1fr_28px] gap-0 px-5 items-center transition-all duration-150
                        ${hasMovement ? 'cursor-pointer' : 'cursor-default'}
                        ${today ? 'bg-teal-50/40' : ''}
                        ${weekend && !today ? 'bg-slate-50/40' : ''}
                        ${!hasMovement ? 'py-2' : 'py-3'}
                        ${hasMovement ? 'hover:bg-slate-50/80' : ''}
                        ${expanded ? 'bg-slate-50/60' : ''}
                      `}
                      onClick={() => hasMovement && toggleDay(day.date)}
                    >
                      <div className="flex items-center gap-0">
                        {today && <div className="w-1 h-6 rounded-full bg-teal-500 -ml-2.5 mr-1.5 shrink-0"></div>}
                        <span className={`text-[15px] font-bold tabular-nums ${today ? 'text-teal-700' : hasMovement ? 'text-slate-700' : 'text-slate-400'}`}>{dayNum}</span>
                      </div>
                      <div>
                        <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded-md ${
                          weekend ? 'text-rose-500 bg-rose-50' : today ? 'text-teal-600 bg-teal-50' : 'text-slate-400'
                        }`}>{dayName}</span>
                      </div>

                      <div className={`text-[13px] text-right tabular-nums font-medium ${!hasMovement ? 'text-slate-300' : 'text-slate-500'}`}>
                        {fmt(day.openBalance)}
                      </div>

                      <div className="text-right">
                        {day.income > 0 ? (
                          <span className="inline-flex items-center gap-0.5 text-[13px] font-semibold tabular-nums text-emerald-600">
                            <ArrowDownRight size={12} className="text-emerald-400" />
                            +{fmt(day.income)}
                          </span>
                        ) : (
                          <span className="text-[13px] text-slate-200">—</span>
                        )}
                      </div>

                      <div className="text-right">
                        {day.expense > 0 ? (
                          <span className="inline-flex items-center gap-0.5 text-[13px] font-semibold tabular-nums text-rose-600">
                            <ArrowUpRight size={12} className="text-rose-400" />
                            −{fmt(day.expense)}
                          </span>
                        ) : (
                          <span className="text-[13px] text-slate-200">—</span>
                        )}
                      </div>

                      <div className="text-right">
                        {netTransfer !== 0 ? (
                          <span className={`inline-flex items-center gap-0.5 text-[13px] font-semibold tabular-nums ${netTransfer > 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                            <ArrowRightLeft size={11} className={netTransfer > 0 ? 'text-blue-400' : 'text-orange-400'} />
                            {fmtSigned(netTransfer)}
                          </span>
                        ) : (
                          <span className="text-[13px] text-slate-200">—</span>
                        )}
                      </div>

                      <div className="text-right">
                        <span className={`text-[13px] font-bold tabular-nums ${
                          !hasMovement ? 'text-slate-300' :
                          day.closeBalance < 0 ? 'text-rose-600' : 'text-slate-700'
                        }`}>
                          {fmt(day.closeBalance)}
                        </span>
                        {hasMovement && (
                          <span className={`block text-[10px] tabular-nums font-medium mt-0.5 ${balDelta > 0 ? 'text-emerald-500' : balDelta < 0 ? 'text-rose-400' : 'text-slate-300'}`}>
                            {balDelta > 0 ? '+' : ''}{fmt(balDelta)}
                          </span>
                        )}
                      </div>

                      <div className="flex justify-center">
                        {hasMovement && (
                          <div className={`w-5 h-5 rounded-md flex items-center justify-center transition-all duration-200 ${expanded ? 'bg-teal-100 text-teal-600 rotate-180' : 'text-slate-300 group-hover:text-slate-500 group-hover:bg-slate-100'}`}>
                            <ChevronDown size={14} />
                          </div>
                        )}
                      </div>
                    </div>

                    {expanded && hasMovement && (
                      <div className="border-t border-slate-100 bg-gradient-to-b from-slate-50/80 to-white">
                        <div className="px-6 py-4 space-y-4 max-w-4xl ml-auto mr-6">
                          {day.incomeDetails.length > 0 && (
                            <DetailsBlock
                              label="Поступления"
                              count={day.incomeDetails.length}
                              total={day.income}
                              color="emerald"
                              items={day.incomeDetails}
                              type="income"
                            />
                          )}
                          {day.expenseDetails.length > 0 && (
                            <DetailsBlock
                              label="Расходы"
                              count={day.expenseDetails.length}
                              total={day.expense}
                              color="rose"
                              items={day.expenseDetails}
                              type="expense"
                            />
                          )}
                          {day.transferDetails.length > 0 && (
                            <DetailsBlock
                              label="Переводы"
                              count={day.transferDetails.length}
                              total={Math.abs(netTransfer)}
                              color="blue"
                              items={day.transferDetails}
                              type="transfer"
                            />
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="bg-gradient-to-r from-slate-50 to-slate-100/80 border-t border-slate-200">
              <div className="grid grid-cols-[52px_44px_1fr_1fr_1fr_1fr_1fr_28px] gap-0 px-5 py-3.5 items-center text-[13px] font-bold">
                <div className="col-span-2 text-slate-500 uppercase text-[11px] tracking-wider">Итого</div>
                <div className="text-right tabular-nums text-slate-500">{fmt(data.balanceBefore)}</div>
                <div className="text-right tabular-nums text-emerald-600">+{fmt(totals.income)}</div>
                <div className="text-right tabular-nums text-rose-600">−{fmt(totals.expense)}</div>
                <div className={`text-right tabular-nums ${totals.transferNet >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                  {totals.transferNet !== 0 ? fmtSigned(totals.transferNet) : '—'}
                </div>
                <div className={`text-right tabular-nums ${totals.closeBalance >= 0 ? 'text-slate-800' : 'text-rose-600'}`}>{fmt(totals.closeBalance)}</div>
                <div></div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6 px-2 flex-wrap">
            <div className="flex items-center gap-4 text-[11px] text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                Поступления — по дате зачисления, все статусы
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                Расходы — только оплаченные и проверенные
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                Переводы — подтверждённые
              </span>
            </div>
            <div className="text-[11px] text-slate-300 ml-auto">
              Дней с движением: {totals.activeDays} из {data.days.length}
            </div>
          </div>
        </>
      ) : null}
      </div>
    </div>
  );
};

const DetailsBlock: React.FC<{
  label: string; count: number; total: number; color: string;
  items: TxDetail[]; type: string;
}> = ({ label, count, total, color, items, type }) => {
  const colorMap: Record<string, { bg: string; border: string; text: string; badge: string; dot: string }> = {
    emerald: { bg: 'bg-emerald-50/60', border: 'border-emerald-200/50', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-600', dot: 'bg-emerald-400' },
    rose: { bg: 'bg-rose-50/60', border: 'border-rose-200/50', text: 'text-rose-700', badge: 'bg-rose-100 text-rose-600', dot: 'bg-rose-400' },
    blue: { bg: 'bg-blue-50/60', border: 'border-blue-200/50', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-600', dot: 'bg-blue-400' },
  };
  const c = colorMap[color] || colorMap.emerald;

  return (
    <div className={`rounded-xl ${c.bg} border ${c.border} overflow-hidden`}>
      <div className="flex items-center justify-between px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`}></span>
          <span className={`text-xs font-bold uppercase tracking-wider ${c.text}`}>{label}</span>
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${c.badge}`}>{count}</span>
        </div>
        <span className={`text-sm font-bold tabular-nums ${c.text}`}>
          {type === 'income' ? '+' : type === 'expense' ? '−' : ''}{fmt(total)} ₽
        </span>
      </div>
      <div className="bg-white/60 divide-y divide-slate-100/60">
        {items.map(item => (
          <div key={item.id} className="flex items-center justify-between gap-3 px-4 py-2 hover:bg-white/80 transition-colors">
            <div className="flex items-center gap-2 min-w-0 flex-1 text-[12px]">
              {type === 'transfer' ? (
                <span className={`font-medium ${item.direction === 'in' ? 'text-blue-600' : 'text-orange-600'}`}>
                  {item.direction === 'in' ? `← ${item.fromAccountName}` : `→ ${item.toAccountName}`}
                </span>
              ) : (
                <>
                  {item.categoryName && (
                    <span className="font-medium text-slate-600 bg-slate-100/80 px-2 py-0.5 rounded-md shrink-0">{item.categoryName}</span>
                  )}
                  {item.studioName && <span className="text-slate-400 shrink-0">{item.studioName}</span>}
                  {type === 'income' && item.fromAccountName && <span className="text-slate-400 shrink-0">← {item.fromAccountName}</span>}
                  {type === 'expense' && item.contractorName && <span className="text-slate-400 shrink-0">{item.contractorName}</span>}
                </>
              )}
              {item.description && <span className="text-slate-400 truncate">{item.description}</span>}
            </div>
            <span className={`text-[13px] font-semibold tabular-nums whitespace-nowrap ${
              type === 'income' ? 'text-emerald-600' :
              type === 'expense' ? 'text-rose-600' :
              item.direction === 'in' ? 'text-blue-600' : 'text-orange-600'
            }`}>
              {type === 'income' ? '+' : type === 'expense' ? '−' : item.direction === 'in' ? '+' : '−'}
              {fmt(item.amount)} ₽
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
