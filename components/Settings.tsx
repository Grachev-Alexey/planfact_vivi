import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useFinance } from '../context/FinanceContext';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';
import { Users, Trash2, Shield, Activity, Clock, Plus, Search, ChevronLeft, ChevronRight, X, Filter } from 'lucide-react';
import { formatDate } from '../utils/format';

interface User {
  id: number;
  username: string;
  role: string;
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
  const [activeTab, setActiveTab] = useState<'users' | 'logs'>('users');

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

  useEffect(() => {
    fetchUsers();
  }, []);

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
           </div>
       </div>

       <div className="flex-1 p-3 sm:p-8 overflow-y-auto">
         {activeTab === 'users' ? (
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
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${u.role === 'admin' ? 'bg-teal-50 text-teal-700' : u.role === 'requester' ? 'bg-amber-50 text-amber-700' : u.role === 'master' ? 'bg-purple-50 text-purple-700' : 'bg-slate-100 text-slate-600'}`}>
                            {u.role === 'admin' ? 'Администратор' : u.role === 'requester' ? 'Запрос выплат' : u.role === 'master' ? 'Мастер' : 'Пользователь'}
                        </span>
                     </td>
                     <td className="px-6 py-3 text-sm text-slate-500">{formatDate(u.createdAt)}</td>
                     <td className="px-6 py-3 text-right">
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
                              {log.details}
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
