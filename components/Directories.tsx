import React, { useState, useEffect, useRef } from 'react';
import { useFinance } from '../context/FinanceContext';
import { Plus, Trash2, MoreVertical, ChevronDown, ChevronRight, Edit2, X } from 'lucide-react';
import { Button } from './ui/Button';
import { formatCurrency } from '../utils/format';
import { CategoryType, Category } from '../types';

type TabType = 'categories' | 'contractors' | 'accounts' | 'studios' | 'legal_entities';

interface DirectoriesProps {
  initialTab?: TabType;
}

const categoryTabs: { id: CategoryType; label: string }[] = [
  { id: 'income', label: 'Доходы' },
  { id: 'expense', label: 'Расходы' },
];

const categoryTypeLabels: Record<CategoryType, string> = {
  income: 'Доход',
  expense: 'Расход',
};

const accountTypeLabels: Record<string, string> = {
  cash: 'Наличные',
  card: 'Карта',
  account: 'Счет',
};

function ItemMenu({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node) && btnRef.current && !btnRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.right - 160 });
    }
    setOpen(!open);
  };

  return (
    <>
      <button ref={btnRef} onClick={handleOpen} className="text-slate-400 hover:text-slate-600 p-1 rounded hover:bg-slate-100">
        <MoreVertical size={16} />
      </button>
      {open && (
        <div ref={menuRef} className="fixed bg-white border border-slate-200 rounded shadow-lg py-1 min-w-[160px]" style={{ top: pos.top, left: pos.left, zIndex: 9999 }}>
          <button onClick={() => { onEdit(); setOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2">
            <Edit2 size={14} /> Редактировать
          </button>
          <button onClick={() => { onDelete(); setOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-rose-600 hover:bg-rose-50 flex items-center gap-2">
            <Trash2 size={14} /> Удалить
          </button>
        </div>
      )}
    </>
  );
}

export const Directories: React.FC<DirectoriesProps> = ({ initialTab = 'categories' }) => {
  const {
    categories, contractors, accounts, studios, legalEntities,
    addItem, updateItem, deleteItem
  } = useFinance();

  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [categoryType, setCategoryType] = useState<CategoryType>('expense');
  const [isAdding, setIsAdding] = useState(false);
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());

  const [newName, setNewName] = useState('');
  const [newInn, setNewInn] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newParentId, setNewParentId] = useState('');
  const [newAccountType, setNewAccountType] = useState<'cash' | 'card' | 'account'>('cash');
  const [newCurrency, setNewCurrency] = useState('RUB');
  const [newInitialBalance, setNewInitialBalance] = useState('0');
  const [newAddress, setNewAddress] = useState('');
  const [newKpp, setNewKpp] = useState('');
  const [newLegalEntityId, setNewLegalEntityId] = useState('');

  const [editModal, setEditModal] = useState<{ type: TabType; item: any } | null>(null);
  const [editName, setEditName] = useState('');
  const [editInn, setEditInn] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editParentId, setEditParentId] = useState('');
  const [editAccountType, setEditAccountType] = useState<'cash' | 'card' | 'account'>('cash');
  const [editCurrency, setEditCurrency] = useState('RUB');
  const [editInitialBalance, setEditInitialBalance] = useState('0');
  const [editAddress, setEditAddress] = useState('');
  const [editKpp, setEditKpp] = useState('');
  const [editLegalEntityId, setEditLegalEntityId] = useState('');

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const resetAddForm = () => {
    setNewName('');
    setNewInn('');
    setNewDescription('');
    setNewParentId('');
    setNewAccountType('cash');
    setNewCurrency('RUB');
    setNewInitialBalance('0');
    setNewAddress('');
    setNewKpp('');
    setNewLegalEntityId('');
  };

  const openEditModal = (type: TabType, item: any) => {
    setEditModal({ type, item });
    setEditName(item.name || '');
    if (type === 'categories') {
      setEditParentId(item.parentId || '');
    } else if (type === 'contractors') {
      setEditInn(item.inn || '');
      setEditDescription(item.description || '');
    } else if (type === 'accounts') {
      setEditAccountType(item.type || 'cash');
      setEditCurrency(item.currency || 'RUB');
      setEditInitialBalance(String(item.initialBalance ?? 0));
      setEditLegalEntityId(item.legalEntityId || '');
    } else if (type === 'studios') {
      setEditAddress(item.address || '');
    } else if (type === 'legal_entities') {
      setEditInn(item.inn || '');
      setEditKpp(item.kpp || '');
      setEditAddress(item.address || '');
      setEditDescription(item.description || '');
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName) return;

    let data: any = { name: newName };

    if (activeTab === 'categories') {
      data.type = categoryType;
      if (newParentId) data.parentId = newParentId;
    } else if (activeTab === 'contractors') {
      data.inn = newInn;
      data.description = newDescription;
    } else if (activeTab === 'accounts') {
      data.type = newAccountType;
      data.currency = newCurrency;
      data.initialBalance = Number(newInitialBalance) || 0;
      if (newLegalEntityId) data.legalEntityId = Number(newLegalEntityId);
    } else if (activeTab === 'studios') {
      data.address = newAddress;
    } else if (activeTab === 'legal_entities') {
      data.inn = newInn;
      data.kpp = newKpp;
      data.address = newAddress;
      data.description = newDescription;
    }

    await addItem(activeTab, data);
    resetAddForm();
    setIsAdding(false);
  };

  const handleEditSave = async () => {
    if (!editModal || !editName) return;
    const { type, item } = editModal;

    let data: any = { name: editName };

    if (type === 'categories') {
      data.type = item.type;
      data.parentId = editParentId || null;
    } else if (type === 'contractors') {
      data.inn = editInn;
      data.description = editDescription;
    } else if (type === 'accounts') {
      data.type = editAccountType;
      data.currency = editCurrency;
      data.initialBalance = Number(editInitialBalance) || 0;
      data.legalEntityId = editLegalEntityId ? Number(editLegalEntityId) : null;
    } else if (type === 'studios') {
      data.address = editAddress;
    } else if (type === 'legal_entities') {
      data.inn = editInn;
      data.kpp = editKpp;
      data.address = editAddress;
      data.description = editDescription;
    }

    await updateItem(type, item.id, data);
    setEditModal(null);
  };

  const toggleParent = (id: string) => {
    setExpandedParents(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getLegalEntityName = (id?: string) => {
    if (!id) return '-';
    const le = legalEntities.find(l => String(l.id) === String(id));
    return le ? le.name : '-';
  };

  const tabs = [
    { id: 'categories' as TabType, label: 'Учетные статьи' },
    { id: 'contractors' as TabType, label: 'Контрагенты' },
    { id: 'accounts' as TabType, label: 'Мои счета' },
    { id: 'legal_entities' as TabType, label: 'Мои юрлица' },
    { id: 'studios' as TabType, label: 'Студии' },
  ];

  const renderAddForm = () => {
    if (activeTab === 'categories') {
      const buildParentOptions = (cats: Category[], excludeId?: string): { id: string; label: string }[] => {
        const result: { id: string; label: string }[] = [];
        const addChildren = (parentId: string | null, depth: number) => {
          const items = cats.filter(c => depth === 0 ? !c.parentId : c.parentId === parentId);
          items.forEach(item => {
            if (item.id !== excludeId) {
              result.push({ id: item.id, label: '\u00A0\u00A0'.repeat(depth) + item.name });
              addChildren(item.id, depth + 1);
            }
          });
        };
        addChildren(null, 0);
        return result;
      };
      const parentOptions = buildParentOptions(categories.filter(c => c.type === categoryType));
      return (
        <form onSubmit={handleAdd} className="flex flex-col md:flex-row gap-4 items-end max-w-4xl flex-wrap">
          <div className="w-full md:flex-1 space-y-1">
            <label className="text-sm font-medium text-slate-700">Название</label>
            <input autoFocus type="text" value={newName} onChange={e => setNewName(e.target.value)} className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded text-sm focus:outline-none focus:border-teal-500" placeholder="Введите название..." />
          </div>
          <div className="w-full md:w-48 space-y-1">
            <label className="text-sm font-medium text-slate-700">Тип</label>
            <select value={categoryType} disabled className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-slate-100 text-slate-500 cursor-not-allowed">
              {categoryTabs.map(ct => <option key={ct.id} value={ct.id}>{categoryTypeLabels[ct.id]}</option>)}
            </select>
          </div>
          <div className="w-full md:w-56 space-y-1">
            <label className="text-sm font-medium text-slate-700">Родительская статья</label>
            <select value={newParentId} onChange={e => setNewParentId(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white text-slate-900">
              <option value="">— Нет (корневая) —</option>
              {parentOptions.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </div>
          <div className="flex w-full md:w-auto gap-2">
            <Button type="submit" className="flex-1 md:flex-none bg-teal-600 text-white">Сохранить</Button>
            <Button type="button" variant="secondary" onClick={() => { setIsAdding(false); resetAddForm(); }} className="flex-1 md:flex-none">Отмена</Button>
          </div>
        </form>
      );
    }

    if (activeTab === 'contractors') {
      return (
        <form onSubmit={handleAdd} className="flex flex-col md:flex-row gap-4 items-end max-w-4xl flex-wrap">
          <div className="w-full md:flex-1 space-y-1">
            <label className="text-sm font-medium text-slate-700">Название</label>
            <input autoFocus type="text" value={newName} onChange={e => setNewName(e.target.value)} className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded text-sm focus:outline-none focus:border-teal-500" placeholder="Введите название..." />
          </div>
          <div className="w-full md:w-48 space-y-1">
            <label className="text-sm font-medium text-slate-700">ИНН</label>
            <input type="text" value={newInn} onChange={e => setNewInn(e.target.value)} className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded text-sm focus:outline-none focus:border-teal-500" />
          </div>
          <div className="w-full md:w-56 space-y-1">
            <label className="text-sm font-medium text-slate-700">Описание</label>
            <input type="text" value={newDescription} onChange={e => setNewDescription(e.target.value)} className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded text-sm focus:outline-none focus:border-teal-500" />
          </div>
          <div className="flex w-full md:w-auto gap-2">
            <Button type="submit" className="flex-1 md:flex-none bg-teal-600 text-white">Сохранить</Button>
            <Button type="button" variant="secondary" onClick={() => { setIsAdding(false); resetAddForm(); }} className="flex-1 md:flex-none">Отмена</Button>
          </div>
        </form>
      );
    }

    if (activeTab === 'accounts') {
      return (
        <form onSubmit={handleAdd} className="flex flex-col md:flex-row gap-4 items-end max-w-4xl flex-wrap">
          <div className="w-full md:flex-1 space-y-1">
            <label className="text-sm font-medium text-slate-700">Название</label>
            <input autoFocus type="text" value={newName} onChange={e => setNewName(e.target.value)} className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded text-sm focus:outline-none focus:border-teal-500" placeholder="Введите название..." />
          </div>
          <div className="w-full md:w-40 space-y-1">
            <label className="text-sm font-medium text-slate-700">Тип</label>
            <select value={newAccountType} onChange={e => setNewAccountType(e.target.value as any)} className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white text-slate-900">
              <option value="cash">Наличные</option>
              <option value="card">Карта</option>
              <option value="account">Счет</option>
            </select>
          </div>
          <div className="w-full md:w-32 space-y-1">
            <label className="text-sm font-medium text-slate-700">Валюта</label>
            <input type="text" value={newCurrency} onChange={e => setNewCurrency(e.target.value)} className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded text-sm focus:outline-none focus:border-teal-500" />
          </div>
          <div className="w-full md:w-44 space-y-1">
            <label className="text-sm font-medium text-slate-700">Начальный остаток</label>
            <input type="number" value={newInitialBalance} onChange={e => setNewInitialBalance(e.target.value)} className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded text-sm focus:outline-none focus:border-teal-500" />
          </div>
          <div className="w-full md:w-48 space-y-1">
            <label className="text-sm font-medium text-slate-700">Юрлицо</label>
            <select value={newLegalEntityId} onChange={e => setNewLegalEntityId(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white text-slate-900">
              <option value="">— Не указано —</option>
              {legalEntities.map(le => <option key={le.id} value={le.id}>{le.name}</option>)}
            </select>
          </div>
          <div className="flex w-full md:w-auto gap-2">
            <Button type="submit" className="flex-1 md:flex-none bg-teal-600 text-white">Сохранить</Button>
            <Button type="button" variant="secondary" onClick={() => { setIsAdding(false); resetAddForm(); }} className="flex-1 md:flex-none">Отмена</Button>
          </div>
        </form>
      );
    }

    if (activeTab === 'studios') {
      return (
        <form onSubmit={handleAdd} className="flex flex-col md:flex-row gap-4 items-end max-w-4xl flex-wrap">
          <div className="w-full md:flex-1 space-y-1">
            <label className="text-sm font-medium text-slate-700">Название</label>
            <input autoFocus type="text" value={newName} onChange={e => setNewName(e.target.value)} className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded text-sm focus:outline-none focus:border-teal-500" placeholder="Введите название..." />
          </div>
          <div className="w-full md:w-64 space-y-1">
            <label className="text-sm font-medium text-slate-700">Адрес</label>
            <input type="text" value={newAddress} onChange={e => setNewAddress(e.target.value)} className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded text-sm focus:outline-none focus:border-teal-500" />
          </div>
          <div className="flex w-full md:w-auto gap-2">
            <Button type="submit" className="flex-1 md:flex-none bg-teal-600 text-white">Сохранить</Button>
            <Button type="button" variant="secondary" onClick={() => { setIsAdding(false); resetAddForm(); }} className="flex-1 md:flex-none">Отмена</Button>
          </div>
        </form>
      );
    }

    if (activeTab === 'legal_entities') {
      return (
        <form onSubmit={handleAdd} className="flex flex-col md:flex-row gap-4 items-end max-w-4xl flex-wrap">
          <div className="w-full md:flex-1 space-y-1">
            <label className="text-sm font-medium text-slate-700">Название</label>
            <input autoFocus type="text" value={newName} onChange={e => setNewName(e.target.value)} className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded text-sm focus:outline-none focus:border-teal-500" placeholder="Введите название..." />
          </div>
          <div className="w-full md:w-40 space-y-1">
            <label className="text-sm font-medium text-slate-700">ИНН</label>
            <input type="text" value={newInn} onChange={e => setNewInn(e.target.value)} className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded text-sm focus:outline-none focus:border-teal-500" />
          </div>
          <div className="w-full md:w-40 space-y-1">
            <label className="text-sm font-medium text-slate-700">КПП</label>
            <input type="text" value={newKpp} onChange={e => setNewKpp(e.target.value)} className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded text-sm focus:outline-none focus:border-teal-500" />
          </div>
          <div className="w-full md:w-56 space-y-1">
            <label className="text-sm font-medium text-slate-700">Адрес</label>
            <input type="text" value={newAddress} onChange={e => setNewAddress(e.target.value)} className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded text-sm focus:outline-none focus:border-teal-500" />
          </div>
          <div className="w-full md:w-56 space-y-1">
            <label className="text-sm font-medium text-slate-700">Описание</label>
            <input type="text" value={newDescription} onChange={e => setNewDescription(e.target.value)} className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded text-sm focus:outline-none focus:border-teal-500" />
          </div>
          <div className="flex w-full md:w-auto gap-2">
            <Button type="submit" className="flex-1 md:flex-none bg-teal-600 text-white">Сохранить</Button>
            <Button type="button" variant="secondary" onClick={() => { setIsAdding(false); resetAddForm(); }} className="flex-1 md:flex-none">Отмена</Button>
          </div>
        </form>
      );
    }

    return null;
  };

  const renderEditModal = () => {
    if (!editModal) return null;
    const { type, item } = editModal;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/40" onClick={() => setEditModal(null)} />
        <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-slate-800">Редактировать</h3>
            <button onClick={() => setEditModal(null)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
          </div>

          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Название</label>
              <input type="text" value={editName} onChange={e => setEditName(e.target.value)} className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded text-sm focus:outline-none focus:border-teal-500" />
            </div>

            {type === 'categories' && (
              <>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Тип</label>
                  <select value={item.type} disabled className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-slate-100 text-slate-500 cursor-not-allowed">
                    {categoryTabs.map(ct => <option key={ct.id} value={ct.id}>{categoryTypeLabels[ct.id]}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Родительская статья</label>
                  <select value={editParentId} onChange={e => setEditParentId(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white text-slate-900">
                    <option value="">— Нет (корневая) —</option>
                    {(() => {
                      const isDescendant = (catId: string, ancestorId: string): boolean => {
                        const cat = categories.find(c => c.id === catId);
                        if (!cat || !cat.parentId) return false;
                        if (cat.parentId === ancestorId) return true;
                        return isDescendant(cat.parentId, ancestorId);
                      };
                      const opts: { id: string; label: string }[] = [];
                      const addChildren = (parentId: string | null, depth: number) => {
                        const items = categories.filter(c => c.type === item.type && (depth === 0 ? !c.parentId : c.parentId === parentId));
                        items.forEach(c => {
                          if (c.id !== item.id && !isDescendant(c.id, item.id)) {
                            opts.push({ id: c.id, label: '\u00A0\u00A0'.repeat(depth) + c.name });
                            addChildren(c.id, depth + 1);
                          }
                        });
                      };
                      addChildren(null, 0);
                      return opts.map(p => <option key={p.id} value={p.id}>{p.label}</option>);
                    })()}
                  </select>
                </div>
              </>
            )}

            {type === 'contractors' && (
              <>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">ИНН</label>
                  <input type="text" value={editInn} onChange={e => setEditInn(e.target.value)} className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded text-sm focus:outline-none focus:border-teal-500" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Описание</label>
                  <input type="text" value={editDescription} onChange={e => setEditDescription(e.target.value)} className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded text-sm focus:outline-none focus:border-teal-500" />
                </div>
              </>
            )}

            {type === 'accounts' && (
              <>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Тип</label>
                  <select value={editAccountType} onChange={e => setEditAccountType(e.target.value as any)} className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white text-slate-900">
                    <option value="cash">Наличные</option>
                    <option value="card">Карта</option>
                    <option value="account">Счет</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Валюта</label>
                  <input type="text" value={editCurrency} onChange={e => setEditCurrency(e.target.value)} className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded text-sm focus:outline-none focus:border-teal-500" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Начальный остаток</label>
                  <input type="number" value={editInitialBalance} onChange={e => setEditInitialBalance(e.target.value)} className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded text-sm focus:outline-none focus:border-teal-500" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Юрлицо</label>
                  <select value={editLegalEntityId} onChange={e => setEditLegalEntityId(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white text-slate-900">
                    <option value="">— Не указано —</option>
                    {legalEntities.map(le => <option key={le.id} value={le.id}>{le.name}</option>)}
                  </select>
                </div>
              </>
            )}

            {type === 'studios' && (
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Адрес</label>
                <input type="text" value={editAddress} onChange={e => setEditAddress(e.target.value)} className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded text-sm focus:outline-none focus:border-teal-500" />
              </div>
            )}

            {type === 'legal_entities' && (
              <>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">ИНН</label>
                  <input type="text" value={editInn} onChange={e => setEditInn(e.target.value)} className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded text-sm focus:outline-none focus:border-teal-500" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">КПП</label>
                  <input type="text" value={editKpp} onChange={e => setEditKpp(e.target.value)} className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded text-sm focus:outline-none focus:border-teal-500" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Адрес</label>
                  <input type="text" value={editAddress} onChange={e => setEditAddress(e.target.value)} className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded text-sm focus:outline-none focus:border-teal-500" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Описание</label>
                  <input type="text" value={editDescription} onChange={e => setEditDescription(e.target.value)} className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded text-sm focus:outline-none focus:border-teal-500" />
                </div>
              </>
            )}
          </div>

          <div className="flex gap-2 mt-6 justify-end">
            <Button variant="secondary" onClick={() => setEditModal(null)}>Отмена</Button>
            <Button onClick={handleEditSave} className="bg-teal-600 text-white">Сохранить</Button>
          </div>
        </div>
      </div>
    );
  };

  const renderCategoriesContent = () => {
    const filteredCats = categories.filter(c => c.type === categoryType);
    const roots = filteredCats.filter(c => !c.parentId);
    const childrenMap = new Map<string, Category[]>();
    filteredCats.filter(c => c.parentId).forEach(c => {
      const arr = childrenMap.get(c.parentId!) || [];
      arr.push(c);
      childrenMap.set(c.parentId!, arr);
    });

    const countAllDescendants = (catId: string): number => {
      const children = childrenMap.get(catId) || [];
      return children.length + children.reduce((sum, ch) => sum + countAllDescendants(ch.id), 0);
    };

    const renderCategoryNode = (cat: Category, depth: number): React.ReactNode => {
      const children = childrenMap.get(cat.id) || [];
      const isExpanded = expandedParents.has(cat.id);
      const hasChildren = children.length > 0;
      const totalDescendants = countAllDescendants(cat.id);
      const paddingLeft = 16 + depth * 28;

      return (
        <div key={cat.id}>
          <div className="flex items-center justify-between pr-4 py-2.5 hover:bg-slate-50 group border-t border-slate-50 first:border-t-0" style={{ paddingLeft }}>
            <div className="flex items-center gap-2">
              {hasChildren ? (
                <button onClick={() => toggleParent(cat.id)} className="text-slate-400 hover:text-slate-600 p-0.5">
                  {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
              ) : (
                <span className="w-5" />
              )}
              <span className={`text-sm ${depth === 0 ? 'font-medium text-slate-700' : 'text-slate-600'}`}>{cat.name}</span>
              {hasChildren && <span className="text-xs text-slate-400 ml-1">({totalDescendants})</span>}
            </div>
            <ItemMenu onEdit={() => openEditModal('categories', cat)} onDelete={() => deleteItem('categories', cat.id)} />
          </div>
          {isExpanded && children.map(child => renderCategoryNode(child, depth + 1))}
        </div>
      );
    };

    return (
      <div>
        <div className="flex border-b border-slate-200 mb-6 overflow-x-auto hide-scrollbar">
          {categoryTabs.map(ct => (
            <button key={ct.id} onClick={() => setCategoryType(ct.id)} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${categoryType === ct.id ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              {ct.label}
            </button>
          ))}
        </div>

        <div className="bg-white rounded border border-slate-200 shadow-sm">
          {roots.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">Список пуст</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {roots.map(root => renderCategoryNode(root, 0))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderAccountsContent = () => {
    return (
      <div className="bg-white rounded border border-slate-200 shadow-sm overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[700px]">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 font-semibold uppercase">
              <th className="px-6 py-3">Название</th>
              <th className="px-6 py-3">Тип</th>
              <th className="px-6 py-3">Юрлицо</th>
              <th className="px-6 py-3 text-right">Текущий остаток</th>
              <th className="px-4 py-3 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {accounts.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center text-slate-400">Нет счетов</td></tr>
            ) : accounts.map(a => (
              <tr key={a.id} className="hover:bg-slate-50 group">
                <td className="px-6 py-3 font-medium text-slate-700">{a.name}</td>
                <td className="px-6 py-3 text-slate-500">{accountTypeLabels[a.type] || a.type}</td>
                <td className="px-6 py-3 text-slate-500">{getLegalEntityName(a.legalEntityId)}</td>
                <td className="px-6 py-3 text-right font-medium text-slate-700">{formatCurrency(a.balance)}</td>
                <td className="px-4 py-3 text-right">
                  <ItemMenu onEdit={() => openEditModal('accounts', a)} onDelete={() => deleteItem('accounts', a.id)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderLegalEntitiesContent = () => {
    return (
      <div className="bg-white rounded border border-slate-200 shadow-sm overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[700px]">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 font-semibold uppercase">
              <th className="px-6 py-3">Название</th>
              <th className="px-6 py-3">ИНН</th>
              <th className="px-6 py-3">КПП</th>
              <th className="px-6 py-3">Адрес</th>
              <th className="px-6 py-3">Привязанные счета</th>
              <th className="px-4 py-3 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {legalEntities.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-slate-400">Нет юрлиц</td></tr>
            ) : legalEntities.map(le => {
              const linkedAccounts = accounts.filter(a => String(a.legalEntityId) === String(le.id));
              return (
                <tr key={le.id} className="hover:bg-slate-50 group">
                  <td className="px-6 py-3 font-medium text-slate-700">{le.name}</td>
                  <td className="px-6 py-3 text-slate-500">{le.inn || '-'}</td>
                  <td className="px-6 py-3 text-slate-500">{le.kpp || '-'}</td>
                  <td className="px-6 py-3 text-slate-500">{le.address || '-'}</td>
                  <td className="px-6 py-3 text-slate-500">
                    {linkedAccounts.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {linkedAccounts.map(acc => (
                          <span key={acc.id} className="px-2 py-0.5 bg-teal-50 text-teal-700 rounded text-xs">{acc.name}</span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <ItemMenu onEdit={() => openEditModal('legal_entities', le)} onDelete={() => deleteItem('legal_entities', le.id)} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  const renderListContent = () => {
    const items = activeTab === 'contractors' ? contractors : studios;
    return (
      <div className="bg-white rounded border border-slate-200 shadow-sm overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[600px]">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 font-semibold uppercase">
              <th className="px-6 py-3">Название</th>
              {activeTab === 'contractors' && <th className="px-6 py-3">ИНН</th>}
              {activeTab === 'contractors' && <th className="px-6 py-3">Описание</th>}
              {activeTab === 'studios' && <th className="px-6 py-3">Адрес</th>}
              <th className="px-4 py-3 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {items.length === 0 ? (
              <tr><td colSpan={activeTab === 'contractors' ? 4 : 3} className="p-8 text-center text-slate-400">Список пуст</td></tr>
            ) : items.map((item: any) => (
              <tr key={item.id} className="hover:bg-slate-50 group">
                <td className="px-6 py-3 font-medium text-slate-700">{item.name}</td>
                {activeTab === 'contractors' && <td className="px-6 py-3 text-slate-500">{item.inn || '-'}</td>}
                {activeTab === 'contractors' && <td className="px-6 py-3 text-slate-500">{item.description || '-'}</td>}
                {activeTab === 'studios' && <td className="px-6 py-3 text-slate-500">{item.address || '-'}</td>}
                <td className="px-4 py-3 text-right">
                  <ItemMenu onEdit={() => openEditModal(activeTab, item)} onDelete={() => deleteItem(activeTab as any, item.id)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderContent = () => {
    if (activeTab === 'categories') return renderCategoriesContent();
    if (activeTab === 'accounts') return renderAccountsContent();
    if (activeTab === 'legal_entities') return renderLegalEntitiesContent();
    return renderListContent();
  };

  return (
    <div className="flex h-[calc(100vh-56px)] bg-slate-50 flex-col">
      <div className="px-4 md:px-8 pt-6 pb-0 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex gap-4 md:gap-8 overflow-x-auto pb-1 hide-scrollbar">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => { setActiveTab(t.id); setIsAdding(false); resetAddForm(); }}
              className={`pb-4 text-base md:text-xl font-bold transition-colors border-b-2 px-1 whitespace-nowrap ${activeTab === t.id ? 'text-slate-800 border-teal-500' : 'text-slate-400 border-transparent hover:text-slate-600'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div>
          <Button onClick={() => setIsAdding(!isAdding)} className="w-full md:w-auto bg-teal-600 hover:bg-teal-700 text-white rounded shadow-none">
            Создать
          </Button>
        </div>
      </div>

      {isAdding && (
        <div className="px-4 md:px-8 py-6 bg-white border-b border-slate-200 animate-in slide-in-from-top-2">
          {renderAddForm()}
        </div>
      )}

      <div className="flex-1 p-4 md:p-8 overflow-y-auto">
        {renderContent()}
      </div>

      {renderEditModal()}
    </div>
  );
};
