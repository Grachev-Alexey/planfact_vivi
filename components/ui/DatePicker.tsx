import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';

const MONTH_NAMES = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];

const MONTH_NAMES_GENITIVE = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
];

const DAY_NAMES = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

interface DatePickerProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  required?: boolean;
}

export const DatePicker: React.FC<DatePickerProps> = ({ value, onChange, placeholder = 'дд.мм.гггг', required }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selectedDate = value ? new Date(value + 'T00:00:00') : null;
  const [viewYear, setViewYear] = useState(selectedDate?.getFullYear() || new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(selectedDate?.getMonth() || new Date().getMonth());

  useEffect(() => {
    if (value) {
      const d = new Date(value + 'T00:00:00');
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
    }
  }, [value]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const firstDayOfMonth = new Date(viewYear, viewMonth, 1);
  let startDay = firstDayOfMonth.getDay() - 1;
  if (startDay < 0) startDay = 6;

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

  const cells: { day: number; month: number; year: number; isCurrentMonth: boolean }[] = [];
  for (let i = startDay - 1; i >= 0; i--) {
    const pm = viewMonth === 0 ? 11 : viewMonth - 1;
    const py = viewMonth === 0 ? viewYear - 1 : viewYear;
    cells.push({ day: daysInPrevMonth - i, month: pm, year: py, isCurrentMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, month: viewMonth, year: viewYear, isCurrentMonth: true });
  }
  const remaining = 42 - cells.length;
  for (let d = 1; d <= remaining; d++) {
    const nm = viewMonth === 11 ? 0 : viewMonth + 1;
    const ny = viewMonth === 11 ? viewYear + 1 : viewYear;
    cells.push({ day: d, month: nm, year: ny, isCurrentMonth: false });
  }

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const handleSelect = (cell: typeof cells[0]) => {
    const dateStr = `${cell.year}-${String(cell.month + 1).padStart(2, '0')}-${String(cell.day).padStart(2, '0')}`;
    onChange(dateStr);
    setOpen(false);
  };

  const handleToday = () => {
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    onChange(dateStr);
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
    setOpen(false);
  };

  const displayValue = selectedDate
    ? `${selectedDate.getDate()} ${MONTH_NAMES_GENITIVE[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`
    : '';

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm bg-white text-left focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all flex items-center justify-between gap-2 ${
          displayValue ? 'text-slate-900' : 'text-slate-400'
        }`}
      >
        <span className="truncate">{displayValue || placeholder}</span>
        <Calendar size={15} className="text-slate-400 shrink-0" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl p-3 w-[280px]">
          <div className="flex items-center justify-between mb-2">
            <button type="button" onClick={prevMonth} className="p-1 hover:bg-slate-100 rounded text-slate-500">
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-semibold text-slate-800">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </span>
            <button type="button" onClick={nextMonth} className="p-1 hover:bg-slate-100 rounded text-slate-500">
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="grid grid-cols-7 mb-1">
            {DAY_NAMES.map(d => (
              <div key={d} className="text-center text-[10px] font-semibold text-slate-400 py-1">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {cells.map((cell, i) => {
              const cellStr = `${cell.year}-${String(cell.month + 1).padStart(2, '0')}-${String(cell.day).padStart(2, '0')}`;
              const isSelected = cellStr === value;
              const isToday = cellStr === todayStr;
              const isSat = (i % 7) === 5;
              const isSun = (i % 7) === 6;

              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSelect(cell)}
                  className={`h-8 w-8 mx-auto flex items-center justify-center text-xs rounded-lg transition-all ${
                    isSelected
                      ? 'bg-teal-600 text-white font-bold'
                      : isToday
                        ? 'bg-teal-50 text-teal-700 font-semibold ring-1 ring-teal-300'
                        : cell.isCurrentMonth
                          ? (isSat || isSun ? 'text-rose-400 hover:bg-slate-100' : 'text-slate-700 hover:bg-slate-100')
                          : 'text-slate-300'
                  }`}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={handleToday}
            className="w-full mt-2 py-1.5 text-xs text-teal-600 hover:bg-teal-50 rounded-lg font-medium"
          >
            Сегодня
          </button>
        </div>
      )}
    </div>
  );
};
