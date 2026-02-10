import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';
import { Users, Trash2, Shield, Activity, Clock, Plus } from 'lucide-react';
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

export const Settings: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'users' | 'logs'>('users');
  
  // Data State
  const [users, setUsers] = useState<User[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  
  // UI State
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'user' });

  useEffect(() => {
    fetchUsers();
    if (activeTab === 'logs') fetchLogs();
  }, [activeTab]);

  const fetchUsers = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/users');
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/logs');
      const data = await res.json();
      setLogs(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetch('http://localhost:3001/api/users', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'x-user-id': user?.id.toString() || '' 
        },
        body: JSON.stringify({ ...newUser, currentUserId: user?.id })
      });
      setIsAddUserOpen(false);
      setNewUser({ username: '', password: '', role: 'user' });
      fetchUsers();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteUser = async (id: number) => {
    if (!confirm('Вы уверены?')) return;
    try {
      await fetch(`http://localhost:3001/api/users/${id}`, {
        method: 'DELETE',
        headers: { 'x-user-id': user?.id.toString() || '' }
      });
      fetchUsers();
    } catch (err) {
      console.error(err);
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
        case 'create': return 'text-emerald-600 bg-emerald-50';
        case 'delete': return 'text-rose-600 bg-rose-50';
        case 'update': return 'text-blue-600 bg-blue-50';
        case 'login': return 'text-slate-600 bg-slate-100';
        default: return 'text-slate-600 bg-slate-50';
    }
  };

  return (
    <div className="flex h-[calc(100vh-56px)] bg-slate-50 flex-col">
       <div className="px-8 pt-6 pb-0 flex items-center justify-between">
           <div className="flex gap-8">
               <button 
                onClick={() => setActiveTab('users')}
                className={`pb-4 text-xl font-bold transition-colors border-b-2 px-1 ${activeTab === 'users' ? 'text-slate-800 border-teal-500' : 'text-slate-400 border-transparent hover:text-slate-600'}`}
               >
                   Пользователи
               </button>
               <button 
                onClick={() => setActiveTab('logs')}
                className={`pb-4 text-xl font-bold transition-colors border-b-2 px-1 ${activeTab === 'logs' ? 'text-slate-800 border-teal-500' : 'text-slate-400 border-transparent hover:text-slate-600'}`}
               >
                   История действий
               </button>
           </div>
       </div>

       <div className="flex-1 p-8 overflow-y-auto">
         {activeTab === 'users' ? (
           <div className="bg-white rounded border border-slate-200 shadow-sm overflow-hidden">
             <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h3 className="font-bold text-slate-700">Список пользователей</h3>
                <Button onClick={() => setIsAddUserOpen(true)} className="bg-teal-600 text-white text-xs px-3 py-1.5 gap-2">
                    <Plus size={14} /> Добавить
                </Button>
             </div>
             <table className="w-full text-left">
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
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'}`}>
                            {u.role === 'admin' ? 'Администратор' : 'Пользователь'}
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
         ) : (
           <div className="bg-white rounded border border-slate-200 shadow-sm overflow-hidden">
             <table className="w-full text-left">
               <thead className="bg-slate-50 text-xs text-slate-500 uppercase font-semibold border-b border-slate-200">
                 <tr>
                   <th className="px-6 py-3 w-48">Время</th>
                   <th className="px-6 py-3 w-40">Пользователь</th>
                   <th className="px-6 py-3 w-32">Действие</th>
                   <th className="px-6 py-3 w-32">Объект</th>
                   <th className="px-6 py-3">Детали</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-100 text-sm">
                 {logs.map(log => (
                   <tr key={log.id} className="hover:bg-slate-50">
                     <td className="px-6 py-3 text-slate-500 text-xs">
                        <div className="flex items-center gap-2">
                            <Clock size={12} />
                            {new Date(log.createdAt).toLocaleString('ru-RU')}
                        </div>
                     </td>
                     <td className="px-6 py-3 font-medium text-slate-700">{log.username || 'System'}</td>
                     <td className="px-6 py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${getActionColor(log.action)}`}>
                            {log.action}
                        </span>
                     </td>
                     <td className="px-6 py-3 text-slate-500 capitalize">{log.entityType}</td>
                     <td className="px-6 py-3 text-slate-600 truncate max-w-xs" title={log.details}>
                        {log.details}
                     </td>
                   </tr>
                 ))}
               </tbody>
             </table>
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
                     onChange={e => setNewUser({...newUser, role: e.target.value})}
                   >
                       <option value="user">Пользователь</option>
                       <option value="admin">Администратор</option>
                   </select>
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