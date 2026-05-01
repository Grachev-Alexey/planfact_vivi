import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, Landmark, TrendingUp, TrendingDown, Wallet, CircleDollarSign, Building2, LayoutGrid, List, FileText, X, FileSpreadsheet, FileDown, Filter } from 'lucide-react';
import { getMoscowNow } from '../utils/moscow';

interface SettlementAccount { id: number; name: string; bankType?: string | null; hasBankKey?: boolean; }
interface BankStatement { date: string; amount: number; description: string; counterparty: string; type: 'income' | 'expense'; }
interface BalanceDayData { date: string; balanceBegin: number; balanceEnd: number; }
interface TxDetail { id: number; amount: number; description: string; categoryName?: string; studioName?: string; fromAccountName?: string; toAccountName?: string; contractorName?: string; status?: string; direction?: 'in' | 'out'; }
interface DayData { date: string; openBalance: number; income: number; expense: number; transferOut: number; transferIn: number; closeBalance: number; incomeDetails: TxDetail[]; expenseDetails: TxDetail[]; transferDetails: TxDetail[]; }
interface ReconciliationData { accountId: number; accountName: string; balanceBefore: number; days: DayData[]; }
interface PerAccountDay { accountId: number; accountName: string; income: number; expense: number; transferOut: number; transferIn: number; openBalance: number; closeBalance: number; }
interface SummaryDayData { date: string; income: number; expense: number; transferOut: number; transferIn: number; openBalance: number; closeBalance: number; perAccount: PerAccountDay[]; }
interface SummaryData { balanceBefore: number; accounts: { id: number; name: string; balanceBefore: number; closeBalance: number }[]; days: SummaryDayData[]; }

const DAY_NAMES = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const MONTH_NAMES = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

function fmt(v: number) { return new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(v); }
function fmtSigned(v: number) { return (v > 0 ? '+' : '') + fmt(v); }

type ViewMode = 'summary' | 'account';

