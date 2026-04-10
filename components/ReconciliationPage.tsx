import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, Landmark, TrendingUp, TrendingDown, ArrowRightLeft, Wallet, CircleDollarSign, ArrowDownRight, ArrowUpRight, Building2 } from 'lucide-react';
import { getMoscowNow } from '../utils/moscow';

interface SettlementAccount { id: number; name: string; }
interface TxDetail { id: number; amount: number; description: string; categoryName?: string; studioName?: string; fromAccountName?: string; toAccountName?: string; contractorName?: string; status?: string; direction?: 'in' | 'out'; }
interface DayData { date: string; openBalance: number; income: number; expense: number; transferOut: number; transferIn: number; closeBalance: number; incomeDetails: TxDetail[]; expenseDetails: TxDetail[]; transferDetails: TxDetail[]; }
interface ReconciliationData { accountId: number; accountName: string; balanceBefore: number; days: DayData[]; }

const DAY_NAMES = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const MONTH_NAMES = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

function fmt(v: number) { return new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(v); }
function fmtSigned(v: number) { return (v > 0 ? '+' : '') + fmt(v); }

export const ReconciliationPage: React.FC = () => {
  const now = getMoscowNow();
  const [accounts, setAccounts] = useState<SettlementAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState<ReconciliationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const [accDropdownOpen, setAccDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/reconciliation/accounts').then(r => r.json()).then(list => { setAccounts(list); if (list.length > 0 && !selectedAccountId) setSelectedAccountId(list[0].id); }).catch(() => {});
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setAccDropdownOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fetchData = useCallback(() => {
    if (!selectedAccountId) return;
    setLoading(true);
    const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    fetch(`/api/reconciliation?settlementAccountId=${selectedAccountId}&startDate=${startDate}&endDate=${endDate}`)
      .then(r => r.json()).then(d => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  }, [selectedAccountId, month, year]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); setExpandedDays(new Set()); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); setExpandedDays(new Set()); };

  const toggleDay = (ds: string) => setExpandedDays(prev => { const n = new Set(prev); if (n.has(ds)) n.delete(ds); else n.add(ds); return n; });

  const todayStr = useMemo(() => { const t = getMoscowNow(); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; }, []);

  const totals = useMemo(() => {
    if (!data?.days) return { income: 0, expense: 0, transferNet: 0, closeBalance: 0, activeDays: 0 };
    return {
      income: data.days.reduce((s, d) => s + d.income, 0),
      expense: data.days.reduce((s, d) => s + d.expense, 0),
      transferNet: data.days.reduce((s, d) => s + d.transferIn - d.transferOut, 0),
      closeBalance: data.days.length > 0 ? data.days[data.days.length - 1].closeBalance : data.balanceBefore,
      activeDays: data.days.filter(d => d.income > 0 || d.expense > 0 || d.transferIn > 0 || d.transferOut > 0).length,
    };
  }, [data]);

  const balanceChange = data ? totals.closeBalance - data.balanceBefore : 0;
  const selectedAccount = accounts.find(a => a.id === selectedAccountId);

  if (!loading && accounts.length === 0) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-56px)]">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center mx-auto mb-6">
            <Building2 size={36} className="text-slate-400" />
          </div>
          <h2 className="text-lg font-semibold text-slate-700 mb-2">Нет настроенных счетов зачисления</h2>
          <p className="text-sm text-slate-500">Настройте правила в разделе <span className="font-medium text-slate-600">Настройки → Правила → Счета зачисления</span></p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">

      <div className="shrink-0 bg-[#f1f5f9] border-b border-slate-200/60 px-5 py-3">
        <div className="flex items-center justify-between gap-3 max-w-[1400px] mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center shadow-md shadow-teal-500/20">
              <Landmark size={16} className="text-white" />
            </div>
            <h1 className="text-lg font-bold text-slate-800">Сверка остатков</h1>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setAccDropdownOpen(!accDropdownOpen)}
                className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg pl-3 pr-2.5 py-2 text-sm font-medium text-slate-700 shadow-sm hover:border-slate-300 hover:shadow transition-all"
              >
                <Wallet size={14} className="text-slate-400" />
                <span className="max-w-[160px] truncate">{selectedAccount?.name || 'Счёт'}</span>
                <ChevronDown size={14} className={`text-slate-400 transition-transform ${accDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              {accDropdownOpen && (
                <div className="absolute right-0 top-full mt-1 bg-white rounded-xl border border-slate-200 shadow-xl py-1 min-w-[200px] z-50">
                  {accounts.map(a => (
                    <button
                      key={a.id}
                      onClick={() => { setSelectedAccountId(a.id); setAccDropdownOpen(false); setExpandedDays(new Set()); }}
                      className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center gap-2.5
                        ${a.id === selectedAccountId ? 'bg-teal-50 text-teal-700 font-medium' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                      <div className={`w-2 h-2 rounded-full shrink-0 ${a.id === selectedAccountId ? 'bg-teal-500' : 'bg-slate-200'}`}></div>
                      {a.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center bg-white border border-slate-200 rounded-lg shadow-sm">
              <button onClick={prevMonth} className="p-2 hover:bg-slate-50 text-slate-500 hover:text-slate-700 transition-colors rounded-l-lg">
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm font-semibold text-slate-700 min-w-[120px] text-center select-none border-x border-slate-100 px-2">
                {MONTH_NAMES[month]} {year}
              </span>
              <button onClick={nextMonth} className="p-2 hover:bg-slate-50 text-slate-500 hover:text-slate-700 transition-colors rounded-r-lg">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-full border-[3px] border-slate-200"></div>
            <div className="absolute inset-0 w-10 h-10 rounded-full border-[3px] border-teal-500 border-t-transparent animate-spin"></div>
          </div>
          <span className="text-sm text-slate-400">Загрузка...</span>
        </div>
      ) : data && data.days ? (
        <>
          <div className="shrink-0 px-5 pt-4 pb-3">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 max-w-[1400px] mx-auto">
              <SummaryCard icon={<Wallet size={14} />} label="На начало" value={data.balanceBefore} iconBg="bg-slate-100" iconColor="text-slate-500" />
              <SummaryCard icon={<TrendingUp size={14} />} label="Поступления" value={totals.income} prefix="+" iconBg="bg-emerald-100" iconColor="text-emerald-600" valueColor="text-emerald-600" />
              <SummaryCard icon={<TrendingDown size={14} />} label="Расходы" value={totals.expense} prefix="−" iconBg="bg-rose-100" iconColor="text-rose-600" valueColor="text-rose-600"
                sub={totals.transferNet !== 0 ? `переводы: ${fmtSigned(totals.transferNet)} ₽` : undefined} subColor={totals.transferNet > 0 ? 'text-blue-500' : 'text-orange-500'} />
              <SummaryCard icon={<CircleDollarSign size={14} />} label="На конец" value={totals.closeBalance}
                iconBg={balanceChange >= 0 ? 'bg-teal-100' : 'bg-amber-100'} iconColor={balanceChange >= 0 ? 'text-teal-600' : 'text-amber-600'}
                sub={`${balanceChange >= 0 ? '↑' : '↓'} ${fmtSigned(balanceChange)} за месяц`} subColor={balanceChange >= 0 ? 'text-teal-500' : 'text-rose-500'} />
            </div>
          </div>

          <div className="shrink-0 bg-slate-100 border-y border-slate-200 px-5">
            <div className="grid grid-cols-[52px_40px_1fr_1fr_1fr_1fr_1fr_28px] gap-0 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-[0.08em] max-w-[1400px] mx-auto">
              <div>Дата</div>
              <div></div>
              <div className="text-right pr-2">Начало дня</div>
              <div className="text-right pr-2">Поступления</div>
              <div className="text-right pr-2">Расходы</div>
              <div className="text-right pr-2">Переводы</div>
              <div className="text-right">Конец дня</div>
              <div></div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto min-h-0">
            <div className="max-w-[1400px] mx-auto">
              {data.days.map(day => {
                const hasMovement = day.income > 0 || day.expense > 0 || day.transferOut > 0 || day.transferIn > 0;
                const expanded = expandedDays.has(day.date);
                const d = new Date(day.date);
                const weekend = d.getDay() === 0 || d.getDay() === 6;
                const today = day.date === todayStr;
                const dayNum = d.getDate();
                const dayName = DAY_NAMES[d.getDay()];
                const netTransfer = day.transferIn - day.transferOut;
                const balDelta = day.closeBalance - day.openBalance;

                return (
                  <div key={day.date} className={`border-b border-slate-100 ${expanded ? 'bg-slate-50/40' : ''}`}>
                    <div
                      className={`group grid grid-cols-[52px_40px_1fr_1fr_1fr_1fr_1fr_28px] gap-0 px-5 items-center transition-colors
                        ${hasMovement ? 'cursor-pointer hover:bg-slate-50' : ''}
                        ${today ? 'bg-teal-50/50' : ''}
                        ${weekend && !today ? 'bg-slate-50/30' : ''}
                        ${!hasMovement ? 'py-1.5 opacity-50' : 'py-2.5'}
                      `}
                      onClick={() => hasMovement && toggleDay(day.date)}
                    >
                      <div className="flex items-center">
                        {today && <div className="w-1 h-5 rounded-full bg-teal-500 -ml-2 mr-1.5 shrink-0"></div>}
                        <span className={`text-[14px] font-bold tabular-nums ${today ? 'text-teal-700' : hasMovement ? 'text-slate-700' : 'text-slate-400'}`}>{dayNum}</span>
                      </div>
                      <div>
                        <span className={`text-[11px] font-medium ${weekend ? 'text-rose-400' : today ? 'text-teal-600' : 'text-slate-400'}`}>{dayName}</span>
                      </div>
                      <div className={`text-[13px] text-right tabular-nums pr-2 ${!hasMovement ? 'text-slate-300' : 'text-slate-500'}`}>{fmt(day.openBalance)}</div>
                      <div className="text-right pr-2">
                        {day.income > 0 ? (
                          <span className="text-[13px] font-semibold tabular-nums text-emerald-600">+{fmt(day.income)}</span>
                        ) : <span className="text-[13px] text-slate-200">—</span>}
                      </div>
                      <div className="text-right pr-2">
                        {day.expense > 0 ? (
                          <span className="text-[13px] font-semibold tabular-nums text-rose-600">−{fmt(day.expense)}</span>
                        ) : <span className="text-[13px] text-slate-200">—</span>}
                      </div>
                      <div className="text-right pr-2">
                        {netTransfer !== 0 ? (
                          <span className={`text-[13px] font-semibold tabular-nums ${netTransfer > 0 ? 'text-blue-600' : 'text-orange-600'}`}>{fmtSigned(netTransfer)}</span>
                        ) : <span className="text-[13px] text-slate-200">—</span>}
                      </div>
                      <div className="text-right">
                        <span className={`text-[13px] font-bold tabular-nums ${!hasMovement ? 'text-slate-300' : day.closeBalance < 0 ? 'text-rose-600' : 'text-slate-700'}`}>
                          {fmt(day.closeBalance)}
                        </span>
                        {hasMovement && (
                          <div className={`text-[10px] tabular-nums font-medium ${balDelta > 0 ? 'text-emerald-500' : balDelta < 0 ? 'text-rose-400' : 'text-slate-300'}`}>
                            {balDelta > 0 ? '+' : ''}{fmt(balDelta)}
                          </div>
                        )}
                      </div>
                      <div className="flex justify-center">
                        {hasMovement && (
                          <div className={`w-5 h-5 rounded flex items-center justify-center transition-transform duration-200 ${expanded ? 'rotate-180 text-teal-500' : 'text-slate-300 group-hover:text-slate-500'}`}>
                            <ChevronDown size={14} />
                          </div>
                        )}
                      </div>
                    </div>

                    {expanded && hasMovement && (
                      <div className="bg-white border-t border-slate-100 px-5 py-3">
                        <div className="max-w-3xl ml-auto space-y-3 mr-8">
                          {day.incomeDetails.length > 0 && <DetailsBlock label="Поступления" total={day.income} color="emerald" items={day.incomeDetails} type="income" />}
                          {day.expenseDetails.length > 0 && <DetailsBlock label="Расходы" total={day.expense} color="rose" items={day.expenseDetails} type="expense" />}
                          {day.transferDetails.length > 0 && <DetailsBlock label="Переводы" total={Math.abs(netTransfer)} color="blue" items={day.transferDetails} type="transfer" />}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              <div className="bg-slate-50 border-t border-slate-200 px-5">
                <div className="grid grid-cols-[52px_40px_1fr_1fr_1fr_1fr_1fr_28px] gap-0 py-3 items-center text-[13px] font-bold">
                  <div className="col-span-2 text-slate-400 uppercase text-[10px] tracking-wider">Итого</div>
                  <div className="text-right tabular-nums text-slate-500 pr-2">{fmt(data.balanceBefore)}</div>
                  <div className="text-right tabular-nums text-emerald-600 pr-2">+{fmt(totals.income)}</div>
                  <div className="text-right tabular-nums text-rose-600 pr-2">−{fmt(totals.expense)}</div>
                  <div className={`text-right tabular-nums pr-2 ${totals.transferNet >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                    {totals.transferNet !== 0 ? fmtSigned(totals.transferNet) : '—'}
                  </div>
                  <div className={`text-right tabular-nums ${totals.closeBalance >= 0 ? 'text-slate-800' : 'text-rose-600'}`}>{fmt(totals.closeBalance)}</div>
                  <div></div>
                </div>
              </div>

              <div className="flex items-center gap-5 px-5 py-3 text-[11px] text-slate-400">
                <span><span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1"></span>Поступления — по дате зачисления</span>
                <span><span className="inline-block w-1.5 h-1.5 rounded-full bg-rose-400 mr-1"></span>Расходы — оплаченные/проверенные</span>
                <span><span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400 mr-1"></span>Переводы — подтверждённые</span>
                <span className="ml-auto text-slate-300">Дней с движением: {totals.activeDays}/{data.days.length}</span>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
};

const SummaryCard: React.FC<{
  icon: React.ReactNode; label: string; value: number; prefix?: string;
  iconBg: string; iconColor: string; valueColor?: string;
  sub?: string; subColor?: string;
}> = ({ icon, label, value, prefix, iconBg, iconColor, valueColor, sub, subColor }) => (
  <div className="bg-white rounded-xl border border-slate-200/80 px-4 py-3 shadow-sm">
    <div className="flex items-center gap-2 mb-2">
      <div className={`w-6 h-6 rounded-md ${iconBg} flex items-center justify-center ${iconColor}`}>{icon}</div>
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>
    </div>
    <div className={`text-lg font-bold tabular-nums ${valueColor || (value >= 0 ? 'text-slate-700' : 'text-rose-600')}`}>
      {prefix && value > 0 ? prefix : ''}{fmt(Math.abs(value))} <span className="text-sm text-slate-400">₽</span>
    </div>
    {sub && <div className={`text-[11px] mt-0.5 tabular-nums font-medium ${subColor || 'text-slate-400'}`}>{sub}</div>}
  </div>
);

const DetailsBlock: React.FC<{ label: string; total: number; color: string; items: TxDetail[]; type: string }> = ({ label, total, color, items, type }) => {
  const styles: Record<string, { bg: string; border: string; text: string; badge: string; dot: string }> = {
    emerald: { bg: 'bg-emerald-50/50', border: 'border-emerald-100', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-600', dot: 'bg-emerald-400' },
    rose: { bg: 'bg-rose-50/50', border: 'border-rose-100', text: 'text-rose-700', badge: 'bg-rose-100 text-rose-600', dot: 'bg-rose-400' },
    blue: { bg: 'bg-blue-50/50', border: 'border-blue-100', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-600', dot: 'bg-blue-400' },
  };
  const c = styles[color] || styles.emerald;

  return (
    <div className={`rounded-lg ${c.bg} border ${c.border} overflow-hidden`}>
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`}></span>
          <span className={`text-[11px] font-bold uppercase tracking-wider ${c.text}`}>{label}</span>
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${c.badge}`}>{items.length}</span>
        </div>
        <span className={`text-sm font-bold tabular-nums ${c.text}`}>{type === 'income' ? '+' : type === 'expense' ? '−' : ''}{fmt(total)} ₽</span>
      </div>
      <div className="bg-white/70 divide-y divide-slate-50">
        {items.map(item => (
          <div key={item.id} className="flex items-center justify-between gap-3 px-3 py-1.5 text-[12px]">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {type === 'transfer' ? (
                <span className={`font-medium ${item.direction === 'in' ? 'text-blue-600' : 'text-orange-600'}`}>
                  {item.direction === 'in' ? `← ${item.fromAccountName}` : `→ ${item.toAccountName}`}
                </span>
              ) : (
                <>
                  {item.categoryName && <span className="font-medium text-slate-600 bg-slate-100/80 px-1.5 py-0.5 rounded shrink-0">{item.categoryName}</span>}
                  {item.studioName && <span className="text-slate-400 shrink-0">{item.studioName}</span>}
                  {type === 'income' && item.fromAccountName && <span className="text-slate-400 shrink-0">← {item.fromAccountName}</span>}
                  {type === 'expense' && item.contractorName && <span className="text-slate-400 shrink-0">{item.contractorName}</span>}
                </>
              )}
              {item.description && <span className="text-slate-400 truncate">{item.description}</span>}
            </div>
            <span className={`text-[12px] font-semibold tabular-nums whitespace-nowrap ${
              type === 'income' ? 'text-emerald-600' : type === 'expense' ? 'text-rose-600' : item.direction === 'in' ? 'text-blue-600' : 'text-orange-600'
            }`}>
              {type === 'income' ? '+' : type === 'expense' ? '−' : item.direction === 'in' ? '+' : '−'}{fmt(item.amount)} ₽
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
