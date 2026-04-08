import React, { useState, useRef, useMemo, useCallback } from 'react';
import { useFinance } from '../context/FinanceContext';
import { useAuth } from '../context/AuthContext';
import { Modal } from './ui/Modal';
import { Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle2, X } from 'lucide-react';
interface ImportRow {
  date: string;
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  accountId: string;
  toAccountId: string;
  categoryId: string;
  studioId: string;
  contractorId: string;
  description: string;
  confirmed: boolean;
  accrualDate: string;
}

interface ParsedRow {
  raw: Record<string, string>;
  mapped: Partial<ImportRow>;
  errors: string[];
}

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TYPE_MAP: Record<string, 'income' | 'expense' | 'transfer'> = {
  'поступление': 'income',
  'доход': 'income',
  'income': 'income',
  'выплата': 'expense',
  'расход': 'expense',
  'expense': 'expense',
  'перемещение': 'transfer',
  'перевод': 'transfer',
  'transfer': 'transfer',
};

export const ImportModal: React.FC<ImportModalProps> = ({ isOpen, onClose }) => {
  const { categories, accounts, studios, contractors, refreshData } = useFinance();
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; errors: { row: number; error: string }[] } | null>(null);
  const [fileName, setFileName] = useState('');

  const findByName = useCallback((list: { id: string; name: string }[], value: string): string => {
    if (!value || !value.trim()) return '';
    const v = value.trim().toLowerCase();
    const exact = list.find(i => i.name.toLowerCase() === v);
    if (exact) return exact.id;
    const partial = list.find(i => i.name.toLowerCase().includes(v) || v.includes(i.name.toLowerCase()));
    return partial ? partial.id : '';
  }, []);

  const parseDate = (val: any, XLSX: any): string => {
    if (!val) return '';
    if (typeof val === 'number') {
      const d = XLSX.SSF.parse_date_code(val);
      if (d) return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
    }
    const s = String(val).trim();
    const ddmmyyyy = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
    if (ddmmyyyy) return `${ddmmyyyy[3]}-${ddmmyyyy[2].padStart(2, '0')}-${ddmmyyyy[1].padStart(2, '0')}`;
    const yyyymmdd = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (yyyymmdd) return `${yyyymmdd[1]}-${yyyymmdd[2]}-${yyyymmdd[3]}`;
    const parsed = new Date(s);
    if (!isNaN(parsed.getTime())) {
      return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
    }
    return '';
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);

    const XLSX = await import('xlsx');
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data, { type: 'array', cellDates: false });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const json: Record<string, any>[] = XLSX.utils.sheet_to_json(ws, { raw: true, defval: '' });

      const colMap: Record<string, string> = {};
      if (json.length > 0) {
        const keys = Object.keys(json[0]);
        for (const k of keys) {
          const kl = k.toLowerCase().trim();
          if (kl === 'дата' || kl === 'date') colMap['date'] = k;
          else if (kl === 'сумма' || kl === 'amount') colMap['amount'] = k;
          else if (kl === 'тип' || kl === 'type' || kl === 'тип операции') colMap['type'] = k;
          else if (kl === 'счет' || kl === 'account' || kl === 'счёт') colMap['account'] = k;
          else if (kl === 'на счет' || kl === 'на счёт' || kl === 'счет назначения' || kl === 'to account') colMap['toAccount'] = k;
          else if (kl === 'статья' || kl === 'категория' || kl === 'category') colMap['category'] = k;
          else if (kl === 'студия' || kl === 'studio') colMap['studio'] = k;
          else if (kl === 'контрагент' || kl === 'contractor') colMap['contractor'] = k;
          else if (kl === 'описание' || kl === 'назначение' || kl === 'назначение платежа' || kl === 'description' || kl === 'комментарий') colMap['description'] = k;
          else if (kl === 'подтверждена' || kl === 'confirmed' || kl === 'оплачена') colMap['confirmed'] = k;
          else if (kl === 'дата начисления' || kl === 'accrual date' || kl === 'начисление') colMap['accrualDate'] = k;
        }
      }

      const rows: ParsedRow[] = json.map(row => {
        const errors: string[] = [];
        const raw: Record<string, string> = {};
        Object.entries(row).forEach(([k, v]) => { raw[k] = String(v); });

        const dateStr = parseDate(row[colMap['date']], XLSX);
        if (!dateStr) errors.push('Некорректная дата');

        const amountRaw = row[colMap['amount']];
        const amount = parseFloat(String(amountRaw).replace(/\s/g, '').replace(',', '.'));
        if (isNaN(amount) || amount <= 0) errors.push('Некорректная сумма');

        const typeRaw = String(row[colMap['type']] || '').trim().toLowerCase();
        const type = TYPE_MAP[typeRaw];
        if (!type) errors.push(`Неизвестный тип: "${row[colMap['type']] || ''}"` );

        const accountName = String(row[colMap['account']] || '').trim();
        const accountId = findByName(accounts, accountName);
        if (!accountId && accountName) errors.push(`Счет не найден: "${accountName}"`);
        if (!accountId && !accountName) errors.push('Не указан счет');

        const toAccountName = String(row[colMap['toAccount']] || '').trim();
        const toAccountId = toAccountName ? findByName(accounts, toAccountName) : '';
        if (type === 'transfer' && !toAccountId) errors.push('Для перемещения укажите счет назначения');
        if (type === 'transfer' && toAccountId && toAccountId === accountId) errors.push('Счет и счет назначения совпадают');

        const categoryName = String(row[colMap['category']] || '').trim();
        const categoryId = categoryName ? findByName(categories, categoryName) : '';
        if (categoryName && !categoryId) errors.push(`Статья не найдена: "${categoryName}"`);
        if (type && type !== 'transfer' && !categoryId) errors.push('Не указана статья');

        const studioName = String(row[colMap['studio']] || '').trim();
        const studioId = studioName ? findByName(studios, studioName) : '';

        const contractorName = String(row[colMap['contractor']] || '').trim();
        const contractorId = contractorName ? findByName(contractors, contractorName) : '';

        const description = String(row[colMap['description']] || '').trim();

        const confirmedRaw = String(row[colMap['confirmed']] || '').trim().toLowerCase();
        const confirmed = ['да', 'yes', 'true', '1', '+'].includes(confirmedRaw);

        const accrualDate = parseDate(row[colMap['accrualDate']], XLSX);

        return {
          raw,
          mapped: { date: dateStr, amount, type, accountId, toAccountId, categoryId, studioId, contractorId, description, confirmed, accrualDate },
          errors,
        };
      });

    setParsedRows(rows);
  };

  const validRows = useMemo(() => parsedRows.filter(r => r.errors.length === 0), [parsedRows]);
  const errorRows = useMemo(() => parsedRows.filter(r => r.errors.length > 0), [parsedRows]);

  const handleImport = async () => {
    if (validRows.length === 0) return;
    setImporting(true);
    try {
      const res = await fetch('/api/transactions/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': user?.id?.toString() || '' },
        body: JSON.stringify({ rows: validRows.map(r => r.mapped) }),
      });
      const data = await res.json();
      setResult(data);
      if (data.imported > 0) {
        await refreshData();
      }
    } catch (err) {
      setResult({ imported: 0, errors: [{ row: 0, error: 'Ошибка сети' }] });
    } finally {
      setImporting(false);
    }
  };

  const handleDownloadTemplate = async () => {
    const accName1 = accounts.length > 0 ? accounts[0].name : 'Название счета';
    const accName2 = accounts.length > 1 ? accounts[1].name : accName1;
    const incCat = categories.find(c => c.type === 'income');
    const expCat = categories.find(c => c.type === 'expense');
    const templateData = [
      {
        'Дата': '10.02.2026',
        'Сумма': 50000,
        'Тип': 'Поступление',
        'Счет': accName1,
        'На счет': '',
        'Статья': incCat ? incCat.name : 'Название статьи',
        'Студия': studios.length > 0 ? studios[0].name : '',
        'Контрагент': contractors.length > 0 ? contractors[0].name : '',
        'Описание': 'Пример поступления',
        'Подтверждена': 'Да',
        'Дата начисления': '',
      },
      {
        'Дата': '11.02.2026',
        'Сумма': 15000,
        'Тип': 'Выплата',
        'Счет': accName1,
        'На счет': '',
        'Статья': expCat ? expCat.name : 'Название статьи',
        'Студия': '',
        'Контрагент': '',
        'Описание': 'Пример расхода',
        'Подтверждена': 'Нет',
        'Дата начисления': '15.02.2026',
      },
      {
        'Дата': '12.02.2026',
        'Сумма': 10000,
        'Тип': 'Перемещение',
        'Счет': accName1,
        'На счет': accName2,
        'Статья': '',
        'Студия': '',
        'Контрагент': '',
        'Описание': 'Пример перемещения',
        'Подтверждена': '',
        'Дата начисления': '',
      },
    ];
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(templateData);
    ws['!cols'] = [
      { wch: 14 }, { wch: 12 }, { wch: 16 }, { wch: 20 }, { wch: 20 },
      { wch: 20 }, { wch: 16 }, { wch: 20 }, { wch: 30 }, { wch: 14 }, { wch: 18 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Шаблон');
    XLSX.writeFile(wb, 'vivi_import_template.xlsx');
  };

  const handleClose = () => {
    setParsedRows([]);
    setResult(null);
    setFileName('');
    if (fileRef.current) fileRef.current.value = '';
    onClose();
  };

  const getTypeName = (t: string) => {
    if (t === 'income') return 'Поступление';
    if (t === 'expense') return 'Выплата';
    if (t === 'transfer') return 'Перемещение';
    return t;
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Импорт операций">
      <div className="p-5 space-y-4">
        {!result && (
          <>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="flex items-center gap-2 px-4 py-2 text-sm border border-teal-300 text-teal-700 bg-teal-50 rounded-lg hover:bg-teal-100 font-medium transition-colors"
              >
                <Download size={15} />
                Скачать шаблон .xlsx
              </button>
              <span className="text-xs text-slate-400">с примерами заполнения</span>
            </div>

            <div className="border-t border-slate-100 pt-4">
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFile}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-full flex flex-col items-center justify-center gap-2 py-8 border-2 border-dashed border-slate-300 rounded-xl text-slate-500 hover:border-teal-400 hover:text-teal-600 hover:bg-teal-50/30 transition-all cursor-pointer"
              >
                <Upload size={28} className="text-slate-400" />
                <span className="text-sm font-medium">{fileName || 'Нажмите для загрузки файла .xlsx'}</span>
                {fileName && <span className="text-xs text-slate-400">Нажмите, чтобы выбрать другой файл</span>}
              </button>
            </div>

            {parsedRows.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-slate-600">
                    Найдено строк: <b>{parsedRows.length}</b>
                  </span>
                  {validRows.length > 0 && (
                    <span className="flex items-center gap-1 text-emerald-600">
                      <CheckCircle2 size={14} /> Готово к импорту: <b>{validRows.length}</b>
                    </span>
                  )}
                  {errorRows.length > 0 && (
                    <span className="flex items-center gap-1 text-rose-500">
                      <AlertCircle size={14} /> С ошибками: <b>{errorRows.length}</b>
                    </span>
                  )}
                </div>

                <div className="max-h-[300px] overflow-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-xs border-collapse" style={{ minWidth: 600 }}>
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-slate-50">
                        <th className="px-2 py-2 text-left font-semibold text-slate-500 border-b border-slate-200 w-8">#</th>
                        <th className="px-2 py-2 text-left font-semibold text-slate-500 border-b border-slate-200">Дата</th>
                        <th className="px-2 py-2 text-left font-semibold text-slate-500 border-b border-slate-200">Тип</th>
                        <th className="px-2 py-2 text-right font-semibold text-slate-500 border-b border-slate-200">Сумма</th>
                        <th className="px-2 py-2 text-left font-semibold text-slate-500 border-b border-slate-200">Счет</th>
                        <th className="px-2 py-2 text-left font-semibold text-slate-500 border-b border-slate-200">Статья</th>
                        <th className="px-2 py-2 text-left font-semibold text-slate-500 border-b border-slate-200">Статус</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedRows.map((row, i) => {
                        const hasErr = row.errors.length > 0;
                        const account = accounts.find(a => a.id === row.mapped.accountId);
                        const category = categories.find(c => c.id === row.mapped.categoryId);
                        return (
                          <tr key={i} className={hasErr ? 'bg-rose-50/50' : 'hover:bg-slate-50'}>
                            <td className="px-2 py-1.5 text-slate-400 border-b border-slate-100">{i + 1}</td>
                            <td className="px-2 py-1.5 text-slate-700 border-b border-slate-100 whitespace-nowrap">{row.mapped.date || '—'}</td>
                            <td className="px-2 py-1.5 text-slate-700 border-b border-slate-100">{row.mapped.type ? getTypeName(row.mapped.type) : '—'}</td>
                            <td className="px-2 py-1.5 text-slate-700 border-b border-slate-100 text-right tabular-nums">{row.mapped.amount || '—'}</td>
                            <td className="px-2 py-1.5 text-slate-700 border-b border-slate-100">{account?.name || '—'}</td>
                            <td className="px-2 py-1.5 text-slate-700 border-b border-slate-100">{category?.name || '—'}</td>
                            <td className="px-2 py-1.5 border-b border-slate-100">
                              {hasErr ? (
                                <span className="text-rose-500 text-[11px]" title={row.errors.join('; ')}>
                                  {row.errors[0]}
                                </span>
                              ) : (
                                <CheckCircle2 size={13} className="text-emerald-500" />
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    Отмена
                  </button>
                  <button
                    type="button"
                    onClick={handleImport}
                    disabled={validRows.length === 0 || importing}
                    className="px-5 py-2 text-sm bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium disabled:opacity-50 flex items-center gap-2 transition-colors"
                  >
                    <FileSpreadsheet size={15} />
                    {importing ? 'Импорт...' : `Импортировать ${validRows.length} операций`}
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {result && (
          <div className="space-y-4">
            {result.imported > 0 && (
              <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
                <div>
                  <div className="text-sm font-semibold text-emerald-800">
                    Импортировано: {result.imported} операций
                  </div>
                </div>
              </div>
            )}

            {result.errors.length > 0 && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg">
                <div className="text-sm font-semibold text-rose-700 mb-2">
                  Ошибки ({result.errors.length}):
                </div>
                <div className="max-h-[150px] overflow-auto space-y-1">
                  {result.errors.map((err, i) => (
                    <div key={i} className="text-xs text-rose-600">
                      Строка {err.row}: {err.error}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="px-5 py-2 text-sm bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium transition-colors"
              >
                Закрыть
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