export const ReconciliationPage: React.FC = () => {
  const now = getMoscowNow();
  const [accounts, setAccounts] = useState<SettlementAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const [viewMode, setViewMode] = useState<ViewMode>('summary');
  const [accountData, setAccountData] = useState<ReconciliationData | null>(null);
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const [accDropdownOpen, setAccDropdownOpen] = useState(false);
  const [bankStatementOpen, setBankStatementOpen] = useState(false);
  const [bankStatements, setBankStatements] = useState<BankStatement[]>([]);
  const [bankBalanceDays, setBankBalanceDays] = useState<BalanceDayData[]>([]);
  const [bankStatementLoading, setBankStatementLoading] = useState(false);
  const [bankStatementError, setBankStatementError] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const todayRowRef = useRef<HTMLDivElement>(null);

  const todayStr = useMemo(() => { const t = getMoscowNow(); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; }, []);

  useEffect(() => {
    fetch('/api/reconciliation/accounts').then(r => r.json()).then(list => { setAccounts(list); if (list.length > 0) setSelectedAccountId(list[0].id); }).catch(() => {});
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setAccDropdownOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const dateRange = useMemo(() => {
    const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    return { startDate, endDate };
  }, [month, year]);

  const fetchData = useCallback(() => {
    setLoading(true);
    const { startDate, endDate } = dateRange;
    if (viewMode === 'summary') {
      fetch(`/api/reconciliation/summary?startDate=${startDate}&endDate=${endDate}`)
        .then(r => r.json()).then(d => { setSummaryData(d); setLoading(false); }).catch(() => setLoading(false));
    } else if (selectedAccountId) {
      fetch(`/api/reconciliation?settlementAccountId=${selectedAccountId}&startDate=${startDate}&endDate=${endDate}`)
        .then(r => r.json()).then(d => { setAccountData(d); setLoading(false); }).catch(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [viewMode, selectedAccountId, dateRange]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!loading && todayRowRef.current && scrollRef.current) {
      setTimeout(() => {
        todayRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }, [loading, viewMode, accountData, summaryData]);

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); setExpandedDays(new Set()); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); setExpandedDays(new Set()); };
  const toggleDay = (ds: string) => setExpandedDays(prev => { const n = new Set(prev); if (n.has(ds)) n.delete(ds); else n.add(ds); return n; });

  const switchToAccount = (accId: number) => { setSelectedAccountId(accId); setViewMode('account'); setExpandedDays(new Set()); };

  const loadBankStatement = useCallback(() => {
    if (!selectedAccountId) return;
    setBankStatementLoading(true);
    setBankStatementError('');
    setBankStatements([]);
    setBankBalanceDays([]);
    const { startDate, endDate } = dateRange;
    fetch(`/api/reconciliation/bank-statement?accountId=${selectedAccountId}&startDate=${startDate}&endDate=${endDate}`)
      .then(r => r.json().then(d => ({ ok: r.ok, data: d })))
      .then(({ ok, data }) => {
        if (!ok) { setBankStatementError(data.error || 'Ошибка загрузки'); }
        else { setBankStatements(data.statements || []); setBankBalanceDays(data.balanceDays || []); }
        setBankStatementLoading(false);
      })
      .catch(() => { setBankStatementError('Ошибка подключения к серверу'); setBankStatementLoading(false); });
  }, [selectedAccountId, dateRange]);

  const selectedAccount = accounts.find(a => a.id === selectedAccountId);

  const totals = useMemo(() => {
    const days = viewMode === 'summary' ? summaryData?.days : accountData?.days;
    const bBefore = viewMode === 'summary' ? summaryData?.balanceBefore : accountData?.balanceBefore;
    if (!days) return { income: 0, expense: 0, transferNet: 0, closeBalance: 0, activeDays: 0, balanceBefore: 0 };
    const upToToday = days.filter(d => d.date <= todayStr);
    const lastDay = upToToday.length > 0 ? upToToday[upToToday.length - 1] : null;
    return {
      income: upToToday.reduce((s, d) => s + d.income, 0),
      expense: upToToday.reduce((s, d) => s + d.expense, 0),
      transferNet: upToToday.reduce((s, d) => s + d.transferIn - d.transferOut, 0),
      closeBalance: lastDay ? lastDay.closeBalance : (bBefore || 0),
      activeDays: upToToday.filter(d => d.income > 0 || d.expense > 0 || d.transferIn > 0 || d.transferOut > 0).length,
      balanceBefore: bBefore || 0,
    };
  }, [viewMode, summaryData, accountData, todayStr]);

  const balanceChange = totals.closeBalance - totals.balanceBefore;

  const accountBalancesToday = useMemo(() => {
    if (viewMode !== 'summary' || !summaryData?.days || !summaryData?.accounts) return {};
    const upToToday = summaryData.days.filter(d => d.date <= todayStr);
    const result: Record<number, number> = {};
    for (const acc of summaryData.accounts) {
      let bal = acc.balanceBefore;
      for (const day of upToToday) {
        const pa = day.perAccount.find(p => p.accountId === acc.id);
        if (pa) bal = pa.closeBalance;
      }
      result[acc.id] = bal;
    }
    return result;
  }, [viewMode, summaryData, todayStr]);

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

  const days = viewMode === 'summary' ? summaryData?.days : accountData?.days;
  const hasData = !loading && days && days.length > 0;

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">

      <div className="shrink-0 bg-[#f1f5f9] border-b border-slate-200/60 px-5 py-2.5">
        <div className="flex items-center justify-between gap-3 max-w-[1400px] mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center shadow-md shadow-teal-500/20">
              <Landmark size={16} className="text-white" />
            </div>
            <h1 className="text-lg font-bold text-slate-800">Сверка остатков</h1>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex bg-white border border-slate-200 rounded-lg shadow-sm p-0.5">
              <button
                onClick={() => { setViewMode('summary'); setExpandedDays(new Set()); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${viewMode === 'summary' ? 'bg-teal-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
              >
                <LayoutGrid size={13} />
                Сводная
              </button>
              <button
                onClick={() => { setViewMode('account'); setExpandedDays(new Set()); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${viewMode === 'account' ? 'bg-teal-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
              >
                <List size={13} />
                По счёту
              </button>
            </div>

            {viewMode === 'account' && (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setAccDropdownOpen(!accDropdownOpen)}
                  className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg pl-3 pr-2.5 py-[7px] text-sm font-medium text-slate-700 shadow-sm hover:border-slate-300 hover:shadow transition-all"
                >
                  <Wallet size={14} className="text-slate-400" />
                  <span className="max-w-[160px] truncate">{selectedAccount?.name || 'Счёт'}</span>
                  <ChevronDown size={14} className={`text-slate-400 transition-transform ${accDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                {accDropdownOpen && (
                  <div className="absolute right-0 top-full mt-1 bg-white rounded-xl border border-slate-200 shadow-xl py-1 min-w-[220px] z-50">
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
            )}

            <div className="flex items-center bg-white border border-slate-200 rounded-lg shadow-sm">
              <button onClick={prevMonth} className="p-2 hover:bg-slate-50 text-slate-500 hover:text-slate-700 transition-colors rounded-l-lg">
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm font-semibold text-slate-700 min-w-[110px] text-center select-none border-x border-slate-100 px-1.5">
                {MONTH_NAMES[month]} {year}
              </span>
              <button onClick={nextMonth} className="p-2 hover:bg-slate-50 text-slate-500 hover:text-slate-700 transition-colors rounded-r-lg">
                <ChevronRight size={16} />
              </button>
            </div>

            {viewMode === 'account' && selectedAccount?.hasBankKey && (
              <button
                onClick={() => { setBankStatementOpen(true); loadBankStatement(); }}
                className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-3 py-[7px] text-xs font-semibold text-slate-600 shadow-sm hover:border-teal-300 hover:text-teal-700 transition-all"
              >
                <FileText size={14} />
                Выписка банка
              </button>
            )}
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
      ) : hasData ? (
        <>
          <div className="shrink-0 px-5 pt-3 pb-2">
            <div className="max-w-[1400px] mx-auto">
              {viewMode === 'summary' && summaryData?.accounts && summaryData.accounts.length > 1 ? (
                <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(summaryData.accounts.length + 1, 5)}, 1fr)` }}>
                  <SummaryCard label="Все счета" value={totals.balanceBefore} endValue={totals.closeBalance}
                    income={totals.income} expense={totals.expense} highlight />
                  {summaryData.accounts.map(acc => (
                    <SummaryCard key={acc.id} label={acc.name} value={acc.balanceBefore}
                      endValue={accountBalancesToday[acc.id] ?? acc.closeBalance}
                      onClick={() => switchToAccount(acc.id)} />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <SmallCard icon={<Wallet size={14} />} label="На начало" value={totals.balanceBefore} iconBg="bg-slate-100" iconColor="text-slate-500" />
                  <SmallCard icon={<TrendingUp size={14} />} label="Поступления" value={totals.income} prefix="+" iconBg="bg-emerald-100" iconColor="text-emerald-600" valueColor="text-emerald-600" />
                  <SmallCard icon={<TrendingDown size={14} />} label="Расходы" value={totals.expense} prefix="−" iconBg="bg-rose-100" iconColor="text-rose-600" valueColor="text-rose-600"
                    sub={totals.transferNet !== 0 ? `переводы: ${fmtSigned(totals.transferNet)} ₽` : undefined} subColor={totals.transferNet > 0 ? 'text-blue-500' : 'text-orange-500'} />
                  <SmallCard icon={<CircleDollarSign size={14} />} label={month === now.getMonth() && year === now.getFullYear() ? 'Сейчас' : 'На конец'} value={totals.closeBalance}
                    iconBg={balanceChange >= 0 ? 'bg-teal-100' : 'bg-amber-100'} iconColor={balanceChange >= 0 ? 'text-teal-600' : 'text-amber-600'}
                    sub={`${balanceChange >= 0 ? '↑' : '↓'} ${fmtSigned(balanceChange)} за период`} subColor={balanceChange >= 0 ? 'text-teal-500' : 'text-rose-500'} />
                </div>
              )}
            </div>
          </div>

          <div className="shrink-0 bg-slate-100 border-y border-slate-200 px-5">
            <div className="grid grid-cols-[52px_40px_1fr_1fr_1fr_1fr_1fr_28px] gap-0 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-[0.08em] max-w-[1400px] mx-auto">
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

          <div className="flex-1 overflow-y-auto min-h-0" ref={scrollRef}>
            <div className="max-w-[1400px] mx-auto">
              {days!.map(day => {
                const hasMovement = day.income > 0 || day.expense > 0 || day.transferOut > 0 || day.transferIn > 0;
                const expanded = expandedDays.has(day.date);
                const d = new Date(day.date + 'T12:00:00');
                const weekend = d.getDay() === 0 || d.getDay() === 6;
                const today = day.date === todayStr;
                const dayNum = d.getDate();
                const dayName = DAY_NAMES[d.getDay()];
                const netTransfer = day.transferIn - day.transferOut;
                const balDelta = day.closeBalance - day.openBalance;

                return (
                  <div key={day.date} ref={today ? todayRowRef : undefined} className={`border-b border-slate-100 ${expanded ? 'bg-slate-50/40' : ''}`}>
                    <div
                      className={`group grid grid-cols-[52px_40px_1fr_1fr_1fr_1fr_1fr_28px] gap-0 px-5 items-center transition-colors
                        ${hasMovement ? 'cursor-pointer hover:bg-slate-50' : ''}
                        ${today ? 'bg-teal-50/60 border-l-2 border-l-teal-500' : ''}
                        ${weekend && !today ? 'bg-slate-50/30' : ''}
                        ${!hasMovement ? 'py-1.5 opacity-50' : 'py-2.5'}
                      `}
                      onClick={() => hasMovement && toggleDay(day.date)}
                    >
                      <div className="flex items-center">
                        <span className={`text-[14px] font-bold tabular-nums ${today ? 'text-teal-700' : hasMovement ? 'text-slate-700' : 'text-slate-400'}`}>{dayNum}</span>
                      </div>
                      <div>
                        <span className={`text-[11px] font-medium ${weekend ? 'text-rose-400' : today ? 'text-teal-600' : 'text-slate-400'}`}>{dayName}</span>
                      </div>
                      <div className={`text-[13px] text-right tabular-nums pr-2 ${!hasMovement ? 'text-slate-300' : 'text-slate-500'}`}>{fmt(day.openBalance)}</div>
                      <div className="text-right pr-2">
                        {day.income > 0 ? <span className="text-[13px] font-semibold tabular-nums text-emerald-600">+{fmt(day.income)}</span> : <span className="text-[13px] text-slate-200">—</span>}
                      </div>
                      <div className="text-right pr-2">
                        {day.expense > 0 ? <span className="text-[13px] font-semibold tabular-nums text-rose-600">−{fmt(day.expense)}</span> : <span className="text-[13px] text-slate-200">—</span>}
                      </div>
                      <div className="text-right pr-2">
                        {viewMode === 'summary'
                          ? (day.transferOut > 0 ? <span className="text-[13px] font-semibold tabular-nums text-violet-600">↔ {fmt(day.transferOut)}</span> : <span className="text-[13px] text-slate-200">—</span>)
                          : (netTransfer !== 0 ? <span className={`text-[13px] font-semibold tabular-nums ${netTransfer > 0 ? 'text-blue-600' : 'text-orange-600'}`}>{fmtSigned(netTransfer)}</span> : <span className="text-[13px] text-slate-200">—</span>)
                        }
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
                          {viewMode === 'summary' && 'perAccount' in day && (day as SummaryDayData).perAccount.length > 0 && (
                            <div className="rounded-lg bg-slate-50 border border-slate-200 overflow-hidden">
                              <div className="px-3 py-2 text-[11px] font-bold text-slate-500 uppercase tracking-wider">По счетам</div>
                              <div className="bg-white divide-y divide-slate-50">
                                {(day as SummaryDayData).perAccount.map(pa => (
                                  <button key={pa.accountId} onClick={(e) => { e.stopPropagation(); switchToAccount(pa.accountId); }}
                                    className="w-full flex items-center justify-between gap-3 px-3 py-2 text-[12px] hover:bg-slate-50 transition-colors">
                                    <span className="font-medium text-slate-700">{pa.accountName}</span>
                                    <div className="flex items-center gap-4 tabular-nums">
                                      {pa.income > 0 && <span className="text-emerald-600 font-semibold">+{fmt(pa.income)}</span>}
                                      {pa.expense > 0 && <span className="text-rose-600 font-semibold">−{fmt(pa.expense)}</span>}
                                      {(pa.transferIn - pa.transferOut) !== 0 && <span className={`font-semibold ${(pa.transferIn - pa.transferOut) > 0 ? 'text-blue-600' : 'text-orange-600'}`}>{fmtSigned(pa.transferIn - pa.transferOut)}</span>}
                                      <span className="text-slate-500 min-w-[80px] text-right">→ {fmt(pa.closeBalance)}</span>
                                    </div>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                          {viewMode === 'account' && 'incomeDetails' in day && (
                            <>
                              {((day as DayData).incomeDetails.length > 0 || (day as DayData).expenseDetails.length > 0) && (
                                <PaymentTypeSummary incomeItems={(day as DayData).incomeDetails} expenseItems={(day as DayData).expenseDetails} />
                              )}
                              {(day as DayData).incomeDetails.length > 0 && (
                                <DetailsBlock label="Поступления" total={(day as DayData).income} color="emerald" items={(day as DayData).incomeDetails} type="income" />
                              )}
                              {(day as DayData).expenseDetails.length > 0 && <DetailsBlock label="Расходы" total={(day as DayData).expense} color="rose" items={(day as DayData).expenseDetails} type="expense" />}
                              {(day as DayData).transferDetails.length > 0 && <DetailsBlock label="Переводы" total={Math.abs(netTransfer)} color="blue" items={(day as DayData).transferDetails} type="transfer" />}
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              <div className="bg-slate-50 border-t border-slate-200 px-5">
                <div className="grid grid-cols-[52px_40px_1fr_1fr_1fr_1fr_1fr_28px] gap-0 py-3 items-center text-[13px] font-bold">
                  <div className="col-span-2 text-slate-400 uppercase text-[10px] tracking-wider">Итого</div>
                  <div className="text-right tabular-nums text-slate-500 pr-2">{fmt(totals.balanceBefore)}</div>
                  <div className="text-right tabular-nums text-emerald-600 pr-2">+{fmt(totals.income)}</div>
                  <div className="text-right tabular-nums text-rose-600 pr-2">−{fmt(totals.expense)}</div>
                  <div className={`text-right tabular-nums pr-2 ${totals.transferNet >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                    {totals.transferNet !== 0 ? fmtSigned(totals.transferNet) : '—'}
                  </div>
                  <div className={`text-right tabular-nums ${totals.closeBalance >= 0 ? 'text-slate-800' : 'text-rose-600'}`}>{fmt(totals.closeBalance)}</div>
                  <div></div>
                </div>
              </div>

              <div className="flex items-center gap-4 px-5 py-2.5 text-[11px] text-slate-400">
                <span><span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1"></span>Поступления — по дате зачисления</span>
                <span><span className="inline-block w-1.5 h-1.5 rounded-full bg-rose-400 mr-1"></span>Расходы — оплаченные/проверенные</span>
                <span><span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400 mr-1"></span>Переводы — подтверждённые</span>
                <span className="ml-auto text-slate-300">Дней с движением: {totals.activeDays}/{days!.length}</span>
              </div>
            </div>
          </div>
        </>
      ) : null}

      {bankStatementOpen && (
        <BankStatementModal
          onClose={() => setBankStatementOpen(false)}
          loading={bankStatementLoading}
          error={bankStatementError}
          statements={bankStatements}
          balanceDays={bankBalanceDays}
          accountName={selectedAccount?.name || ''}
          bankType={selectedAccount?.bankType || null}
          period={`${MONTH_NAMES[month]} ${year}`}
          systemDays={accountData?.days || []}
        />
      )}
    </div>
  );
};

const SummaryCard: React.FC<{
  label: string; value: number; endValue: number; income?: number; expense?: number; highlight?: boolean; onClick?: () => void;
}> = ({ label, value, endValue, income, expense, highlight, onClick }) => {
  const change = endValue - value;
  return (
    <div
      onClick={onClick}
      className={`rounded-xl border px-4 py-3 transition-all ${
        highlight
          ? 'bg-gradient-to-br from-teal-500 to-emerald-600 border-teal-400 text-white shadow-lg shadow-teal-500/20'
          : 'bg-white border-slate-200/80 shadow-sm hover:shadow-md hover:border-slate-300 cursor-pointer'
      }`}
    >
      <div className={`text-[11px] font-bold uppercase tracking-wider mb-1 ${highlight ? 'text-teal-100' : 'text-slate-400'}`}>{label}</div>
      <div className={`text-lg font-bold tabular-nums ${highlight ? 'text-white' : 'text-slate-700'}`}>
        {fmt(endValue)} <span className={`text-sm ${highlight ? 'text-teal-200' : 'text-slate-400'}`}>₽</span>
      </div>
      <div className={`text-[11px] tabular-nums font-medium mt-0.5 ${highlight ? 'text-teal-100' : change >= 0 ? 'text-teal-500' : 'text-rose-500'}`}>
        {change >= 0 ? '↑' : '↓'} {fmtSigned(change)} за период
      </div>
      {highlight && income !== undefined && expense !== undefined && (
        <div className="flex gap-3 mt-2 pt-2 border-t border-teal-400/30 text-[11px] tabular-nums">
          <span className="text-teal-100">+{fmt(income)}</span>
          <span className="text-teal-200/80">−{fmt(expense)}</span>
        </div>
      )}
      {!highlight && <div className={`text-[10px] mt-1 text-slate-400`}>начало: {fmt(value)}</div>}
    </div>
  );
};

const SmallCard: React.FC<{
  icon: React.ReactNode; label: string; value: number; prefix?: string;
  iconBg: string; iconColor: string; valueColor?: string;
  sub?: string; subColor?: string;
}> = ({ icon, label, value, prefix, iconBg, iconColor, valueColor, sub, subColor }) => (
  <div className="bg-white rounded-xl border border-slate-200/80 px-4 py-3 shadow-sm">
    <div className="flex items-center gap-2 mb-1.5">
      <div className={`w-6 h-6 rounded-md ${iconBg} flex items-center justify-center ${iconColor}`}>{icon}</div>
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>
    </div>
    <div className={`text-lg font-bold tabular-nums ${valueColor || (value >= 0 ? 'text-slate-700' : 'text-rose-600')}`}>
      {prefix && value > 0 ? prefix : ''}{fmt(Math.abs(value))} <span className="text-sm text-slate-400">₽</span>
    </div>
    {sub && <div className={`text-[11px] mt-0.5 tabular-nums font-medium ${subColor || 'text-slate-400'}`}>{sub}</div>}
  </div>
);

function paymentTypeFromAccountName(name: string | undefined): string | null {
  if (!name) return null;
  const n = name.toLowerCase();
  if (/ю[-\s]?касса|yukassa|юkassa/.test(n)) return 'Ю-Касса';
  if (/налич/.test(n)) return 'Наличные';
  if (/\bсбп\b/.test(n)) return 'СБП';
  if (/рассроч/.test(n)) return 'Рассрочка';
  if (/карт|терминал|эквайринг/.test(n)) return 'Терминал';
  return null;
}

function extractIncomePaymentType(item: { fromAccountName?: string; description?: string; categoryName?: string }): string {
  const byAcc = paymentTypeFromAccountName(item.fromAccountName);
  if (byAcc) return byAcc;
  const text = `${item.description || ''} ${item.categoryName || ''}`.toLowerCase();
  if (/ю[-\s]?kassa|ю[-\s]?касса|yukassa|юkassa/.test(text)) return 'Ю-Касса';
  if (/\bсбп\b/.test(text)) return 'СБП';
  if (/эквайринг|терминал/.test(text)) return 'Терминал';
  return 'Прочее';
}

function extractExpensePaymentType(item: { fromAccountName?: string; categoryName?: string }): string | null {
  const byAcc = paymentTypeFromAccountName(item.fromAccountName);
  if (byAcc) return byAcc;
  const cat = item.categoryName;
  if (!cat) return null;
  if (/комисс.*юкасс|возврат.*юкасс/i.test(cat)) return 'Ю-Касса';
  if (/эквайринг/i.test(cat)) return 'Терминал';
  return null;
}

const PAYMENT_TYPE_STYLES: Record<string, { emoji: string; color: string; bg: string }> = {
  'Терминал': { emoji: '💳', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-100' },
  'Наличные': { emoji: '💵', color: 'text-green-700', bg: 'bg-green-50 border-green-100' },
  'Ю-Касса': { emoji: '🌐', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-100' },
  'СБП': { emoji: '⚡', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-100' },
  'Рассрочка': { emoji: '📋', color: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-100' },
  'Прочее': { emoji: '📦', color: 'text-slate-600', bg: 'bg-slate-50 border-slate-100' },
};

const PaymentTypeSummary: React.FC<{ incomeItems: TxDetail[]; expenseItems: TxDetail[] }> = ({ incomeItems, expenseItems }) => {
  const groups = useMemo(() => {
    const map: Record<string, { income: number; expenses: number; incomeCount: number; expenseCount: number }> = {};
    const ensure = (pt: string) => { if (!map[pt]) map[pt] = { income: 0, expenses: 0, incomeCount: 0, expenseCount: 0 }; };

    incomeItems.forEach(item => {
      const pt = extractIncomePaymentType(item);
      ensure(pt);
      map[pt].income += Number(item.amount) || 0;
      map[pt].incomeCount++;
    });

    expenseItems.forEach(item => {
      const pt = extractExpensePaymentType(item);
      if (pt) {
        ensure(pt);
        map[pt].expenses += Number(item.amount) || 0;
        map[pt].expenseCount++;
      }
    });

    return Object.entries(map)
      .filter(([k]) => k !== 'Прочее' || map[k].income > 0)
      .sort((a, b) => (b[1].income - b[1].expenses) - (a[1].income - a[1].expenses));
  }, [incomeItems, expenseItems]);

  if (groups.length === 0) return null;

  return (
    <div className="rounded-lg bg-gradient-to-r from-slate-50 to-white border border-slate-200 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-slate-100">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Сводка по источникам</span>
      </div>
      <div className="divide-y divide-slate-100">
        {groups.map(([pt, data]) => {
          const style = PAYMENT_TYPE_STYLES[pt] || PAYMENT_TYPE_STYLES['Прочее'];
          const net = data.income - data.expenses;
          return (
            <div key={pt} className="flex items-center gap-3 px-3 py-2">
              <span className="text-base">{style.emoji}</span>
              <span className={`text-[12px] font-semibold ${style.color} min-w-[70px]`}>{pt}</span>
              <div className="flex items-center gap-3 flex-1 justify-end tabular-nums text-[12px]">
                <span className="text-emerald-600">+{fmt(data.income)} ₽</span>
                {data.expenses > 0 && (
                  <span className="text-rose-500">−{fmt(data.expenses)} ₽</span>
                )}
                <span className={`font-bold min-w-[90px] text-right ${net >= 0 ? style.color : 'text-rose-600'}`}>
                  = {fmt(net)} ₽
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

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

function categorizeBankOp(description: string, type: 'income' | 'expense'): string {
  const d = (description || '').toLowerCase();
  if (/эквайринг|терминал|pos[\s-]?терминал/.test(d)) return 'Терминал';
  if (/\bсбп\b|быстр\w*\s*платеж/.test(d)) return 'СБП';
  if (/ю[-\s]?касс|yukassa|юkassa/.test(d)) return 'Ю-Касса';
  if (/рассроч|тинькофф\s*рассроч|долями/.test(d)) return 'Рассрочка';
  if (/налич/.test(d)) return 'Наличные';
  if (/перевод\s+собственн|собственных\s+средств|меж.*собств/.test(d)) return 'Перевод между счетами';
  if (/комисс|плата за обслуж|абонент.*плат/.test(d)) return 'Комиссия банка';
  if (/налог|nalog|ндс|страх.*взнос|пенс.*фонд/.test(d)) return 'Налоги';
  if (/арен/.test(d)) return 'Аренда';
  if (/зарплат|з\/п|выплата.*сотруд|подотчет/.test(d)) return 'ЗП/Подотчёт';
  if (/возврат/.test(d)) return type === 'income' ? 'Возвраты' : 'Прочее';
  return 'Прочее';
}

function fmtDay(ds: string): string {
  const d = new Date(ds + 'T12:00:00');
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', weekday: 'short' });
}

const BankStatementModal: React.FC<{
  onClose: () => void;
  loading: boolean;
  error: string;
  statements: BankStatement[];
  balanceDays: BalanceDayData[];
  accountName: string;
  bankType: string | null;
  period: string;
  systemDays: DayData[];
}> = ({ onClose, loading, error, statements, balanceDays, accountName, bankType, period, systemDays }) => {
  const [filter, setFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [viewMode, setViewMode] = useState<'split' | 'list'>('split');
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const [allExpanded, setAllExpanded] = useState(true);

  const filtered = useMemo(() => {
    return filter === 'all' ? statements : statements.filter(s => s.type === filter);
  }, [statements, filter]);

  const grouped = useMemo(() => {
    const map = new Map<string, BankStatement[]>();
    for (const s of filtered) {
      const day = (s.date || '').substring(0, 10);
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(s);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const totals = useMemo(() => {
    const income = filtered.filter(s => s.type === 'income').reduce((a, s) => a + s.amount, 0);
    const expense = filtered.filter(s => s.type === 'expense').reduce((a, s) => a + s.amount, 0);
    return { income, expense, net: income - expense, count: filtered.length };
  }, [filtered]);

  const systemDayMap = useMemo(() => {
    const m = new Map<string, DayData>();
    systemDays.forEach(d => m.set(d.date, d));
    return m;
  }, [systemDays]);

  const balanceDayMap = useMemo(() => {
    const m = new Map<string, BalanceDayData>();
    balanceDays.forEach(d => m.set(d.date, d));
    return m;
  }, [balanceDays]);

  const bankGrouped = useMemo(() => {
    const m = new Map<string, BankStatement[]>();
    for (const s of statements) {
      const day = (s.date || '').substring(0, 10);
      if (!m.has(day)) m.set(day, []);
      m.get(day)!.push(s);
    }
    return m;
  }, [statements]);

  const allDays = useMemo(() => {
    const days = new Set<string>();
    for (const [d] of bankGrouped) days.add(d);
    for (const sd of systemDays) {
      if (sd.income > 0 || sd.expense > 0 || sd.transferIn > 0 || sd.transferOut > 0) days.add(sd.date);
    }
    return Array.from(days).sort();
  }, [bankGrouped, systemDays]);

  const dayMatches = useMemo(() => {
    const result = new Map<string, { source: string; bank: number; system: number; diff: number }[]>();
    for (const [day, ops] of grouped) {
      const bankByCat: Record<string, number> = {};
      for (const op of ops) {
        const cat = categorizeBankOp(op.description, op.type);
        const sign = op.type === 'income' ? 1 : -1;
        bankByCat[cat] = (bankByCat[cat] || 0) + sign * op.amount;
      }
      const sysDay = systemDayMap.get(day);
      const sysByCat: Record<string, number> = {};
      if (sysDay) {
        sysDay.incomeDetails.forEach(it => {
          const pt = extractIncomePaymentType(it);
          sysByCat[pt] = (sysByCat[pt] || 0) + (Number(it.amount) || 0);
        });
        sysDay.expenseDetails.forEach(it => {
          const pt = extractExpensePaymentType(it);
          if (pt) sysByCat[pt] = (sysByCat[pt] || 0) - (Number(it.amount) || 0);
        });
      }
      const allCats = new Set([...Object.keys(bankByCat), ...Object.keys(sysByCat)]);
      const rows: { source: string; bank: number; system: number; diff: number }[] = [];
      const matchable = ['Терминал', 'СБП', 'Ю-Касса', 'Наличные', 'Рассрочка'];
      for (const cat of allCats) {
        if (!matchable.includes(cat)) continue;
        const bank = bankByCat[cat] || 0;
        const sys = sysByCat[cat] || 0;
        if (bank === 0 && sys === 0) continue;
        rows.push({ source: cat, bank, system: sys, diff: bank - sys });
      }
      rows.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
      result.set(day, rows);
    }
    return result;
  }, [grouped, systemDayMap]);

  const toggleDay = (d: string) => {
    setExpandedDays(prev => {
      const n = new Set(prev);
      if (n.has(d)) n.delete(d); else n.add(d);
      return n;
    });
    setAllExpanded(false);
  };

  const toggleAll = () => {
    if (allExpanded) {
      setAllExpanded(false);
      setExpandedDays(new Set());
    } else {
      setAllExpanded(true);
      setExpandedDays(new Set(viewMode === 'split' ? allDays : grouped.map(([d]) => d)));
    }
  };

  const isExpanded = (d: string) => allExpanded || expandedDays.has(d);

  const exportExcel = async () => {
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Выписка');
    const hasBal = balanceDays.length > 0;
    ws.columns = [
      { header: 'Дата', key: 'date', width: 13 },
      { header: 'Тип', key: 'type', width: 10 },
      { header: 'Категория', key: 'cat', width: 22 },
      { header: 'Описание', key: 'desc', width: 60 },
      { header: 'Контрагент', key: 'cp', width: 30 },
      { header: 'Сумма', key: 'amount', width: 16 },
      ...(hasBal ? [
        { header: 'Начало дня', key: 'balBegin', width: 16 },
        { header: 'Конец дня', key: 'balEnd', width: 16 },
      ] : []),
    ];
    const hdrRow = ws.getRow(1);
    hdrRow.font = { bold: true };
    hdrRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };

    for (const [day, ops] of grouped) {
      const bal = balanceDayMap.get(day);
      let firstRow = true;
      for (const op of ops) {
        const sign = op.type === 'income' ? 1 : -1;
        ws.addRow({
          date: day,
          type: op.type === 'income' ? 'Приход' : 'Расход',
          cat: categorizeBankOp(op.description, op.type),
          desc: op.description || '',
          cp: op.counterparty || '',
          amount: sign * op.amount,
          ...(hasBal ? {
            balBegin: firstRow && bal ? bal.balanceBegin : '',
            balEnd: firstRow && bal ? bal.balanceEnd : '',
          } : {}),
        });
        firstRow = false;
      }
      const dayIn = ops.filter(o => o.type === 'income').reduce((a, o) => a + o.amount, 0);
      const dayOut = ops.filter(o => o.type === 'expense').reduce((a, o) => a + o.amount, 0);
      const summary = [dayIn > 0 ? `+${fmt(dayIn)}` : null, dayOut > 0 ? `−${fmt(dayOut)}` : null].filter(Boolean).join(' / ') || '0';
      const totalRow = ws.addRow({
        date: `Итого ${day}`,
        type: '', cat: '', desc: summary, cp: '',
        amount: dayIn - dayOut,
        ...(hasBal ? { balBegin: '', balEnd: '' } : {}),
      });
      totalRow.font = { bold: true };
      totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    }
    const allIn = totals.income;
    const allOut = totals.expense;
    const grandSummary = [allIn > 0 ? `+${fmt(allIn)}` : null, allOut > 0 ? `−${fmt(allOut)}` : null].filter(Boolean).join(' / ') || '0';
    const totalRow = ws.addRow({
      date: 'ИТОГО', type: '', cat: '', desc: grandSummary, cp: '',
      amount: totals.net,
      ...(hasBal ? { balBegin: '', balEnd: '' } : {}),
    });
    totalRow.font = { bold: true, size: 12 };
    totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFCBD5E1' } };

    ws.getColumn('amount').numFmt = '#,##0.00';
    if (hasBal) {
      ws.getColumn('balBegin').numFmt = '#,##0.00';
      ws.getColumn('balEnd').numFmt = '#,##0.00';
    }
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Выписка_${accountName}_${period}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPdf = () => {
    const bankLabel = bankType === 'tbank' ? 'Т-Банк' : bankType === 'sber' ? 'Сбербанк' : '';
    const hasBal = balanceDays.length > 0;
    const rows = grouped.map(([day, ops]) => {
      const bal = balanceDayMap.get(day);
      const dayIn = ops.filter(o => o.type === 'income').reduce((a, o) => a + o.amount, 0);
      const dayOut = ops.filter(o => o.type === 'expense').reduce((a, o) => a + o.amount, 0);
      const opRows = ops.map(op => `
        <tr>
          <td>${op.type === 'income' ? 'Приход' : 'Расход'}</td>
          <td>${categorizeBankOp(op.description, op.type)}</td>
          <td class="desc">${op.description || '—'}</td>
          <td>${op.counterparty || ''}</td>
          <td class="num ${op.type === 'income' ? 'inc' : 'exp'}">${op.type === 'income' ? '+' : '−'}${fmt(op.amount)}</td>
        </tr>`).join('');
      const balCols = hasBal && bal
        ? `<td class="num" colspan="1">Нач: ${fmt(bal.balanceBegin)}<br/>Кон: ${fmt(bal.balanceEnd)}</td>`
        : '';
      const summaryParts = [dayIn > 0 ? `+${fmt(dayIn)}` : null, dayOut > 0 ? `−${fmt(dayOut)}` : null].filter(Boolean).join(' / ') || '0';
      return `
        <tr class="day-hdr">
          <td colspan="4"><strong>${fmtDay(day)}</strong> · ${ops.length} оп. · ${summaryParts} ${balCols}</td>
          <td class="num"><strong>${fmtSigned(dayIn - dayOut)}</strong></td>
        </tr>
        ${opRows}`;
    }).join('');

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<title>Выписка ${accountName} ${period}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 11px; color: #1e293b; margin: 20px; }
  h2 { font-size: 16px; margin-bottom: 4px; }
  .meta { color: #64748b; font-size: 11px; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #0f766e; color: #fff; text-align: left; padding: 5px 7px; font-size: 10px; }
  td { padding: 4px 7px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
  .day-hdr td { background: #f8fafc; font-weight: bold; border-top: 2px solid #e2e8f0; }
  .num { text-align: right; white-space: nowrap; }
  .inc { color: #059669; }
  .exp { color: #dc2626; }
  .desc { max-width: 280px; word-break: break-word; }
  .footer { margin-top: 16px; font-weight: bold; border-top: 2px solid #cbd5e1; padding-top: 8px; }
  @media print { body { margin: 10px; } }
</style></head>
<body>
<h2>Банковская выписка</h2>
<div class="meta">Счёт: ${accountName}${bankLabel ? ` · ${bankLabel}` : ''} · ${period}</div>
<table>
<thead><tr>
  <th>Тип</th><th>Категория</th><th>Описание</th><th>Контрагент</th><th>Сумма</th>
</tr></thead>
<tbody>${rows}</tbody>
</table>
<div class="footer">
  ИТОГО: <span class="inc">+${fmt(totals.income)}</span> &nbsp;|&nbsp;
  <span class="exp">−${fmt(totals.expense)}</span> &nbsp;|&nbsp;
  Нетто: <strong>${fmtSigned(totals.net)}</strong> ₽
</div>
</body></html>`;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className={`bg-white rounded-2xl shadow-2xl w-full max-h-[92vh] flex flex-col ${viewMode === 'split' ? 'max-w-7xl' : 'max-w-5xl'}`} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 shrink-0 gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center shadow-md shadow-teal-500/20 shrink-0">
              <FileText size={16} className="text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">Банковская выписка</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {accountName} — {period}
                {bankType && <span className="ml-2 px-1.5 py-0.5 bg-slate-100 rounded text-[10px] font-medium text-slate-500">{bankType === 'tbank' ? 'Т-Банк' : 'Сбер'}</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {!loading && !error && statements.length > 0 && (
              <>
                {/* View mode toggle */}
                <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
                  <button onClick={() => setViewMode('split')}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all ${viewMode === 'split' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                    ⇔ Сверка
                  </button>
                  <button onClick={() => setViewMode('list')}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all ${viewMode === 'list' ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                    ≡ Список
                  </button>
                </div>
                {viewMode === 'list' && (
                  <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
                    {(['all', 'income', 'expense'] as const).map(f => (
                      <button key={f} onClick={() => setFilter(f)}
                        className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all ${filter === f ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                        {f === 'all' ? 'Все' : f === 'income' ? 'Приходы' : 'Расходы'}
                      </button>
                    ))}
                  </div>
                )}
                <button onClick={toggleAll} className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors">
                  <Filter size={12} /> {allExpanded ? 'Свернуть' : 'Развернуть'}
                </button>
                <button onClick={exportExcel} className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors">
                  <FileSpreadsheet size={12} /> Excel
                </button>
                <button onClick={exportPdf} className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors">
                  <FileDown size={12} /> PDF
                </button>
              </>
            )}
            <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
              <X size={18} className="text-slate-400" />
            </button>
          </div>
        </div>

        {/* Totals bar */}
        {!loading && !error && statements.length > 0 && (
          <div className="shrink-0 grid grid-cols-4 gap-3 px-5 py-2.5 bg-slate-50 border-b border-slate-200">
            <div className="bg-white rounded-lg border border-slate-200 px-3 py-2">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Операций</div>
              <div className="text-sm font-bold text-slate-700 tabular-nums">{statements.length}</div>
            </div>
            <div className="bg-white rounded-lg border border-emerald-100 px-3 py-2">
              <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Поступления (банк)</div>
              <div className="text-sm font-bold text-emerald-600 tabular-nums">+{fmt(totals.income)} ₽</div>
            </div>
            <div className="bg-white rounded-lg border border-rose-100 px-3 py-2">
              <div className="text-[10px] font-bold text-rose-600 uppercase tracking-wider">Списания (банк)</div>
              <div className="text-sm font-bold text-rose-600 tabular-nums">−{fmt(totals.expense)} ₽</div>
            </div>
            <div className={`bg-white rounded-lg border px-3 py-2 ${totals.net >= 0 ? 'border-teal-100' : 'border-amber-100'}`}>
              <div className={`text-[10px] font-bold uppercase tracking-wider ${totals.net >= 0 ? 'text-teal-600' : 'text-amber-600'}`}>Нетто (банк)</div>
              <div className={`text-sm font-bold tabular-nums ${totals.net >= 0 ? 'text-teal-600' : 'text-amber-600'}`}>{fmtSigned(totals.net)} ₽</div>
            </div>
          </div>
        )}

        {/* Main content */}
        <div className="flex-1 overflow-y-auto p-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="relative">
                <div className="w-8 h-8 rounded-full border-[3px] border-slate-200"></div>
                <div className="absolute inset-0 w-8 h-8 rounded-full border-[3px] border-teal-500 border-t-transparent animate-spin"></div>
              </div>
              <span className="text-sm text-slate-400">Загрузка выписки...</span>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <div className="w-14 h-14 rounded-2xl bg-rose-50 flex items-center justify-center mx-auto mb-4">
                <FileText size={24} className="text-rose-400" />
              </div>
              <p className="text-sm text-rose-600 font-medium">{error}</p>
              <p className="text-xs text-slate-400 mt-2">Проверьте API ключ в настройках счёта</p>
            </div>
          ) : statements.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm text-slate-500">Нет операций за выбранный период</p>
            </div>

          ) : viewMode === 'split' ? (
            /* ── SPLIT VIEW ── */
            <div className="space-y-2">
              {allDays.map(day => {
                const bankOps = bankGrouped.get(day) || [];
                const sysDay = systemDayMap.get(day);
                const bal = balanceDayMap.get(day);
                const bankIn = bankOps.filter(o => o.type === 'income').reduce((a, o) => a + o.amount, 0);
                const bankOut = bankOps.filter(o => o.type === 'expense').reduce((a, o) => a + o.amount, 0);
                const bankNet = bankIn - bankOut;
                const sysIn = sysDay ? sysDay.income : 0;
                const sysOut = sysDay ? sysDay.expense : 0;
                const sysNet = sysIn - sysOut;
                const diff = bankNet - sysNet;
                const isMatch = Math.abs(diff) < 1;
                const open = isExpanded(day);
                return (
                  <div key={day} className="rounded-xl border border-slate-200 overflow-hidden bg-white">
                    {/* Day header */}
                    <button onClick={() => toggleDay(day)}
                      className="w-full flex items-center justify-between gap-2 px-4 py-2.5 bg-gradient-to-r from-slate-50 to-white hover:from-slate-100 transition-colors">
                      <div className="flex items-center gap-2 min-w-0">
                        <ChevronDown size={15} className={`text-slate-400 shrink-0 transition-transform ${open ? '' : '-rotate-90'}`} />
                        <span className="text-sm font-bold text-slate-700 shrink-0">{fmtDay(day)}</span>
                        {bal && (
                          <span className="text-[11px] text-slate-400 hidden md:inline shrink-0">
                            · нач <span className="text-slate-600 font-medium">{fmt(bal.balanceBegin)}</span>
                            {' → '}<span className="text-slate-600 font-medium">{fmt(bal.balanceEnd)}</span> ₽
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 tabular-nums text-[12px] shrink-0">
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50">
                          <span className="text-[10px] font-bold text-blue-400 uppercase">Банк</span>
                          <span className={`font-bold ${bankNet >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{fmtSigned(bankNet)}</span>
                        </div>
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-violet-50">
                          <span className="text-[10px] font-bold text-violet-400 uppercase">Система</span>
                          <span className={`font-bold ${sysNet >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{fmtSigned(sysNet)}</span>
                        </div>
                        <div className={`flex items-center gap-1 px-2 py-0.5 rounded ${isMatch ? 'bg-emerald-50' : 'bg-rose-50'}`}>
                          <span className={`text-[10px] font-bold uppercase ${isMatch ? 'text-emerald-500' : 'text-rose-400'}`}>Разница</span>
                          <span className={`font-bold ${isMatch ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {isMatch ? '✓' : fmtSigned(diff)}
                          </span>
                        </div>
                      </div>
                    </button>

                    {/* Split body */}
                    {open && (
                      <div className="border-t border-slate-100 grid grid-cols-2 divide-x divide-slate-100">
                        {/* LEFT: Bank */}
                        <div>
                          <div className="px-3 py-1.5 bg-blue-50/60 border-b border-blue-100/60 flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">
                              Банк · {bankOps.length} оп.
                            </span>
                            <div className="text-[11px] tabular-nums">
                              {bankIn > 0 && <span className="text-emerald-600 font-semibold mr-2">+{fmt(bankIn)}</span>}
                              {bankOut > 0 && <span className="text-rose-600 font-semibold">−{fmt(bankOut)}</span>}
                            </div>
                          </div>
                          {bankOps.length === 0 ? (
                            <div className="px-3 py-4 text-center text-[12px] text-slate-300">Нет операций</div>
                          ) : (
                            <div className="divide-y divide-slate-50">
                              {bankOps.map((op, i) => {
                                const cat = categorizeBankOp(op.description, op.type);
                                return (
                                  <div key={i} className="flex items-start justify-between gap-2 px-3 py-2 hover:bg-slate-50/60">
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                                        <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded shrink-0">{cat}</span>
                                        {op.counterparty && <span className="text-[11px] text-slate-400 truncate">{op.counterparty}</span>}
                                      </div>
                                      <div className="text-[12px] text-slate-600 leading-snug break-words">{op.description || '—'}</div>
                                    </div>
                                    <span className={`text-[13px] font-bold tabular-nums whitespace-nowrap shrink-0 ${op.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                      {op.type === 'income' ? '+' : '−'}{fmt(op.amount)}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* RIGHT: System */}
                        <div>
                          <div className="px-3 py-1.5 bg-violet-50/60 border-b border-violet-100/60 flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-violet-600">
                              Система · {sysDay ? (sysDay.incomeDetails.length + sysDay.expenseDetails.length) : 0} оп.
                            </span>
                            <div className="text-[11px] tabular-nums">
                              {sysIn > 0 && <span className="text-emerald-600 font-semibold mr-2">+{fmt(sysIn)}</span>}
                              {sysOut > 0 && <span className="text-rose-600 font-semibold">−{fmt(sysOut)}</span>}
                            </div>
                          </div>
                          {!sysDay || (sysDay.incomeDetails.length === 0 && sysDay.expenseDetails.length === 0) ? (
                            <div className="px-3 py-4 text-center text-[12px] text-slate-300">Нет данных в системе</div>
                          ) : (
                            <div className="divide-y divide-slate-50">
                              {sysDay.incomeDetails.map((it, i) => (
                                <div key={`in-${i}`} className="flex items-start justify-between gap-2 px-3 py-2 hover:bg-slate-50/60">
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                                      {it.categoryName && <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded shrink-0">{it.categoryName}</span>}
                                      {it.studioName && <span className="text-[11px] text-slate-400 truncate">{it.studioName}</span>}
                                    </div>
                                    {it.description && <div className="text-[12px] text-slate-500 leading-snug break-words">{it.description}</div>}
                                    {it.fromAccountName && <div className="text-[11px] text-slate-400">← {it.fromAccountName}</div>}
                                  </div>
                                  <span className="text-[13px] font-bold tabular-nums whitespace-nowrap text-emerald-600 shrink-0">+{fmt(it.amount)}</span>
                                </div>
                              ))}
                              {sysDay.expenseDetails.map((it, i) => (
                                <div key={`ex-${i}`} className="flex items-start justify-between gap-2 px-3 py-2 hover:bg-slate-50/60">
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                                      {it.categoryName && <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 bg-rose-50 text-rose-600 rounded shrink-0">{it.categoryName}</span>}
                                      {it.contractorName && <span className="text-[11px] text-slate-400 truncate">{it.contractorName}</span>}
                                      {it.studioName && <span className="text-[11px] text-slate-400 truncate">{it.studioName}</span>}
                                    </div>
                                    {it.description && <div className="text-[12px] text-slate-500 leading-snug break-words">{it.description}</div>}
                                  </div>
                                  <span className="text-[13px] font-bold tabular-nums whitespace-nowrap text-rose-600 shrink-0">−{fmt(it.amount)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

          ) : (
            /* ── LIST VIEW ── */
            <div className="space-y-2">
              {grouped.map(([day, ops]) => {
                const dayIn = ops.filter(o => o.type === 'income').reduce((a, o) => a + o.amount, 0);
                const dayOut = ops.filter(o => o.type === 'expense').reduce((a, o) => a + o.amount, 0);
                const dayNet = dayIn - dayOut;
                const matchRows = dayMatches.get(day) || [];
                const open = isExpanded(day);
                const bal = balanceDayMap.get(day);
                return (
                  <div key={day} className="rounded-xl border border-slate-200 overflow-hidden bg-white">
                    <button onClick={() => toggleDay(day)}
                      className="w-full flex items-center justify-between gap-3 px-4 py-2.5 bg-gradient-to-r from-slate-50 to-white hover:from-slate-100 transition-colors">
                      <div className="flex items-center gap-3">
                        <ChevronDown size={16} className={`text-slate-400 transition-transform ${open ? '' : '-rotate-90'}`} />
                        <span className="text-sm font-bold text-slate-700">{fmtDay(day)}</span>
                        <span className="text-[11px] text-slate-400">· {ops.length} оп.</span>
                        {bal && (
                          <span className="text-[11px] text-slate-400 hidden sm:inline">
                            · нач. <span className="font-medium text-slate-600">{fmt(bal.balanceBegin)}</span>
                            {' → '}кон. <span className="font-medium text-slate-600">{fmt(bal.balanceEnd)}</span> ₽
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 tabular-nums text-[13px]">
                        {dayIn > 0 && <span className="text-emerald-600 font-semibold">+{fmt(dayIn)}</span>}
                        {dayOut > 0 && <span className="text-rose-600 font-semibold">−{fmt(dayOut)}</span>}
                        <span className={`font-bold min-w-[80px] text-right ${dayNet >= 0 ? 'text-slate-700' : 'text-rose-600'}`}>= {fmtSigned(dayNet)}</span>
                      </div>
                    </button>
                    {open && (
                      <div className="border-t border-slate-100">
                        {matchRows.length > 0 && (
                          <div className="bg-amber-50/40 border-b border-amber-100/60 px-4 py-2">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700 mb-1.5">Сверка с источниками системы</div>
                            <div className="grid grid-cols-[1fr_100px_100px_100px] gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1 mb-1">
                              <div>Источник</div><div className="text-right">Банк</div><div className="text-right">Система</div><div className="text-right">Разница</div>
                            </div>
                            <div className="space-y-0.5">
                              {matchRows.map(r => {
                                const ok = Math.abs(r.diff) < 0.5;
                                return (
                                  <div key={r.source} className={`grid grid-cols-[1fr_100px_100px_100px] gap-2 text-[12px] tabular-nums px-1 py-1 rounded ${ok ? 'bg-emerald-50/40' : 'bg-rose-50/40'}`}>
                                    <div className="font-medium text-slate-700 flex items-center gap-1.5">
                                      <span className={`w-1.5 h-1.5 rounded-full ${ok ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>{r.source}
                                    </div>
                                    <div className={`text-right font-semibold ${r.bank >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{fmtSigned(r.bank)}</div>
                                    <div className={`text-right font-semibold ${r.system >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{fmtSigned(r.system)}</div>
                                    <div className={`text-right font-bold ${ok ? 'text-emerald-700' : 'text-rose-700'}`}>{ok ? '✓' : fmtSigned(r.diff)}</div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        <div className="divide-y divide-slate-50">
                          {ops.map((op, i) => {
                            const cat = categorizeBankOp(op.description, op.type);
                            return (
                              <div key={i} className="grid grid-cols-[1fr_120px] gap-3 px-4 py-2 text-sm hover:bg-slate-50/60">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 mb-0.5">
                                    <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">{cat}</span>
                                    {op.counterparty && <span className="text-[11px] text-slate-400 truncate">{op.counterparty}</span>}
                                  </div>
                                  <div className="text-slate-700 text-[13px] leading-snug break-words">{op.description || '—'}</div>
                                </div>
                                <span className={`text-right font-semibold tabular-nums whitespace-nowrap self-center ${op.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                  {op.type === 'income' ? '+' : '−'}{fmt(op.amount)} ₽
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
