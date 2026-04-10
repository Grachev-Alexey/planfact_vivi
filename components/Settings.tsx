import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useFinance } from '../context/FinanceContext';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';
import { Users, Trash2, Activity, Clock, Plus, Search, ChevronLeft, ChevronRight, X, ToggleLeft, ToggleRight, ArrowUp, ArrowDown, Settings2, Check, Loader2, RefreshCw, Pencil } from 'lucide-react';
import { formatDate } from '../utils/format';
import { RulesSettings } from './RulesSettings';

interface YcField {
  id: string;
  label: string;
  ycFieldId: string;
  ycFieldCode?: string;
  target: 'record' | 'client';
  enabled: boolean;
  editable: boolean;
}

interface YcApiField {
  id: number;
  name: string;
  code?: string;
  field_type?: string;
  required?: boolean;
}

interface YcAvailableFields {
  record: YcApiField[];
  client: YcApiField[];
}

interface YcFormConfig {
  commentEnabled: boolean;
  commentEditable: boolean;
  fields: YcField[];
}

interface User {
  id: number;
  username: string;
  role: string;
  studioId?: number | null;
  createdAt: string;
}

interface Log {
  id: number;
  username: string;
  action: string;
  entityType: string;
  details: string;
  createdAt: string;
}

const formatLogDetails = (details: string): string => {
  if (!details) return '';
  try {
    // Попытаемся распарсить JSON
    const parsed = JSON.parse(details);
    if (typeof parsed === 'object' && parsed !== null) {
      // Если это объект с данными, форматируем красиво
      const parts: string[] = [];
      if (parsed.amount) parts.push(`сумма: ${parsed.amount}`);
      if (parsed.paymentType) parts.push(`тип оплаты: ${parsed.paymentType}`);
      if (parsed.clientName) parts.push(`клиент: ${parsed.clientName}`);
      if (parsed.name) parts.push(`${parsed.name}`);
      if (parts.length > 0) return parts.join(', ');
    }
  } catch (e) {
    // Если это не JSON, возвращаем как есть
  }
  return details;
};

const actionOptions = [
  { value: '', label: 'Все действия' },
  { value: 'Создание', label: 'Создание' },
  { value: 'Изменение', label: 'Изменение' },
  { value: 'Удаление', label: 'Удаление' },
];

const entityOptions = [
  { value: '', label: 'Все объекты' },
  { value: 'Операция', label: 'Операции' },
  { value: 'Статья', label: 'Статьи' },
  { value: 'Контрагент', label: 'Контрагенты' },
  { value: 'Счет', label: 'Счета' },
  { value: 'Студия', label: 'Студии' },
  { value: 'Юрлицо', label: 'Юрлица' },
  { value: 'Пользователь', label: 'Пользователи' },
];

