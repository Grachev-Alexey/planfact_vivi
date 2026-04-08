import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Calendar, X } from 'lucide-react';
import { getMoscowNow } from '../../utils/moscow';

interface DatePickerProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  required?: boolean;
  compact?: boolean;
}

const MONTHS_RU = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];
const MONTHS_RU_GEN = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
];
const DAYS_RU = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

function fmt(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDisplay(s: string): string {
  if (!s) return '';
  const d = new Date(s + 'T00:00:00');
  return `${d.getDate()} ${MONTHS_RU_GEN[d.getMonth()]} ${d.getFullYear()}`;
}

export const DatePicker: React.FC<DatePickerProps> = ({ value, onChange, placeholder = 'Выберите дату', required, compact = false }) => {
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => {
    if (value) return new Date(value + 'T00:00:00');
    return getMoscowNow();
  });
  const ref = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value) {
      setViewDate(new Date(value + 'T00:00:00'));
    }
  }, [value]);

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
      const ddH = dd.offsetHeight || 360;
      const ddW = dd.offsetWidth || 300;
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

  const todayStr = fmt(getMoscowNow());

  const handleDayClick = (date: string) => {
    onChange(date);
    setOpen(false);
  };

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

  const displayValue = value ? formatDisplay(value) : '';

  const btnClass = compact
    ? `w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-[11px] bg-slate-50 text-left focus:outline-none focus:border-teal-500 focus:bg-white transition-all flex items-center justify-between gap-1.5 ${displayValue ? 'text-slate-800' : 'text-slate-400'}`
    : `w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm bg-white text-left focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all flex items-center gap-2 ${displayValue ? 'text-slate-900' : 'text-slate-400'}`;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => { setOpen(!open); if (!open && value) setViewDate(new Date(value + 'T00:00:00')); }}
        className={btnClass}
      >
        <Calendar size={compact ? 12 : 14} className="text-slate-400 shrink-0" />
        <span className="truncate flex-1">{displayValue || placeholder}</span>
        {value && !required ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onChange(''); }}
            className="shrink-0 text-slate-400 hover:text-slate-600"
          >
            <X size={compact ? 11 : 14} />
          </button>
        ) : null}
      </button>

      {open && createPortal(
        <div
          ref={dropdownRef}
          className="fixed z-[100] bg-white border border-slate-200 rounded-xl shadow-2xl w-[300px] sm:w-[320px]"
          style={{ top: -9999, left: -9999 }}
        >
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
                const selected = day.date === value;
                const isToday = day.date === todayStr;
                const isSat = (i % 7) === 5;
                const isSun = (i % 7) === 6;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleDayClick(day.date)}
                    className={`
                      relative h-8 text-xs font-medium rounded-lg transition-all
                      ${!day.currentMonth ? 'text-slate-300' : (isSat || isSun) ? 'text-rose-400 hover:bg-slate-100' : 'text-slate-700 hover:bg-slate-100'}
                      ${selected ? 'bg-teal-600 text-white shadow-sm hover:bg-teal-700' : ''}
                      ${isToday && !selected ? 'ring-1 ring-teal-300 bg-teal-50 text-teal-700 font-semibold' : ''}
                    `}
                  >
                    {day.day}
                  </button>
                );
              })}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
