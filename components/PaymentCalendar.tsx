import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays, ChevronDown, ChevronUp, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useAuth } from '../context/AuthContext';
import { PaymentCalendarEntryModal } from './PaymentCalendarEntryModal';

interface PREntry {
  id: number;
  amount: number;
  status: 'pending' | 'approved' | 'paid';
  description: string;
  username: string;
  contractorName: string;
  createdAt: string;
}

interface CategoryRow {
  id: string;
  name: string;
  days: Record<number, PREntry[]>;
}

interface CalendarData {
  daysInMonth: number;
  incomePlan: Record<number, number>;
  incomeFact: Record<number, number>;
  expensePlan: Record<number, number>;
  expenseFact: Record<number, number>;
  balance: Record<number, number>;
  expenseCategories: CategoryRow[];
}

const STATUS_CFG = {
  pending:  { label: 'Ожидает',   text: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-200',   dot: 'bg-blue-500',   pill: 'bg-blue-100 text-blue-700'   },
  approved: { label: 'Утверждён', text: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200', dot: 'bg-orange-500', pill: 'bg-orange-100 text-orange-700' },
  paid:     { label: 'Оплачен',   text: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-200',  dot: 'bg-green-500',  pill: 'bg-green-100 text-green-700'   },
};

const MONTH_NAMES_GEN = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
const MONTH_NAMES = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const DAY_SHORT = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];

function fmtCompact(v: number | undefined): string {
  if (!v || v === 0) return '';
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(v);
}

function fmtFull(v: number): string {
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(v);
}


function dominantStatus(entries: PREntry[]): 'pending' | 'approved' | 'paid' {
  if (entries.some(e => e.status === 'paid')) return 'paid';
  if (entries.some(e => e.status === 'approved')) return 'approved';
  return 'pending';
}

function cellTotal(entries: PREntry[]): number {
  return entries.reduce((s, e) => s + e.amount, 0);
}

const COL_W = 76;
const LABEL_W = 196;
const TOTAL_W = 84;

interface TooltipState {
  entries: PREntry[];
  catName: string;
  day: number;
  cellLeft: number;
  cellRight: number;
  cellTop: number;
  cellBottom: number;
  cellWidth: number;
}


export const PaymentCalendar: React.FC = () => {
  const { user } = useAuth();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [data, setData] = useState<CalendarData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [catsOpen, setCatsOpen] = useState(true);
  const [dragState, setDragState] = useState<{ catId: string; day: number; entryIds: number[] } | null>(null);
  const [dragOverDay, setDragOverDay] = useState<number | null>(null);
  const [activeCell, setActiveCell] = useState<{ catName: string; catId: string; day: number; entries: PREntry[] } | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const todayColRef = useRef<HTMLTableCellElement>(null);
  const dragJustEndedRef = useRef(false);

  const monthStr = `${year}-${String(month).padStart(2, '0')}`;
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth() + 1;
  const todayDay = isCurrentMonth ? today.getDate() : -1;

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await fetch(`/api/payment-calendar?month=${monthStr}`, {
        headers: { 'x-user-id': String(user?.id || '') },
      });
      if (!r.ok) throw new Error('error');
      setData(await r.json());
    } catch {
      setError('Не удалось загрузить данные');
    } finally {
      setLoading(false);
    }
  }, [monthStr, user]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (data && todayDay > 0 && todayColRef.current) {
      setTimeout(() => {
        todayColRef.current?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }, 100);
    }
  }, [data, todayDay]);

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  };
  const goToday = () => {
    setYear(today.getFullYear());
    setMonth(today.getMonth() + 1);
  };

  const days = data ? Array.from({ length: data.daysInMonth }, (_, i) => i + 1) : [];

  function showTooltip(entries: PREntry[], catName: string, day: number, e: React.MouseEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    setTooltip({ entries, catName, day, cellLeft: r.left, cellRight: r.right, cellTop: r.top, cellBottom: r.bottom, cellWidth: r.width });
  }
  function hideTooltip() { setTooltip(null); }

  function handleChipClick(entries: PREntry[], catName: string, catId: string, day: number) {
    if (dragJustEndedRef.current) return;
    hideTooltip();
    setActiveCell({ catName, catId, day, entries });
  }

  function handleDragStart(e: React.DragEvent, catId: string, day: number, entries: PREntry[]) {
    hideTooltip();
    setDragState({ catId, day, entryIds: entries.map(en => en.id) });
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragEnd() {
    dragJustEndedRef.current = true;
    setTimeout(() => { dragJustEndedRef.current = false; }, 200);
    setDragState(null);
    setDragOverDay(null);
  }

  function handleDragOver(e: React.DragEvent, day: number) {
    if (!dragState) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverDay !== day) setDragOverDay(day);
  }

  async function handleDrop(e: React.DragEvent, targetDay: number) {
    e.preventDefault();
    if (!dragState) return;
    const srcDay = dragState.day;
    const ids = dragState.entryIds;
    setDragState(null);
    setDragOverDay(null);
    if (targetDay === srcDay) return;
    const targetDate = `${year}-${String(month).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`;
    await fetch('/api/payment-calendar/move-payment', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-user-id': String(user?.id || '') },
      body: JSON.stringify({ ids, newDate: targetDate }),
    });
    load();
  }

  async function exportXlsx() {
    if (!data) return;

    const pad = (n: number) => String(n).padStart(2, '0');
    const dateLabel = (d: number) => `${pad(d)}.${pad(month)}.${year}`;
    const numDays = days.length;

    type RowType = 'header' | 'section-income' | 'section-expense' | 'section-balance' | 'section-cats' | 'plan' | 'fact' | 'balance-plan' | 'balance-fact' | 'category';
    const rows: (string | number | null)[][] = [];
    const rowTypes: RowType[] = [];
    const add = (type: RowType, ...vals: (string | number | null)[]) => { rows.push(vals); rowTypes.push(type); };

    const n = (v: number) => (v !== 0 ? v : null);

    add('header', 'Статья', 'Итого', ...days.map(d => dateLabel(d)));
    add('section-income', '▲ ДОХОДЫ', null, ...Array(numDays).fill(null));
    add('plan',   'План', n(totalIncomePlan), ...days.map(d => n(data.incomePlan[d] || 0)));
    add('fact',   'Факт', n(totalIncomeFact), ...days.map(d => n(data.incomeFact[d] || 0)));
    add('section-expense', '▼ РАСХОДЫ', null, ...Array(numDays).fill(null));
    add('plan',   'План', n(totalExpensePlan), ...days.map(d => n(data.expensePlan[d] || 0)));
    add('fact',   'Факт', n(totalExpenseFact), ...days.map(d => n(data.expenseFact[d] || 0)));
    add('section-balance', '= БАЛАНС', null, ...Array(numDays).fill(null));
    add('balance-plan', 'План', n(totalBalancePlan), ...days.map(d => n(balancePlan[d] || 0)));
    add('balance-fact', 'Факт', n(totalBalance),     ...days.map(d => n(data.balance[d] || 0)));

    let allCats: { id: string; name: string }[] = [];
    try {
      const r = await fetch('/api/initial-data', { headers: { 'x-user-id': String(user?.id || '') } });
      if (r.ok) {
        const d2 = await r.json();
        allCats = (d2.categories || [])
          .filter((c: any) => c.type === 'expense')
          .sort((a: any, b: any) => a.name.localeCompare(b.name, 'ru'))
          .map((c: any) => ({ id: String(c.id), name: c.name }));
      }
    } catch {}
    if (allCats.length === 0) allCats = data.expenseCategories.map(c => ({ id: c.id, name: c.name }));

    const catMap: Record<string, CategoryRow> = {};
    for (const cat of data.expenseCategories) catMap[cat.id] = cat;

    add('section-cats', 'По статьям расходов', null, ...Array(numDays).fill(null));
    for (const cat of allCats) {
      const cd = catMap[cat.id];
      const catTot = cd ? Object.values(cd.days).flat().reduce((s, e) => s + e.amount, 0) : 0;
      add('category', cat.name, n(catTot), ...days.map(d => {
        const es = cd?.days[d];
        return es ? n(cellTotal(es)) : null;
      }));
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);

    const border = (rgb: string) => ({ style: 'thin' as const, color: { rgb } });
    const borders = (rgb: string) => ({ top: border(rgb), bottom: border(rgb), left: border(rgb), right: border(rgb) });

    const STYLES: Record<RowType, { label: object; total: object; day: object }> = {
      header: {
        label: { font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 10 }, fill: { patternType: 'solid', fgColor: { rgb: '253447' } }, alignment: { horizontal: 'left',   vertical: 'center', wrapText: true }, border: borders('1C2E42') },
        total: { font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 10 }, fill: { patternType: 'solid', fgColor: { rgb: '253447' } }, alignment: { horizontal: 'center', vertical: 'center' }, border: borders('1C2E42') },
        day:   { font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 9  }, fill: { patternType: 'solid', fgColor: { rgb: '2D3F54' } }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true }, border: borders('1C2E42') },
      },
      'section-income': {
        label: { font: { bold: true, color: { rgb: '065F46' }, sz: 10 }, fill: { patternType: 'solid', fgColor: { rgb: 'ECFDF5' } }, alignment: { horizontal: 'left', vertical: 'center' }, border: borders('A7F3D0') },
        total: { font: { bold: true, color: { rgb: '065F46' }, sz: 10 }, fill: { patternType: 'solid', fgColor: { rgb: 'ECFDF5' } }, alignment: { horizontal: 'right', vertical: 'center' }, border: borders('A7F3D0') },
        day:   { font: { bold: true, color: { rgb: '065F46' }, sz: 10 }, fill: { patternType: 'solid', fgColor: { rgb: 'ECFDF5' } }, alignment: { horizontal: 'center', vertical: 'center' }, border: borders('A7F3D0') },
      },
      'section-expense': {
        label: { font: { bold: true, color: { rgb: '881337' }, sz: 10 }, fill: { patternType: 'solid', fgColor: { rgb: 'FFF1F2' } }, alignment: { horizontal: 'left', vertical: 'center' }, border: borders('FECDD3') },
        total: { font: { bold: true, color: { rgb: '881337' }, sz: 10 }, fill: { patternType: 'solid', fgColor: { rgb: 'FFF1F2' } }, alignment: { horizontal: 'right', vertical: 'center' }, border: borders('FECDD3') },
        day:   { font: { bold: true, color: { rgb: '881337' }, sz: 10 }, fill: { patternType: 'solid', fgColor: { rgb: 'FFF1F2' } }, alignment: { horizontal: 'center', vertical: 'center' }, border: borders('FECDD3') },
      },
      'section-balance': {
        label: { font: { bold: true, color: { rgb: '1E3A5F' }, sz: 10 }, fill: { patternType: 'solid', fgColor: { rgb: 'EFF6FF' } }, alignment: { horizontal: 'left', vertical: 'center' }, border: borders('BFDBFE') },
        total: { font: { bold: true, color: { rgb: '1E3A5F' }, sz: 10 }, fill: { patternType: 'solid', fgColor: { rgb: 'EFF6FF' } }, alignment: { horizontal: 'right', vertical: 'center' }, border: borders('BFDBFE') },
        day:   { font: { bold: true, color: { rgb: '1E3A5F' }, sz: 10 }, fill: { patternType: 'solid', fgColor: { rgb: 'EFF6FF' } }, alignment: { horizontal: 'center', vertical: 'center' }, border: borders('BFDBFE') },
      },
      'section-cats': {
        label: { font: { bold: true, color: { rgb: '64748B' }, sz: 9 }, fill: { patternType: 'solid', fgColor: { rgb: 'F8FAFC' } }, alignment: { horizontal: 'left', vertical: 'center' }, border: borders('E2E8F0') },
        total: { font: { bold: true, color: { rgb: '64748B' }, sz: 9 }, fill: { patternType: 'solid', fgColor: { rgb: 'F8FAFC' } }, alignment: { horizontal: 'right', vertical: 'center' }, border: borders('E2E8F0') },
        day:   { font: { bold: true, color: { rgb: '64748B' }, sz: 9 }, fill: { patternType: 'solid', fgColor: { rgb: 'F8FAFC' } }, alignment: { horizontal: 'center', vertical: 'center' }, border: borders('E2E8F0') },
      },
      plan: {
        label: { font: { color: { rgb: '475569' }, sz: 10 }, fill: { patternType: 'solid', fgColor: { rgb: 'FFFFFF' } }, alignment: { horizontal: 'left', vertical: 'center', indent: 1 }, border: borders('E2E8F0') },
        total: { font: { color: { rgb: '334155' }, sz: 10 }, fill: { patternType: 'solid', fgColor: { rgb: 'F8FAFC' } }, alignment: { horizontal: 'right', vertical: 'center' }, border: borders('E2E8F0'), numFmt: '#,##0' },
        day:   { font: { color: { rgb: '475569' }, sz: 10 }, fill: { patternType: 'solid', fgColor: { rgb: 'FFFFFF' } }, alignment: { horizontal: 'right', vertical: 'center' }, border: borders('E2E8F0'), numFmt: '#,##0' },
      },
      fact: {
        label: { font: { bold: true, color: { rgb: '334155' }, sz: 10 }, fill: { patternType: 'solid', fgColor: { rgb: 'F8FAFC' } }, alignment: { horizontal: 'left', vertical: 'center', indent: 1 }, border: borders('E2E8F0') },
        total: { font: { bold: true, color: { rgb: '1E293B' }, sz: 10 }, fill: { patternType: 'solid', fgColor: { rgb: 'F1F5F9' } }, alignment: { horizontal: 'right', vertical: 'center' }, border: borders('CBD5E1'), numFmt: '#,##0' },
        day:   { font: { bold: true, color: { rgb: '334155' }, sz: 10 }, fill: { patternType: 'solid', fgColor: { rgb: 'F8FAFC' } }, alignment: { horizontal: 'right', vertical: 'center' }, border: borders('E2E8F0'), numFmt: '#,##0' },
      },
      'balance-plan': {
        label: { font: { color: { rgb: '3B82F6' }, sz: 10 }, fill: { patternType: 'solid', fgColor: { rgb: 'FFFFFF' } }, alignment: { horizontal: 'left', vertical: 'center', indent: 1 }, border: borders('E2E8F0') },
        total: { font: { color: { rgb: '3B82F6' }, sz: 10 }, fill: { patternType: 'solid', fgColor: { rgb: 'F8FAFC' } }, alignment: { horizontal: 'right', vertical: 'center' }, border: borders('E2E8F0'), numFmt: '#,##0' },
        day:   { font: { color: { rgb: '3B82F6' }, sz: 10 }, fill: { patternType: 'solid', fgColor: { rgb: 'FFFFFF' } }, alignment: { horizontal: 'right', vertical: 'center' }, border: borders('E2E8F0'), numFmt: '#,##0' },
      },
      'balance-fact': {
        label: { font: { bold: true, color: { rgb: '2563EB' }, sz: 10 }, fill: { patternType: 'solid', fgColor: { rgb: 'EFF6FF' } }, alignment: { horizontal: 'left', vertical: 'center', indent: 1 }, border: borders('BFDBFE') },
        total: { font: { bold: true, color: { rgb: '2563EB' }, sz: 10 }, fill: { patternType: 'solid', fgColor: { rgb: 'DBEAFE' } }, alignment: { horizontal: 'right', vertical: 'center' }, border: borders('BFDBFE'), numFmt: '#,##0' },
        day:   { font: { bold: true, color: { rgb: '2563EB' }, sz: 10 }, fill: { patternType: 'solid', fgColor: { rgb: 'EFF6FF' } }, alignment: { horizontal: 'right', vertical: 'center' }, border: borders('BFDBFE'), numFmt: '#,##0' },
      },
      category: {
        label: { font: { color: { rgb: '334155' }, sz: 10 }, fill: { patternType: 'solid', fgColor: { rgb: 'FFFFFF' } }, alignment: { horizontal: 'left', vertical: 'center', wrapText: true }, border: borders('E2E8F0') },
        total: { font: { bold: true, color: { rgb: '1E293B' }, sz: 10 }, fill: { patternType: 'solid', fgColor: { rgb: 'F8FAFC' } }, alignment: { horizontal: 'right', vertical: 'center' }, border: borders('E2E8F0'), numFmt: '#,##0' },
        day:   { font: { color: { rgb: '475569' }, sz: 10 }, fill: { patternType: 'solid', fgColor: { rgb: 'FFFFFF' } }, alignment: { horizontal: 'right', vertical: 'center' }, border: borders('E2E8F0'), numFmt: '#,##0' },
      },
    };

    const totalCols = 2 + numDays;
    for (let r = 0; r < rows.length; r++) {
      const st = STYLES[rowTypes[r]];
      for (let c = 0; c < totalCols; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        if (!ws[addr]) ws[addr] = { v: '', t: 's' };
        const colStyle = c === 0 ? st.label : c === 1 ? st.total : st.day;
        ws[addr].s = colStyle;
        if (ws[addr].t === 'n' && (colStyle as any).numFmt) {
          ws[addr].z = (colStyle as any).numFmt;
        }
      }
    }

    ws['!cols'] = [{ wch: 42 }, { wch: 14 }, ...days.map(() => ({ wch: 12 }))];
    ws['!rows'] = [{ hpt: 28 }];
    ws['!freeze'] = { xSplit: 2, ySplit: 1 };

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Платёжный календарь');
    XLSX.writeFile(wb, `план-факт-${year}-${pad(month)}.xlsx`);
  }

  const totalIncomePlan = days.reduce((s, d) => s + (data?.incomePlan[d] || 0), 0);
  const totalIncomeFact = days.reduce((s, d) => s + (data?.incomeFact[d] || 0), 0);
  const totalExpensePlan = days.reduce((s, d) => s + (data?.expensePlan[d] || 0), 0);
  const totalExpenseFact = days.reduce((s, d) => s + (data?.expenseFact[d] || 0), 0);
  const totalBalance = totalIncomeFact - totalExpenseFact;
  const totalBalancePlan = totalIncomePlan - totalExpensePlan;

  const balancePlan: Record<number, number> = (() => {
    let running = 0;
    const result: Record<number, number> = {};
    for (const d of days) {
      running += (data?.incomePlan[d] || 0) - (data?.expensePlan[d] || 0);
      result[d] = running;
    }
    return result;
  })();

  const isPast = (d: number) => isCurrentMonth && d < todayDay;
  const isFuture = (d: number) => isCurrentMonth && d > todayDay;

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] overflow-hidden">
      <div className="shrink-0 px-4 lg:px-6 pt-3 pb-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarDays size={17} className="text-teal-600" />
          <h1 className="text-sm font-bold text-slate-800">Платёжный календарь</h1>
        </div>
        <div className="flex items-center gap-2">
          {data && (
            <button
              onClick={exportXlsx}
              className="flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-white hover:bg-slate-50 border border-slate-200 px-3 py-1 rounded-lg transition-colors shadow-sm"
              title="Экспорт в Excel"
            >
              <Download size={13} />
              Excel
            </button>
          )}
          {!isCurrentMonth && (
            <button
              onClick={goToday}
              className="text-xs font-medium text-teal-600 bg-teal-50 hover:bg-teal-100 border border-teal-200 px-3 py-1 rounded-lg transition-colors"
            >
              Сегодня
            </button>
          )}
          <div className="flex items-center gap-0.5 bg-white border border-slate-200 rounded-lg px-1 py-0.5 shadow-sm">
            <button onClick={prevMonth} className="p-1 hover:text-teal-600 text-slate-400 hover:bg-slate-50 rounded transition-colors">
              <ChevronLeft size={14} />
            </button>
            <span className="text-sm font-bold text-slate-700 min-w-[120px] text-center">
              {MONTH_NAMES[month - 1]} {year}
            </span>
            <button onClick={nextMonth} className="p-1 hover:text-teal-600 text-slate-400 hover:bg-slate-50 rounded transition-colors">
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="mx-4 lg:mx-6 bg-rose-50 border border-rose-200 rounded-xl p-3 text-rose-700 text-sm shrink-0">{error}</div>
      )}

      {data && !loading && (
        <div
          ref={tableRef}
          className="calendar-scroll flex-1 overflow-auto mx-4 lg:mx-6 mb-4 rounded-xl border border-slate-200 shadow-sm bg-white"
        >
          <table className="border-separate border-spacing-0 text-[11px]" style={{ minWidth: LABEL_W + TOTAL_W + days.length * COL_W }}>
            <thead>
              <tr>
                <th
                  className="text-left px-3 py-2.5 font-semibold border-b border-r text-slate-500 border-slate-200"
                  style={{ position: 'sticky', top: 0, left: 0, zIndex: 40, width: LABEL_W, minWidth: LABEL_W, background: '#f8fafc' }}
                >
                  Статья
                </th>
                <th
                  className="text-right px-2 py-2.5 font-semibold border-b border-r text-slate-400 border-slate-200"
                  style={{ position: 'sticky', top: 0, left: LABEL_W, zIndex: 40, width: TOTAL_W, minWidth: TOTAL_W, background: '#f1f5f9' }}
                >
                  Итого
                </th>
                {days.map(d => {
                  const dow = new Date(year, month - 1, d).getDay();
                  const isToday = d === todayDay;
                  const isWeekend = dow === 0 || dow === 6;
                  const past = isPast(d);
                  return (
                    <th
                      key={d}
                      ref={isToday ? todayColRef : undefined}
                      className={`text-center py-1.5 border-b border-r border-slate-200 select-none transition-colors
                        ${dragOverDay === d && dragState
                          ? 'bg-teal-400 text-white border-teal-300'
                          : isToday
                            ? 'bg-teal-600 text-white border-teal-500'
                            : isWeekend
                              ? 'bg-slate-100 text-slate-400'
                              : past
                                ? 'bg-white text-slate-300'
                                : 'bg-white text-slate-500'
                        }`}
                      style={{ position: 'sticky', top: 0, zIndex: 20, width: COL_W, minWidth: COL_W, cursor: dragState ? 'copy' : 'default' }}
                      onDragOver={e => handleDragOver(e, d)}
                      onDrop={e => handleDrop(e, d)}
                    >
                      <div className="font-bold" style={{ fontSize: 12 }}>{d}</div>
                      <div className="opacity-70" style={{ fontSize: 9 }}>{DAY_SHORT[dow]}</div>
                      {dragState && dragOverDay === d && <div className="text-[8px] mt-0.5 opacity-80">↓ сюда</div>}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              <GroupHeader label="ДОХОДЫ" icon="↑" colSpan={days.length + 2} accent="emerald" />

              <SummaryRow
                label="План"
                total={totalIncomePlan}
                days={days}
                values={data.incomePlan}
                todayDay={todayDay}
                textClass="text-emerald-600"
                rowBg="#ffffff"
                todayBg="#ecfdf5"
                accentColor="#86efac"
                isPast={isPast}
                isFuture={isFuture}
                labelW={LABEL_W}
                totalW={TOTAL_W}
              />
              <SummaryRow
                label="Факт"
                total={totalIncomeFact}
                days={days}
                values={data.incomeFact}
                todayDay={todayDay}
                textClass="text-emerald-700"
                rowBg="#f7fef9"
                todayBg="#d1fae5"
                bold
                accentColor="#22c55e"
                isPast={isPast}
                isFuture={isFuture}
                labelW={LABEL_W}
                totalW={TOTAL_W}
              />

              <GroupHeader label="РАСХОДЫ" icon="↓" colSpan={days.length + 2} accent="rose" />

              <SummaryRow
                label="План"
                total={totalExpensePlan}
                days={days}
                values={data.expensePlan}
                todayDay={todayDay}
                textClass="text-rose-500"
                rowBg="#ffffff"
                todayBg="#fff1f2"
                accentColor="#fca5a5"
                isPast={isPast}
                isFuture={isFuture}
                labelW={LABEL_W}
                totalW={TOTAL_W}
              />
              <SummaryRow
                label="Факт"
                total={totalExpenseFact}
                days={days}
                values={data.expenseFact}
                todayDay={todayDay}
                textClass="text-rose-700"
                rowBg="#fff9f9"
                todayBg="#ffe4e6"
                bold
                accentColor="#f43f5e"
                isPast={isPast}
                isFuture={isFuture}
                labelW={LABEL_W}
                totalW={TOTAL_W}
              />

              <GroupHeader label="БАЛАНС" icon="=" colSpan={days.length + 2} accent="sky" />
              <BalanceRow
                label="План"
                total={totalBalancePlan}
                days={days}
                values={balancePlan}
                todayDay={todayDay}
                labelW={LABEL_W}
                totalW={TOTAL_W}
                rowBg="#ffffff"
                todayBg="#eff6ff"
                accentColor="#93c5fd"
              />
              <BalanceRow
                label="Факт"
                total={totalBalance}
                days={days}
                values={data.balance}
                todayDay={todayDay}
                labelW={LABEL_W}
                totalW={TOTAL_W}
                rowBg="#f7fbff"
                todayBg="#dbeafe"
                accentColor="#3b82f6"
                bold
              />

              {data.expenseCategories.length > 0 && (
                <tr>
                  <td
                    colSpan={2}
                    className="border-b border-slate-200 cursor-pointer select-none"
                    style={{ position: 'sticky', left: 0, zIndex: 10, background: '#f8fafc' }}
                    onClick={() => setCatsOpen(o => !o)}
                  >
                    <div className="flex items-center gap-2 px-3 py-1.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        По статьям расходов
                      </span>
                      <span className="text-[10px] text-slate-400">({data.expenseCategories.length})</span>
                      <span className="ml-auto text-slate-400">
                        {catsOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      </span>
                    </div>
                  </td>
                  <td
                    colSpan={days.length}
                    className="border-b border-slate-200 cursor-pointer"
                    style={{ background: '#f8fafc' }}
                    onClick={() => setCatsOpen(o => !o)}
                  />
                </tr>
              )}

              {catsOpen && data.expenseCategories.map((cat, catIdx) => {
                const catTotal = Object.values(cat.days).flat().reduce((s, e) => s + e.amount, 0);
                return (
                  <tr
                    key={cat.id}
                    className="border-b border-slate-100 group"
                    style={{ background: catIdx % 2 === 0 ? '#ffffff' : '#fafafa' }}
                  >
                    <td
                      className="px-3 py-1.5 border-r border-slate-200 text-slate-600 font-medium"
                      style={{ position: 'sticky', left: 0, zIndex: 10, width: LABEL_W, minWidth: LABEL_W, maxWidth: LABEL_W, background: catIdx % 2 === 0 ? '#ffffff' : '#fafafa', wordBreak: 'break-word', lineHeight: '1.3', borderLeft: '3px solid #f97316' }}
                    >
                      {cat.name}
                    </td>
                    <td
                      className="border-r border-slate-200 text-right px-2 py-1.5 text-slate-500 font-semibold"
                      style={{ position: 'sticky', left: LABEL_W, zIndex: 10, width: TOTAL_W, minWidth: TOTAL_W, background: catIdx % 2 === 0 ? '#f8fafc' : '#f1f5f9' }}
                    >
                      {catTotal > 0 ? fmtCompact(catTotal) : ''}
                    </td>
                    {days.map(d => {
                      const entries = cat.days[d];
                      const isToday = d === todayDay;
                      const past = isPast(d);
                      if (!entries || entries.length === 0) {
                        return (
                          <td
                            key={d}
                            className={`border-r border-slate-100 ${isToday ? 'bg-teal-50/40' : ''}`}
                            style={{ width: COL_W, minWidth: COL_W }}
                          />
                        );
                      }
                      const dom = dominantStatus(entries);
                      const cfg = STATUS_CFG[dom];
                      const total = cellTotal(entries);
                      const statuses = [...new Set(entries.map(e => e.status))];
                      return (
                        <td
                          key={d}
                          className={`border-r border-slate-100 ${isToday ? 'bg-teal-50/40' : ''}`}
                          style={{ width: COL_W, minWidth: COL_W, opacity: past ? 0.75 : 1 }}
                        >
                          <div
                            className={`mx-0.5 my-0.5 rounded-md px-1 py-0.5 select-none
                              ${cfg.bg} border ${cfg.border} hover:shadow-md transition-shadow
                              ${dragState?.catId === cat.id && dragState?.day === d ? 'opacity-30 scale-95' : ''}
                            `}
                            style={{ cursor: dragState ? 'grabbing' : 'grab' }}
                            draggable
                            onDragStart={e => handleDragStart(e, cat.id, d, entries)}
                            onDragEnd={handleDragEnd}
                            onMouseEnter={e => !dragState && showTooltip(entries, cat.name, d, e)}
                            onMouseLeave={hideTooltip}
                            onClick={() => handleChipClick(entries, cat.name, cat.id, d)}
                          >
                            <div className={`font-bold text-center leading-tight ${cfg.text}`} style={{ fontSize: 10 }}>
                              {fmtCompact(total)}
                            </div>
                            <div className="flex justify-center items-center gap-0.5 mt-0.5">
                              {statuses.map(s => (
                                <span key={s} className={`w-1 h-1 rounded-full ${STATUS_CFG[s as keyof typeof STATUS_CFG].dot}`} />
                              ))}
                              {entries.length > 1 && (
                                <span className={`text-[8px] font-bold leading-none opacity-70 ${cfg.text}`}>×{entries.length}</span>
                              )}
                            </div>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {loading && !data && (
        <div className="flex-1 mx-4 lg:mx-6 mb-4 rounded-xl border border-slate-200 bg-white overflow-hidden animate-pulse">
          <div className="h-10 bg-[#1e2a38]" />
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-9 border-b border-slate-100 flex">
              <div style={{ width: LABEL_W + TOTAL_W }} className="bg-slate-50 border-r border-slate-100" />
              <div className="flex-1" />
            </div>
          ))}
        </div>
      )}

      {activeCell && (
        <PaymentCalendarEntryModal
          catName={activeCell.catName}
          day={activeCell.day}
          month={month}
          year={year}
          entries={activeCell.entries}
          userId={user?.id || ''}
          onClose={() => setActiveCell(null)}
          onRefresh={load}
        />
      )}

      {tooltip && (() => {
        const TIP_W = 260;
        const TIP_MAX_H = 300;
        const GAP = 6;
        const spaceBelow = window.innerHeight - tooltip.cellBottom - GAP;
        const spaceAbove = tooltip.cellTop - GAP;
        const showBelow = spaceBelow >= 120 || spaceBelow >= spaceAbove;
        const tipTop = showBelow
          ? tooltip.cellBottom + GAP
          : tooltip.cellTop - GAP - Math.min(TIP_MAX_H, spaceAbove);
        const tipCenter = tooltip.cellLeft + tooltip.cellWidth / 2;
        const tipLeft = Math.max(8, Math.min(tipCenter - TIP_W / 2, window.innerWidth - TIP_W - 8));
        return (
        <div
          className="fixed z-[9999] bg-white border border-slate-200 rounded-xl shadow-xl pointer-events-none flex flex-col tooltip-popup"
          style={{
            left: tipLeft,
            top: tipTop,
            width: TIP_W,
            maxHeight: showBelow ? Math.min(TIP_MAX_H, spaceBelow) : Math.min(TIP_MAX_H, spaceAbove),
          }}
        >
          <div className="px-3 py-2 border-b border-slate-100 bg-slate-50 rounded-t-xl flex-shrink-0">
            <div className="text-[11px] font-bold text-slate-600">{tooltip.catName}</div>
            <div className="text-[10px] text-slate-400">{tooltip.day} {MONTH_NAMES_GEN[month - 1]} {year}</div>
          </div>
          <div className="p-3 space-y-2 overflow-y-auto flex-1 min-h-0">
            {tooltip.entries.slice(0, 5).map((entry, i) => {
              const cfg = STATUS_CFG[entry.status];
              return (
                <div key={entry.id} className={`${i > 0 ? 'pt-2 border-t border-slate-100' : ''}`}>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${cfg.pill}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                      {cfg.label}
                    </span>
                    <span className="text-xs font-bold text-slate-800">{fmtFull(entry.amount)}</span>
                  </div>
                  {entry.description && (
                    <p className="text-[11px] text-slate-600 leading-snug">{entry.description}</p>
                  )}
                  <div className="flex gap-2 mt-0.5 flex-wrap">
                    {entry.contractorName && (
                      <span className="text-[10px] text-slate-400">{entry.contractorName}</span>
                    )}
                    {entry.username && (
                      <span className="text-[10px] text-slate-400">· {entry.username}</span>
                    )}
                  </div>
                </div>
              );
            })}
            {tooltip.entries.length > 5 && (
              <div className="pt-2 border-t border-slate-100 text-center">
                <span className="text-[10px] text-slate-400 italic">и ещё {tooltip.entries.length - 5} операций…</span>
              </div>
            )}
            {tooltip.entries.length > 1 && (
              <div className="pt-2 border-t border-slate-100 flex justify-between items-center">
                <span className="text-[10px] text-slate-400">Итого</span>
                <span className="text-xs font-bold text-slate-700">{fmtFull(cellTotal(tooltip.entries))}</span>
              </div>
            )}
          </div>
        </div>
        );
      })()}
    </div>
  );
};

interface GroupHeaderProps {
  label: string;
  icon: string;
  colSpan: number;
  accent: 'emerald' | 'rose' | 'sky';
}
const GROUP_ACCENT = {
  emerald: { color: '#34d399' },
  rose:    { color: '#fb7185' },
  sky:     { color: '#60a5fa' },
};
const GroupHeader: React.FC<GroupHeaderProps> = ({ label, icon, colSpan, accent }) => (
  <tr>
    <td
      colSpan={2}
      className="text-[10px] font-bold uppercase tracking-widest"
      style={{
        position: 'sticky', left: 0, zIndex: 10,
        background: '#f8fafc',
        borderLeft: `3px solid ${GROUP_ACCENT[accent].color}`,
        borderBottom: '1px solid #e2e8f0',
        borderTop: '1px solid #e2e8f0',
        padding: '5px 10px',
        color: '#64748b',
      }}
    >
      <span style={{ color: GROUP_ACCENT[accent].color, marginRight: 4 }}>{icon}</span>{label}
    </td>
    <td
      colSpan={colSpan - 2}
      style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', borderTop: '1px solid #e2e8f0' }}
    />
  </tr>
);

interface SummaryRowProps {
  label: string;
  total: number;
  days: number[];
  values: Record<number, number>;
  todayDay: number;
  textClass: string;
  rowBg: string;
  todayBg: string;
  bold?: boolean;
  accentColor: string;
  isPast: (d: number) => boolean;
  isFuture: (d: number) => boolean;
  labelW: number;
  totalW: number;
}
const SummaryRow: React.FC<SummaryRowProps> = ({
  label, total, days, values, todayDay, textClass, rowBg, todayBg, bold, accentColor, isPast, labelW, totalW
}) => (
  <tr className="border-b border-slate-100" style={{ background: rowBg }}>
    <td
      className="px-3 py-1.5 border-r border-slate-200 text-slate-600"
      style={{ position: 'sticky', left: 0, zIndex: 10, width: labelW, minWidth: labelW, fontWeight: bold ? 600 : 400, background: rowBg, borderLeft: `3px solid ${accentColor}` }}
    >
      {label}
    </td>
    <td
      className="border-r border-slate-200 text-right px-2 py-1.5"
      style={{ position: 'sticky', left: labelW, zIndex: 10, width: totalW, minWidth: totalW, background: rowBg }}
    >
      <span className={`${textClass} ${bold ? 'font-bold' : 'font-medium'}`}>
        {total ? fmtCompact(total) : '—'}
      </span>
    </td>
    {days.map(d => {
      const v = values[d] || 0;
      const isToday = d === todayDay;
      const past = isPast(d);
      return (
        <td
          key={d}
          className="border-r border-slate-100 text-center py-1.5 px-0.5"
          style={{ background: isToday ? todayBg : rowBg, opacity: past && !v ? 0.4 : 1 }}
        >
          {v > 0 && (
            <span className={`${textClass} ${bold ? 'font-bold' : 'font-medium'}`} style={{ fontSize: 11 }}>
              {fmtCompact(v)}
            </span>
          )}
        </td>
      );
    })}
  </tr>
);

interface BalanceRowProps {
  label: string;
  total: number;
  days: number[];
  values: Record<number, number>;
  todayDay: number;
  labelW: number;
  totalW: number;
  rowBg?: string;
  todayBg?: string;
  accentColor?: string;
  bold?: boolean;
}
const BalanceRow: React.FC<BalanceRowProps> = ({
  label, total, days, values, todayDay, labelW, totalW,
  rowBg = '#f8fafc', todayBg = '#e0f2fe', accentColor = '#64748b', bold = false
}) => (
  <tr className="border-b border-slate-200" style={{ background: rowBg }}>
    <td
      className="px-3 py-1.5 border-r border-slate-200 text-slate-700"
      style={{ position: 'sticky', left: 0, zIndex: 10, width: labelW, minWidth: labelW, background: rowBg, fontWeight: bold ? 700 : 400, borderLeft: `3px solid ${accentColor}` }}
    >
      {label}
    </td>
    <td
      className="border-r border-slate-200 text-right px-2 py-1.5"
      style={{ position: 'sticky', left: labelW, zIndex: 10, width: totalW, minWidth: totalW, background: rowBg, fontWeight: bold ? 700 : 600 }}
    >
      <span className={total >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
        {total < 0 ? '−' : ''}{fmtCompact(Math.abs(total))}
      </span>
    </td>
    {days.map(d => {
      const v = values[d] ?? 0;
      const isToday = d === todayDay;
      return (
        <td
          key={d}
          className="border-r border-slate-100 text-center py-1.5 px-0.5"
          style={{ background: isToday ? todayBg : rowBg }}
        >
          {v !== 0 && (
            <span
              className={`text-[11px] ${v >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}
              style={{ fontWeight: bold ? 700 : 600 }}
            >
              {v < 0 ? '−' : ''}{fmtCompact(Math.abs(v))}
            </span>
          )}
        </td>
      );
    })}
  </tr>
);