export const Settings: React.FC = () => {
  const { user } = useAuth();
  const { studios } = useFinance();
  const [activeTab, setActiveTab] = useState<'users' | 'logs' | 'yclients' | 'rules'>('users');

  const [ycConfig, setYcConfig] = useState<YcFormConfig>({ commentEnabled: false, commentEditable: false, fields: [] });
  const [ycSaving, setYcSaving] = useState(false);
  const [ycSaved, setYcSaved] = useState(false);
  const [newField, setNewField] = useState<Partial<YcField>>({ label: '', ycFieldId: '', target: 'record', enabled: true, editable: true });
  const [ycAvailable, setYcAvailable] = useState<YcAvailableFields | null>(null);
  const [ycAvailableLoading, setYcAvailableLoading] = useState(false);
  const [ycPickerTab, setYcPickerTab] = useState<'record' | 'client'>('record');

  const [users, setUsers] = useState<User[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [totalLogs, setTotalLogs] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const logsPerPage = 50;

  const [filterAction, setFilterAction] = useState('');
  const [filterEntity, setFilterEntity] = useState('');
  const [filterUsername, setFilterUsername] = useState('');
  const [searchText, setSearchText] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'user', studioId: '' });
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editUser, setEditUser] = useState({ username: '', password: '', role: 'user', studioId: '' });

  useEffect(() => {
    fetchUsers();
    fetchYcConfig();
  }, []);

  useEffect(() => {
    if (activeTab === 'yclients' && !ycAvailable && !ycAvailableLoading) {
      fetchAvailableFields();
    }
  }, [activeTab]);

  const fetchYcConfig = async () => {
    try {
      const res = await fetch('/api/yclients/form-settings');
      const data = await res.json();
      setYcConfig(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAvailableFields = async () => {
    setYcAvailableLoading(true);
    try {
      const res = await fetch('/api/yclients/available-fields', { headers: { 'x-user-id': user?.id.toString() || '' } });
      if (res.ok) {
        const data = await res.json();
        setYcAvailable(data);
      }
    } catch (err) {
      console.error('fetchAvailableFields error:', err);
    }
    setYcAvailableLoading(false);
  };

  const addFieldFromApi = (apiField: YcApiField, target: 'record' | 'client') => {
    const alreadyAdded = ycConfig.fields.some(f => f.ycFieldId === String(apiField.id) && f.target === target);
    if (alreadyAdded) return;
    const field: YcField = {
      id: Date.now().toString(),
      label: apiField.name,
      ycFieldId: String(apiField.id),
      ycFieldCode: apiField.code || undefined,
      target,
      enabled: true,
      editable: true,
    };
    setYcConfig(c => ({ ...c, fields: [...c.fields, field] }));
  };

  const saveYcConfig = async () => {
    setYcSaving(true);
    try {
      await fetch('/api/yclients/form-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-user-id': user?.id.toString() || '' },
        body: JSON.stringify(ycConfig),
      });
      setYcSaved(true);
      setTimeout(() => setYcSaved(false), 2000);
    } catch (err) {
      console.error(err);
    }
    setYcSaving(false);
  };

  const addYcField = () => {
    if (!newField.label?.trim()) return;
    const field: YcField = {
      id: Date.now().toString(),
      label: newField.label!.trim(),
      ycFieldId: newField.ycFieldId?.trim() || '',
      target: newField.target as 'record' | 'client',
      enabled: true,
      editable: newField.editable ?? true,
    };
    setYcConfig(c => ({ ...c, fields: [...c.fields, field] }));
    setNewField({ label: '', ycFieldId: '', target: 'record', enabled: true, editable: true });
  };

  const removeYcField = (id: string) => {
    setYcConfig(c => ({ ...c, fields: c.fields.filter(f => f.id !== id) }));
  };

  const updateYcField = (id: string, patch: Partial<YcField>) => {
    setYcConfig(c => ({ ...c, fields: c.fields.map(f => f.id === id ? { ...f, ...patch } : f) }));
  };

  const moveYcField = (id: string, dir: -1 | 1) => {
    setYcConfig(c => {
      const fields = [...c.fields];
      const idx = fields.findIndex(f => f.id === id);
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= fields.length) return c;
      [fields[idx], fields[newIdx]] = [fields[newIdx], fields[idx]];
      return { ...c, fields };
    });
  };

  const fetchLogs = useCallback(async (page = 1) => {
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(logsPerPage));
      if (filterAction) params.set('action', filterAction);
      if (filterEntity) params.set('entityType', filterEntity);
      if (filterUsername) params.set('username', filterUsername);
      if (searchText) params.set('search', searchText);

      const res = await fetch(`/api/logs?${params.toString()}`);
      const data = await res.json();
      setLogs(data.logs || []);
      setTotalLogs(data.total || 0);
      setTotalPages(data.totalPages || 1);
      setCurrentPage(data.page || 1);
    } catch (err) {
      console.error(err);
    }
  }, [filterAction, filterEntity, filterUsername, searchText]);

  useEffect(() => {
    if (activeTab === 'logs') {
      fetchLogs(1);
    }
  }, [activeTab, filterAction, filterEntity, filterUsername, searchText]);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user?.id.toString() || ''
        },
        body: JSON.stringify({ ...newUser, currentUserId: user?.id })
      });
      setIsAddUserOpen(false);
      setNewUser({ username: '', password: '', role: 'user', studioId: '' });
      fetchUsers();
    } catch (err) {
      console.error(err);
    }
  };

  const openEditUser = (u: User) => {
    setEditingUser(u);
    setEditUser({ username: u.username, password: '', role: u.role, studioId: u.studioId ? String(u.studioId) : '' });
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    try {
      await fetch(`/api/users/${editingUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user?.id.toString() || ''
        },
        body: JSON.stringify(editUser)
      });
      setEditingUser(null);
      fetchUsers();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteUser = async (id: number) => {
    if (!confirm('Вы уверены?')) return;
    try {
      await fetch(`/api/users/${id}`, {
        method: 'DELETE',
        headers: { 'x-user-id': user?.id.toString() || '' }
      });
      fetchUsers();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchText(searchInput);
  };

  const clearFilters = () => {
    setFilterAction('');
    setFilterEntity('');
    setFilterUsername('');
    setSearchText('');
    setSearchInput('');
  };

  const hasFilters = filterAction || filterEntity || filterUsername || searchText;

  const getActionColor = (action: string) => {
    const a = action.toLowerCase();
    if (a === 'создание' || a === 'create') return 'text-emerald-600 bg-emerald-50';
    if (a === 'удаление' || a === 'delete') return 'text-rose-600 bg-rose-50';
    if (a === 'изменение' || a === 'update') return 'text-blue-600 bg-blue-50';
    return 'text-slate-600 bg-slate-50';
  };

  const uniqueUsernames = [...new Set(logs.map(l => l.username).filter(Boolean))];

  return (
    <div className="flex h-[calc(100vh-56px)] bg-slate-50 flex-col">
       <div className="px-3 sm:px-8 pt-4 sm:pt-6 pb-0 flex items-center justify-between">
           <div className="flex gap-4 sm:gap-8">
               <button
                onClick={() => setActiveTab('users')}
                className={`pb-3 sm:pb-4 text-base sm:text-xl font-bold transition-colors border-b-2 px-1 ${activeTab === 'users' ? 'text-slate-800 border-teal-500' : 'text-slate-400 border-transparent hover:text-slate-600'}`}
               >
                   Пользователи
               </button>
               <button
                onClick={() => setActiveTab('logs')}
                className={`pb-3 sm:pb-4 text-base sm:text-xl font-bold transition-colors border-b-2 px-1 ${activeTab === 'logs' ? 'text-slate-800 border-teal-500' : 'text-slate-400 border-transparent hover:text-slate-600'}`}
               >
                   История
               </button>
               <button
                onClick={() => setActiveTab('yclients')}
                className={`pb-3 sm:pb-4 text-base sm:text-xl font-bold transition-colors border-b-2 px-1 ${activeTab === 'yclients' ? 'text-slate-800 border-teal-500' : 'text-slate-400 border-transparent hover:text-slate-600'}`}
               >
                   YClients
               </button>
               <button
                onClick={() => setActiveTab('rules')}
                className={`pb-3 sm:pb-4 text-base sm:text-xl font-bold transition-colors border-b-2 px-1 ${activeTab === 'rules' ? 'text-slate-800 border-teal-500' : 'text-slate-400 border-transparent hover:text-slate-600'}`}
               >
                   Правила
               </button>
           </div>
       </div>

       <div className="flex-1 p-3 sm:p-8 overflow-y-auto">
         {activeTab === 'rules' ? (
           <div className="max-w-4xl">
             <RulesSettings />
           </div>
         ) : activeTab === 'yclients' ? (
           <div className="max-w-2xl space-y-5">
             <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
               <div className="px-5 py-4 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
                 <Settings2 size={16} className="text-teal-600" />
                 <h3 className="font-bold text-slate-700">Комментарий к записи YClients</h3>
               </div>
               <div className="px-5 py-4 space-y-3">
                 <label className="flex items-center justify-between gap-4 cursor-pointer group">
                   <div>
                     <div className="text-sm font-medium text-slate-700">Показывать мастеру</div>
                     <div className="text-xs text-slate-400 mt-0.5">Мастер увидит текущий комментарий из YClients при выборе визита</div>
                   </div>
                   <button
                     onClick={() => setYcConfig(c => ({ ...c, commentEnabled: !c.commentEnabled, commentEditable: !c.commentEnabled ? c.commentEditable : false }))}
                     className="shrink-0"
                   >
                     {ycConfig.commentEnabled
                       ? <ToggleRight size={32} className="text-teal-500" />
                       : <ToggleLeft size={32} className="text-slate-300" />}
                   </button>
                 </label>
                 {ycConfig.commentEnabled && (
                   <label className="flex items-center justify-between gap-4 cursor-pointer pl-4 border-l-2 border-slate-100">
                     <div>
                       <div className="text-sm font-medium text-slate-700">Разрешить редактирование</div>
                       <div className="text-xs text-slate-400 mt-0.5">Мастер сможет изменить комментарий — изменение сохранится в YClients</div>
                     </div>
                     <button onClick={() => setYcConfig(c => ({ ...c, commentEditable: !c.commentEditable }))} className="shrink-0">
                       {ycConfig.commentEditable
                         ? <ToggleRight size={32} className="text-teal-500" />
                         : <ToggleLeft size={32} className="text-slate-300" />}
                     </button>
                   </label>
                 )}
               </div>
             </div>

             <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
               <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
                 <h3 className="font-bold text-slate-700">Дополнительные поля</h3>
                 <p className="text-xs text-slate-400 mt-1">Поля из YClients, которые мастер будет видеть и заполнять при вводе поступления. Укажите числовой ID поля из YClients.</p>
               </div>
               <div className="divide-y divide-slate-100">
                 {ycConfig.fields.length === 0 && (
                   <div className="px-5 py-6 text-center text-slate-400 text-sm">Полей пока нет</div>
                 )}
                 {ycConfig.fields.map((f, idx) => (
                   <div key={f.id} className="px-4 py-3 flex items-center gap-3">
                     <div className="flex flex-col gap-0.5 shrink-0">
                       <button onClick={() => moveYcField(f.id, -1)} disabled={idx === 0} className="text-slate-300 hover:text-slate-500 disabled:opacity-30"><ArrowUp size={13} /></button>
                       <button onClick={() => moveYcField(f.id, 1)} disabled={idx === ycConfig.fields.length - 1} className="text-slate-300 hover:text-slate-500 disabled:opacity-30"><ArrowDown size={13} /></button>
                     </div>
                     <div className="flex-1 grid grid-cols-2 gap-2">
                       <input
                         value={f.label}
                         onChange={e => updateYcField(f.id, { label: e.target.value })}
                         className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-sm"
                         placeholder="Название поля"
                       />
                       <input
                         value={f.ycFieldId}
                         onChange={e => updateYcField(f.id, { ycFieldId: e.target.value })}
                         className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-sm font-mono"
                         placeholder="ID поля YClients"
                       />
                     </div>
                     <select
                       value={f.target}
                       onChange={e => updateYcField(f.id, { target: e.target.value as 'record' | 'client' })}
                       className="px-2 py-1.5 border border-slate-300 rounded-lg text-xs bg-white text-slate-700 shrink-0"
                     >
                       <option value="record">Запись</option>
                       <option value="client">Клиент</option>
                     </select>
                     <div className="flex items-center gap-2 shrink-0">
                       <div className="flex flex-col items-center gap-0.5">
                         <span className="text-[9px] text-slate-400 uppercase tracking-wide">Показ</span>
                         <button onClick={() => updateYcField(f.id, { enabled: !f.enabled })}>
                           {f.enabled ? <ToggleRight size={22} className="text-teal-500" /> : <ToggleLeft size={22} className="text-slate-300" />}
                         </button>
                       </div>
                       <div className="flex flex-col items-center gap-0.5">
                         <span className="text-[9px] text-slate-400 uppercase tracking-wide">Ред.</span>
                         <button onClick={() => updateYcField(f.id, { editable: !f.editable })}>
                           {f.editable ? <ToggleRight size={22} className="text-teal-500" /> : <ToggleLeft size={22} className="text-slate-300" />}
                         </button>
                       </div>
                     </div>
                     <button onClick={() => removeYcField(f.id)} className="text-slate-300 hover:text-rose-500 transition-colors shrink-0">
                       <X size={16} />
                     </button>
                   </div>
                 ))}
               </div>
               <div className="border-t border-slate-200">
                <div className="px-4 pt-3 pb-2 flex items-center justify-between gap-3">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Добавить поле из YClients</div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setYcPickerTab('record')}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${ycPickerTab === 'record' ? 'bg-teal-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
                    >Запись</button>
                    <button
                      onClick={() => setYcPickerTab('client')}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${ycPickerTab === 'client' ? 'bg-teal-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
                    >Клиент</button>
                    <button
                      onClick={fetchAvailableFields}
                      disabled={ycAvailableLoading}
                      className="ml-1 p-1 text-slate-400 hover:text-slate-600 transition-colors"
                      title="Обновить список"
                    >
                      {ycAvailableLoading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                    </button>
                  </div>
                </div>
                <div className="px-4 pb-3">
                  {ycAvailableLoading && !ycAvailable ? (
                    <div className="text-center py-4 text-xs text-slate-400 flex items-center justify-center gap-2">
                      <Loader2 size={14} className="animate-spin" /> Загружаем поля из YClients...
                    </div>
                  ) : ycAvailable ? (
                    (() => {
                      const list = ycAvailable[ycPickerTab] || [];
                      if (list.length === 0) {
                        return <div className="text-center py-3 text-xs text-slate-400">Нет доступных полей для {ycPickerTab === 'record' ? 'записей' : 'клиентов'}</div>;
                      }
                      return (
                        <div className="flex flex-wrap gap-2">
                          {list.map(apiField => {
                            const added = ycConfig.fields.some(f => f.ycFieldId === String(apiField.id) && f.target === ycPickerTab);
                            return (
                              <button
                                key={apiField.id}
                                onClick={() => addFieldFromApi(apiField, ycPickerTab)}
                                disabled={added}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                                  added
                                    ? 'bg-teal-50 border-teal-200 text-teal-600 cursor-default'
                                    : 'bg-white border-slate-200 text-slate-700 hover:border-teal-400 hover:bg-teal-50 hover:text-teal-700'
                                }`}
                              >
                                {added ? <Check size={11} /> : <Plus size={11} />}
                                {apiField.name}
                              </button>
                            );
                          })}
                        </div>
                      );
                    })()
                  ) : (
                    <div className="text-center py-3 text-xs text-slate-400">Не удалось загрузить поля</div>
                  )}
                </div>
                <div className="px-4 pb-3 border-t border-slate-100 pt-3">
                  <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Или добавить вручную</div>
                  <div className="flex items-center gap-2">
                    <input
                      value={newField.label || ''}
                      onChange={e => setNewField(f => ({ ...f, label: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && addYcField()}
                      className="flex-1 px-2.5 py-1.5 border border-slate-300 rounded-lg text-sm"
                      placeholder="Название поля"
                    />
                    <input
                      value={newField.ycFieldId || ''}
                      onChange={e => setNewField(f => ({ ...f, ycFieldId: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && addYcField()}
                      className="w-28 px-2.5 py-1.5 border border-slate-300 rounded-lg text-sm font-mono"
                      placeholder="ID поля"
                    />
                    <select
                      value={newField.target || 'record'}
                      onChange={e => setNewField(f => ({ ...f, target: e.target.value as 'record' | 'client' }))}
                      className="px-2 py-1.5 border border-slate-300 rounded-lg text-xs bg-white text-slate-700"
                    >
                      <option value="record">Запись</option>
                      <option value="client">Клиент</option>
                    </select>
                    <Button
                      onClick={addYcField}
                      className="bg-slate-600 text-white text-xs px-3 py-1.5 gap-1.5 shrink-0"
                      disabled={!newField.label?.trim()}
                    >
                      <Plus size={14} /> Добавить
                    </Button>
                  </div>
                </div>
              </div>
             </div>

             <div className="flex justify-end">
               <Button
                 onClick={saveYcConfig}
                 disabled={ycSaving}
                 className={`px-6 py-2.5 font-semibold text-sm gap-2 ${ycSaved ? 'bg-emerald-600' : 'bg-teal-600'} text-white`}
               >
                 {ycSaved ? '✓ Сохранено' : ycSaving ? 'Сохраняем...' : 'Сохранить настройки'}
               </Button>
             </div>
           </div>
         ) : activeTab === 'users' ? (
           <div className="bg-white rounded border border-slate-200 shadow-sm overflow-hidden">
             <div className="p-3 sm:p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h3 className="font-bold text-sm sm:text-base text-slate-700">Список пользователей</h3>
                <Button onClick={() => setIsAddUserOpen(true)} className="bg-teal-600 text-white text-xs px-3 py-1.5 gap-2">
                    <Plus size={14} /> Добавить
                </Button>
             </div>
             <div className="overflow-x-auto">
             <table className="w-full text-left min-w-[500px]">
               <thead className="bg-white text-xs text-slate-400 uppercase font-semibold border-b border-slate-100">
                 <tr>
                   <th className="px-6 py-3">Пользователь</th>
                   <th className="px-6 py-3">Роль</th>
                   <th className="px-6 py-3">Дата создания</th>
                   <th className="px-6 py-3 text-right">Действия</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-50">
                 {users.map(u => (
                   <tr key={u.id} className="hover:bg-slate-50">
                     <td className="px-6 py-3 font-medium text-slate-700 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold text-xs">
                            {u.username[0].toUpperCase()}
                        </div>
                        {u.username}
                     </td>
                     <td className="px-6 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${u.role === 'admin' ? 'bg-teal-50 text-teal-700' : u.role === 'requester' ? 'bg-amber-50 text-amber-700' : u.role === 'master' ? 'bg-purple-50 text-purple-700' : u.role === 'payout_controller' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                            {u.role === 'admin' ? 'Администратор' : u.role === 'requester' ? 'Запрос выплат' : u.role === 'master' ? 'Мастер' : u.role === 'payout_controller' ? 'Контроль выплат' : 'Пользователь'}
                        </span>
                        {u.role === 'master' && u.studioId && (
                          <span className="ml-1.5 text-xs text-slate-400">{studios.find(s => String(s.id) === String(u.studioId))?.name || ''}</span>
                        )}
                     </td>
                     <td className="px-6 py-3 text-sm text-slate-500">{formatDate(u.createdAt)}</td>
                     <td className="px-6 py-3 text-right flex items-center justify-end gap-2">
                       <button onClick={() => openEditUser(u)} className="text-slate-300 hover:text-teal-600 transition-colors">
                         <Pencil size={15} />
                       </button>
                       {u.username !== 'admin' && (
                         <button onClick={() => handleDeleteUser(u.id)} className="text-slate-300 hover:text-rose-500 transition-colors">
                           <Trash2 size={16} />
                         </button>
                       )}
                     </td>
                   </tr>
                 ))}
               </tbody>
             </table>
             </div>
           </div>
         ) : (
           <div>
             <div className="mb-4 flex flex-col md:flex-row gap-3 items-start md:items-center flex-wrap">
               <form onSubmit={handleSearch} className="relative flex-1 min-w-[200px] max-w-md">
                 <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                 <input
                   type="text"
                   value={searchInput}
                   onChange={e => setSearchInput(e.target.value)}
                   placeholder="Поиск по деталям..."
                   className="w-full pl-10 pr-3 py-2 text-sm border border-slate-300 rounded bg-white text-slate-900 focus:outline-none focus:border-teal-500"
                 />
               </form>

               <select value={filterAction} onChange={e => setFilterAction(e.target.value)} className="px-3 py-2 text-sm border border-slate-300 rounded bg-white text-slate-700">
                 {actionOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
               </select>

               <select value={filterEntity} onChange={e => setFilterEntity(e.target.value)} className="px-3 py-2 text-sm border border-slate-300 rounded bg-white text-slate-700">
                 {entityOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
               </select>

               <select value={filterUsername} onChange={e => setFilterUsername(e.target.value)} className="px-3 py-2 text-sm border border-slate-300 rounded bg-white text-slate-700">
                 <option value="">Все пользователи</option>
                 {users.map(u => <option key={u.id} value={u.username}>{u.username}</option>)}
               </select>

               {hasFilters && (
                 <button onClick={clearFilters} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 px-2 py-2">
                   <X size={14} /> Сбросить
                 </button>
               )}

               <div className="text-sm text-slate-400 ml-auto">
                 Найдено: {totalLogs}
               </div>
             </div>

             <div className="bg-white rounded border border-slate-200 shadow-sm overflow-hidden">
               <div className="overflow-x-auto">
               <table className="w-full text-left min-w-[600px]">
                 <thead className="bg-slate-50 text-xs text-slate-500 uppercase font-semibold border-b border-slate-200">
                   <tr>
                     <th className="px-3 sm:px-6 py-3 w-48">Время</th>
                     <th className="px-3 sm:px-6 py-3 w-40">Пользователь</th>
                     <th className="px-3 sm:px-6 py-3 w-32">Действие</th>
                     <th className="px-3 sm:px-6 py-3 w-32">Объект</th>
                     <th className="px-3 sm:px-6 py-3">Детали</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100 text-sm">
                   {logs.length === 0 ? (
                     <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-400">Нет записей</td></tr>
                   ) : logs.map(log => (
                     <tr key={log.id} className="hover:bg-slate-50">
                       <td className="px-6 py-3 text-slate-500 text-xs">
                          <div className="flex items-center gap-2">
                              <Clock size={12} />
                              {new Date(log.createdAt).toLocaleString('ru-RU')}
                          </div>
                       </td>
                       <td className="px-6 py-3 font-medium text-slate-700">{log.username || 'Система'}</td>
                       <td className="px-6 py-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${getActionColor(log.action)}`}>
                              {log.action}
                          </span>
                       </td>
                       <td className="px-6 py-3 text-slate-500">{log.entityType}</td>
                       <td className="px-6 py-3 text-slate-600">
                          <div className="max-w-md" title={log.details}>
                              {formatLogDetails(log.details)}
                          </div>
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
               </div>
             </div>

             {totalPages > 1 && (
               <div className="flex items-center justify-between mt-4">
                 <div className="text-sm text-slate-500">
                   Страница {currentPage} из {totalPages}
                 </div>
                 <div className="flex items-center gap-2">
                   <button
                     onClick={() => fetchLogs(currentPage - 1)}
                     disabled={currentPage <= 1}
                     className="flex items-center gap-1 px-3 py-1.5 text-sm border border-slate-300 rounded bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                   >
                     <ChevronLeft size={14} /> Назад
                   </button>
                   {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                     let page: number;
                     if (totalPages <= 7) {
                       page = i + 1;
                     } else if (currentPage <= 4) {
                       page = i + 1;
                     } else if (currentPage >= totalPages - 3) {
                       page = totalPages - 6 + i;
                     } else {
                       page = currentPage - 3 + i;
                     }
                     return (
                       <button
                         key={page}
                         onClick={() => fetchLogs(page)}
                         className={`w-8 h-8 text-sm rounded ${page === currentPage ? 'bg-teal-600 text-white' : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'}`}
                       >
                         {page}
                       </button>
                     );
                   })}
                   <button
                     onClick={() => fetchLogs(currentPage + 1)}
                     disabled={currentPage >= totalPages}
                     className="flex items-center gap-1 px-3 py-1.5 text-sm border border-slate-300 rounded bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                   >
                     Вперед <ChevronRight size={14} />
                   </button>
                 </div>
               </div>
             )}
           </div>
         )}
       </div>

       <Modal isOpen={!!editingUser} onClose={() => setEditingUser(null)} title="Редактировать пользователя">
           <form onSubmit={handleEditUser} className="space-y-4">
               <div>
                   <label className="block text-sm font-bold text-slate-500 mb-1">Имя пользователя</label>
                   <input
                     type="text"
                     className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                     value={editUser.username}
                     onChange={e => setEditUser({...editUser, username: e.target.value})}
                     required
                   />
               </div>
               <div>
                   <label className="block text-sm font-bold text-slate-500 mb-1">Новый пароль</label>
                   <input
                     type="password"
                     className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                     value={editUser.password}
                     onChange={e => setEditUser({...editUser, password: e.target.value})}
                     placeholder="Оставьте пустым, чтобы не менять"
                   />
               </div>
               <div>
                   <label className="block text-sm font-bold text-slate-500 mb-1">Роль</label>
                   <select
                     className="w-full border border-slate-300 rounded px-3 py-2 text-sm bg-white"
                     value={editUser.role}
                     onChange={e => setEditUser({...editUser, role: e.target.value, studioId: ''})}
                   >
                       <option value="user">Пользователь</option>
                       <option value="admin">Администратор</option>
                       <option value="requester">Запрос выплат</option>
                       <option value="master">Мастер</option>
                       <option value="payout_controller">Контроль выплат</option>
                   </select>
                   {editUser.role === 'master' && (
                     <div className="mt-3">
                       <label className="block text-sm font-bold text-slate-500 mb-1">Студия</label>
                       <select
                         className="w-full border border-slate-300 rounded px-3 py-2 text-sm bg-white"
                         value={editUser.studioId}
                         onChange={e => setEditUser({...editUser, studioId: e.target.value})}
                       >
                         <option value="">Выберите студию</option>
                         {studios.map(s => (
                           <option key={s.id} value={s.id}>{s.name}</option>
                         ))}
                       </select>
                     </div>
                   )}
               </div>
               <div className="pt-4 flex justify-end gap-3">
                   <Button type="button" variant="secondary" onClick={() => setEditingUser(null)}>Отмена</Button>
                   <Button type="submit" className="bg-teal-600 text-white">Сохранить</Button>
               </div>
           </form>
       </Modal>

       <Modal isOpen={isAddUserOpen} onClose={() => setIsAddUserOpen(false)} title="Новый пользователь">
           <form onSubmit={handleCreateUser} className="space-y-4">
               <div>
                   <label className="block text-sm font-bold text-slate-500 mb-1">Имя пользователя</label>
                   <input
                     type="text"
                     className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                     value={newUser.username}
                     onChange={e => setNewUser({...newUser, username: e.target.value})}
                     required
                   />
               </div>
               <div>
                   <label className="block text-sm font-bold text-slate-500 mb-1">Пароль</label>
                   <input
                     type="password"
                     className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                     value={newUser.password}
                     onChange={e => setNewUser({...newUser, password: e.target.value})}
                     required
                   />
               </div>
               <div>
                   <label className="block text-sm font-bold text-slate-500 mb-1">Роль</label>
                   <select
                     className="w-full border border-slate-300 rounded px-3 py-2 text-sm bg-white"
                     value={newUser.role}
                     onChange={e => setNewUser({...newUser, role: e.target.value, studioId: ''})}
                   >
                       <option value="user">Пользователь</option>
                       <option value="admin">Администратор</option>
                       <option value="requester">Запрос выплат</option>
                       <option value="master">Мастер</option>
                       <option value="payout_controller">Контроль выплат</option>
                   </select>
                   {newUser.role === 'master' && (
                     <div className="mt-3">
                       <label className="block text-sm font-bold text-slate-500 mb-1">Студия</label>
                       <select
                         className="w-full border border-slate-300 rounded px-3 py-2 text-sm bg-white"
                         value={newUser.studioId}
                         onChange={e => setNewUser({...newUser, studioId: e.target.value})}
                       >
                         <option value="">Выберите студию</option>
                         {studios.map(s => (
                           <option key={s.id} value={s.id}>{s.name}</option>
                         ))}
                       </select>
                     </div>
                   )}
               </div>
               <div className="pt-4 flex justify-end gap-3">
                   <Button type="button" variant="secondary" onClick={() => setIsAddUserOpen(false)}>Отмена</Button>
                   <Button type="submit" className="bg-teal-600 text-white">Создать</Button>
               </div>
           </form>
       </Modal>
    </div>
  );
};
