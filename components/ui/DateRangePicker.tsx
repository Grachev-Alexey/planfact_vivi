import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Calendar, X } from 'lucide-react';
import { getMoscowNow } from '../../utils/moscow';

interface DateRangePickerProps {
  dateFrom: string;
  dateTo: string;
  onChangeFrom: (val: string) => void;
  onChangeTo: (val: string) => void;
  label?: string;
}

const MONTHS_RU = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];
const DAYS_RU = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

function fmt(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function startOfWeek(d: Date): Date {
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  const r = new Date(d);
  r.setDate(r.getDate() + diff);
  return r;
}

function endOfWeek(d: Date): Date {
  const s = startOfWeek(d);
  const r = new Date(s);
  r.setDate(r.getDate() + 6);
  return r;
}

function formatDisplay(from: string, to: string): string {
  if (!from && !to) return '';
  const f = (s: string) => {
    const parts = s.split('-');
    return `${parts[2]}.${parts[1]}.${parts[0].slice(2)}`;
  };
  if (from && to) return `${f(from)} — ${f(to)}`;
  if (from) return `с ${f(from)}`;
  return `до ${f(to)}`;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({ dateFrom, dateTo, onChangeFrom, onChangeTo, label }) => {
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => {
    if (dateFrom) return new Date(dateFrom + 'T00:00:00');
    return getMoscowNow();
  });
  const ref = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current?.contains(e.target as Node)) return;
      if (dropdownRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (!open || !ref.current || !dropdownRef.current) return;
    const trigger = ref.current;
    const dd = dropdownRef.current;
    const position = () => {
      const rect = trigger.getBoundingClientRect();
      const ddH = dd.offsetHeight || 380;
      const ddW = dd.offsetWidth || 320;
      const spaceBelow = window.innerHeight - rect.bottom;
      const top = spaceBelow > ddH + 4 ? rect.bottom + 4 : rect.top - ddH - 4;
      let left = rect.left;
      if (left + ddW > window.innerWidth - 8) left = window.innerWidth - ddW - 8;
      if (left < 8) left = 8;
      dd.style.top = `${Math.max(4, top)}px`;
      dd.style.left = `${left}px`;
    };
    const raf = requestAnimationFrame(() => requestAnimationFrame(position));
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', position);
      window.removeEventListener('scroll', position, true);
    };
  }, [open]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const calendarDays = useMemo(() => {
    const first = new Date(year, month, 1);
    let startDay = first.getDay() - 1;
    if (startDay < 0) startDay = 6;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrev = new Date(year, month, 0).getDate();

    const days: { date: string; day: number; currentMonth: boolean }[] = [];
    for (let i = startDay - 1; i >= 0; i--) {
      const d = daysInPrev - i;
      const dt = new Date(year, month - 1, d);
      days.push({ date: fmt(dt), day: d, currentMonth: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(year, month, d);
      days.push({ date: fmt(dt), day: d, currentMonth: true });
    }
    const remaining = 42 - days.length;
    for (let d = 1; d <= remaining; d++) {
      const dt = new Date(year, month + 1, d);
      days.push({ date: fmt(dt), day: d, currentMonth: false });
    }
    return days;
  }, [year, month]);

  const isInRange = (date: string) => {
    if (!dateFrom || !dateTo) return false;
    return date >= dateFrom && date <= dateTo;
  };
  const isStart = (date: string) => date === dateFrom;
  const isEnd = (date: string) => date === dateTo;
  const isToday = (date: string) => date === fmt(getMoscowNow());

  const handleDayClick = (date: string) => {
    if (!dateFrom || (dateFrom && dateTo)) {
      onChangeFrom(date);
      onChangeTo('');
    } else {
      if (date < dateFrom) {
        onChangeTo(dateFrom);
        onChangeFrom(date);
      } else {
        onChangeTo(date);
      }
    }
  };

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

  const today = getMoscowNow();
  const presets = [
    { label: 'Сегодня', fn: () => { const d = fmt(today); onChangeFrom(d); onChangeTo(d); } },
    { label: 'Вчера', fn: () => { const d = new Date(today); d.setDate(d.getDate() - 1); const s = fmt(d); onChangeFrom(s); onChangeTo(s); } },
    { label: 'Эта неделя', fn: () => { onChangeFrom(fmt(startOfWeek(today))); onChangeTo(fmt(endOfWeek(today))); } },
    { label: '7 дней', fn: () => { const d = new Date(today); d.setDate(d.getDate() - 6); onChangeFrom(fmt(d)); onChangeTo(fmt(today)); } },
    { label: 'Этот месяц', fn: () => { onChangeFrom(fmt(new Date(today.getFullYear(), today.getMonth(), 1))); onChangeTo(fmt(new Date(today.getFullYear(), today.getMonth() + 1, 0))); } },
    { label: '30 дней', fn: () => { const d = new Date(today); d.setDate(d.getDate() - 29); onChangeFrom(fmt(d)); onChangeTo(fmt(today)); } },
  ];

  const hasValue = dateFrom || dateTo;
  const displayText = formatDisplay(dateFrom, dateTo);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => { setOpen(!open); if (!open && dateFrom) setViewDate(new Date(dateFrom + 'T00:00:00')); }}
        className={`w-full px-2.5 py-1.5 border rounded-lg text-xs text-left flex items-center gap-1.5 transition-colors ${
          hasValue
            ? 'bg-teal-50 border-teal-300 text-teal-700'
            : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300'
        }`}
      >
        <Calendar size={12} className="shrink-0" />
        <span className="truncate flex-1">{displayText || (label || 'Дата оплаты')}</span>
        {hasValue ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onChangeFrom(''); onChangeTo(''); }}
            className="shrink-0 text-teal-400 hover:text-teal-600"
          >
            <X size={11} />
          </button>
        ) : null}
      </button>

      {open && createPortal(
        <div
          ref={dropdownRef}
          className="fixed z-[100] bg-white border border-slate-200 rounded-xl shadow-2xl w-[320px] sm:w-[340px]"
          style={{ top: -9999, left: -9999 }}
        >
          <div className="flex gap-1.5 p-2.5 border-b border-slate-100 flex-wrap">
            {presets.map(p => (
              <button
                key={p.label}
                type="button"
                onClick={() => { p.fn(); }}
                className="px-2 py-1 rounded-md text-[11px] font-medium bg-slate-100 text-slate-600 hover:bg-teal-50 hover:text-teal-700 transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="p-3">
            <div className="flex items-center justify-between mb-3">
              <button type="button" onClick={prevMonth} className="p-1 rounded-lg hover:bg-slate-100 text-slate-500">
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm font-semibold text-slate-700">
                {MONTHS_RU[month]} {year}
              </span>
              <button type="button" onClick={nextMonth} className="p-1 rounded-lg hover:bg-slate-100 text-slate-500">
                <ChevronRight size={16} />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-0 mb-1">
              {DAYS_RU.map(d => (
                <div key={d} className="text-center text-[10px] font-medium text-slate-400 py-1">{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-0">
              {calendarDays.map((day, i) => {
                const selected = isStart(day.date) || isEnd(day.date);
                const inRange = isInRange(day.date);
                const todayMark = isToday(day.date);
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleDayClick(day.date)}
                    className={`
                      relative h-8 text-xs font-medium transition-all
                      ${!day.currentMonth ? 'text-slate-300' : 'text-slate-700'}
                      ${selected ? 'bg-teal-600 text-white z-10 rounded-lg shadow-sm' : ''}
                      ${inRange && !selected ? 'bg-teal-50 text-teal-700' : ''}
                      ${!selected && !inRange && day.currentMonth ? 'hover:bg-slate-100 rounded-lg' : ''}
                      ${isStart(day.date) && dateTo ? 'rounded-l-lg rounded-r-none' : ''}
                      ${isEnd(day.date) && dateFrom ? 'rounded-r-lg rounded-l-none' : ''}
                      ${isStart(day.date) && isEnd(day.date) ? 'rounded-lg' : ''}
                    `}
                  >
                    {day.day}
                    {todayMark && !selected && (
                      <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-teal-500" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {(dateFrom || dateTo) && (
            <div className="px-3 pb-3 flex items-center justify-between">
              <span className="text-xs text-slate-500">{displayText}</span>
              <button
                type="button"
                onClick={() => { onChangeFrom(''); onChangeTo(''); }}
                className="text-xs text-teal-600 hover:text-teal-700 font-medium"
              >
                Сбросить
              </button>
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
};
