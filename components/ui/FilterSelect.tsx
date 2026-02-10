import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search, Check, X } from 'lucide-react';

interface FilterOption {
  id: string;
  label: string;
  sublabel?: string;
  indent?: number;
}

interface FilterSelectProps {
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
  options: FilterOption[];
  searchable?: boolean;
}

function calcDropdownPos(triggerEl: HTMLElement, dropdownH: number = 260, minWidth: number = 200) {
  const rect = triggerEl.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom;
  const top = spaceBelow > dropdownH ? rect.bottom + 2 : rect.top - dropdownH - 2;
  return {
    top: Math.max(4, top),
    left: rect.left,
    width: Math.max(rect.width, minWidth),
  };
}

export const FilterSelect: React.FC<FilterSelectProps> = ({ value, onChange, placeholder, options, searchable = true }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const posRef = useRef({ top: -9999, left: -9999, width: 200 });

  const handleOpen = () => {
    if (open) { setOpen(false); return; }
    if (ref.current) {
      posRef.current = calcDropdownPos(ref.current);
    }
    setOpen(true);
    setSearch('');
    setTimeout(() => inputRef.current?.focus(), 10);
  };

  useEffect(() => {
    if (!open) return;
    const update = () => {
      if (ref.current && dropdownRef.current) {
        const p = calcDropdownPos(ref.current);
        dropdownRef.current.style.top = `${p.top}px`;
        dropdownRef.current.style.left = `${p.left}px`;
        dropdownRef.current.style.width = `${p.width}px`;
      }
    };
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (ref.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return options;
    const q = search.toLowerCase();
    return options.filter(o => o.label.toLowerCase().includes(q) || (o.sublabel && o.sublabel.toLowerCase().includes(q)));
  }, [options, search]);

  const selectedLabel = options.find(o => o.id === value)?.label || '';

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={handleOpen}
        className={`w-full px-2.5 py-1.5 border rounded-lg text-xs text-left flex items-center justify-between gap-1 transition-colors ${
          value
            ? 'bg-teal-50 border-teal-300 text-teal-700'
            : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300'
        }`}
      >
        <span className="truncate">{value ? selectedLabel : placeholder}</span>
        {value ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onChange(''); }}
            className="shrink-0 text-teal-400 hover:text-teal-600"
          >
            <X size={11} />
          </button>
        ) : (
          <ChevronDown size={11} className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        )}
      </button>

      {open && createPortal(
        <div
          ref={dropdownRef}
          className="fixed z-[100] bg-white border border-slate-200 rounded-lg shadow-2xl max-h-[250px] flex flex-col"
          style={{ top: posRef.current.top, left: posRef.current.left, width: posRef.current.width }}
        >
          {searchable && (
            <div className="p-1.5 border-b border-slate-100 shrink-0">
              <div className="relative">
                <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  ref={inputRef}
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-6 pr-2 py-1.5 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-teal-500"
                  placeholder="Поиск..."
                />
              </div>
            </div>
          )}

          <div className="overflow-y-auto flex-1">
            <button
              type="button"
              onClick={() => { onChange(''); setOpen(false); }}
              className={`w-full px-2.5 py-1.5 text-left text-xs hover:bg-slate-50 transition-colors ${!value ? 'bg-teal-50 text-teal-600 font-medium' : 'text-slate-400'}`}
            >
              {placeholder}
            </button>

            {filtered.map(opt => (
              <button
                key={opt.id}
                type="button"
                onClick={() => { onChange(opt.id); setOpen(false); }}
                className={`w-full text-left hover:bg-slate-50 flex items-center gap-1.5 transition-colors py-1.5 pr-2.5 ${
                  value === opt.id ? 'bg-teal-50 text-teal-700' : 'text-slate-700'
                }`}
                style={{ paddingLeft: `${10 + (opt.indent || 0) * 12}px` }}
              >
                {value === opt.id && <Check size={10} className="text-teal-600 shrink-0" />}
                <span className="min-w-0">
                  <span className={`text-xs block ${value === opt.id ? 'font-medium' : ''} ${(opt.indent || 0) > 0 ? 'text-slate-500' : ''}`}>{opt.label}</span>
                  {opt.sublabel && <span className="text-[10px] text-slate-400 block">{opt.sublabel}</span>}
                </span>
              </button>
            ))}

            {filtered.length === 0 && (
              <div className="px-2.5 py-3 text-center text-xs text-slate-400">Ничего не найдено</div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
