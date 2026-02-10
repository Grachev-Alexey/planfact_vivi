import React, { useState, useEffect } from 'react';
import { useFinance } from '../context/FinanceContext';
import { Plus, Trash2, Folder, Users, Layers, Wallet, MapPin, Search, MoreVertical } from 'lucide-react';
import { Button } from './ui/Button';
import { formatCurrency } from '../utils/format';

type TabType = 'categories' | 'contractors' | 'projects' | 'accounts' | 'studios';

interface DirectoriesProps {
  initialTab?: TabType;
}

export const Directories: React.FC<DirectoriesProps> = ({ initialTab = 'categories' }) => {
  const { 
    categories, contractors, projects, accounts, studios,
    addItem, deleteItem 
  } = useFinance();
  
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [categoryType, setCategoryType] = useState<'income' | 'expense'>('expense');
  
  // Form states
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newInn, setNewInn] = useState('');

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName) return;

    let finalData: any = { name: newName };

    if (activeTab === 'categories') {
      finalData = { ...finalData, type: categoryType };
    } else if (activeTab === 'contractors') {
      finalData = { ...finalData, inn: newInn };
    } else if (activeTab === 'accounts') {
        finalData = { ...finalData, type: 'cash', currency: 'RUB', initialBalance: 0 };
    }

    await addItem(activeTab, finalData);
    setNewName('');
    setNewInn('');
    setIsAdding(false);
  };

  const tabs = [
    { id: 'categories', label: 'Учетные статьи' },
    { id: 'contractors', label: 'Контрагенты' },
    { id: 'projects', label: 'Проекты' },
    { id: 'accounts', label: 'Мои счета' },
    { id: 'studios', label: 'Студии' },
  ];

  const renderContent = () => {
    if (activeTab === 'categories') {
        const filteredCats = categories.filter(c => c.type === categoryType);
        return (
            <div>
                <div className="flex border-b border-slate-200 mb-6">
                    <button onClick={() => setCategoryType('income')} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${categoryType === 'income' ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Доходы</button>
                    <button onClick={() => setCategoryType('expense')} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${categoryType === 'expense' ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Расходы</button>
                </div>
                
                <div className="bg-white rounded border border-slate-200 shadow-sm">
                    {filteredCats.length === 0 ? (
                        <div className="p-8 text-center text-slate-400 text-sm">Список пуст</div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                             {filteredCats.map((c, idx) => (
                                 <div key={c.id} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 group">
                                     <span className="text-sm text-slate-700">{c.name}</span>
                                     <button onClick={() => deleteItem('categories', c.id)} className="text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={16} /></button>
                                 </div>
                             ))}
                        </div>
                    )}
                </div>
            </div>
        )
    }

    if (activeTab === 'accounts') {
        return (
            <div className="bg-white rounded border border-slate-200 shadow-sm overflow-hidden overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[600px]">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 font-semibold uppercase">
                            <th className="px-6 py-3">Название</th>
                            <th className="px-6 py-3">Тип</th>
                            <th className="px-6 py-3 text-right">Текущий остаток</th>
                            <th className="px-4 py-3 w-10"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                        {accounts.length === 0 ? (
                            <tr><td colSpan={4} className="p-8 text-center text-slate-400">Нет счетов</td></tr>
                        ) : accounts.map(a => (
                            <tr key={a.id} className="hover:bg-slate-50 group">
                                <td className="px-6 py-3 font-medium text-slate-700">{a.name}</td>
                                <td className="px-6 py-3 text-slate-500">
                                    {a.type === 'card' ? 'Карта' : a.type === 'cash' ? 'Наличные' : 'Счет'}
                                </td>
                                <td className="px-6 py-3 text-right font-medium text-slate-700">{formatCurrency(a.balance)}</td>
                                <td className="px-4 py-3 text-right">
                                    <button onClick={() => deleteItem('accounts', a.id)} className="text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Trash2 size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )
    }

    // Default List for Contractors, Projects, Studios
    const items = activeTab === 'contractors' ? contractors : activeTab === 'projects' ? projects : studios;
    
    return (
         <div className="bg-white rounded border border-slate-200 shadow-sm overflow-hidden overflow-x-auto">
             <table className="w-full text-left border-collapse min-w-[600px]">
                <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 font-semibold uppercase">
                        <th className="px-6 py-3">Название</th>
                        {activeTab === 'contractors' && <th className="px-6 py-3">ИНН</th>}
                        {activeTab === 'studios' && <th className="px-6 py-3">Адрес</th>}
                        <th className="px-4 py-3 w-10"></th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                     {items.length === 0 ? (
                            <tr><td colSpan={3} className="p-8 text-center text-slate-400">Список пуст</td></tr>
                     ) : items.map((item: any) => (
                        <tr key={item.id} className="hover:bg-slate-50 group">
                            <td className="px-6 py-3 font-medium text-slate-700">{item.name}</td>
                            {activeTab === 'contractors' && <td className="px-6 py-3 text-slate-500">{item.inn || '-'}</td>}
                            {activeTab === 'studios' && <td className="px-6 py-3 text-slate-500">{item.address || '-'}</td>}
                             <td className="px-4 py-3 text-right">
                                <button onClick={() => deleteItem(activeTab as any, item.id)} className="text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Trash2 size={16} />
                                </button>
                            </td>
                        </tr>
                     ))}
                </tbody>
             </table>
         </div>
    );
  };

  return (
    <div className="flex h-[calc(100vh-56px)] bg-slate-50 flex-col">
       {/* Top Bar with Tabs */}
       <div className="px-4 md:px-8 pt-6 pb-0 flex flex-col md:flex-row md:items-center justify-between gap-4">
           <div className="flex gap-4 md:gap-8 overflow-x-auto pb-1 hide-scrollbar">
               {tabs.map(t => (
                   <button 
                    key={t.id} 
                    onClick={() => { setActiveTab(t.id as TabType); setIsAdding(false); }}
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

       {/* Add Form Area (Collapsible) */}
       {isAdding && (
           <div className="px-4 md:px-8 py-6 bg-white border-b border-slate-200 animate-in slide-in-from-top-2">
               <form onSubmit={handleAdd} className="flex flex-col md:flex-row gap-4 items-end max-w-4xl">
                   <div className="w-full md:flex-1 space-y-1">
                        <label className="text-sm font-medium text-slate-700">Название</label>
                        <input 
                            autoFocus
                            type="text" 
                            value={newName} 
                            onChange={e => setNewName(e.target.value)}
                            className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded text-sm focus:outline-none focus:border-teal-500"
                            placeholder="Введите название..."
                        />
                   </div>
                   {activeTab === 'categories' && (
                        <div className="w-full md:w-48 space-y-1">
                             <label className="text-sm font-medium text-slate-700">Тип</label>
                             <select
                                value={categoryType}
                                onChange={e => setCategoryType(e.target.value as any)}
                                className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white text-slate-900"
                                disabled
                             >
                                 <option value="income">Доход</option>
                                 <option value="expense">Расход</option>
                             </select>
                        </div>
                   )}
                   {activeTab === 'contractors' && (
                        <div className="w-full md:w-48 space-y-1">
                             <label className="text-sm font-medium text-slate-700">ИНН</label>
                             <input 
                                type="text" 
                                value={newInn} 
                                onChange={e => setNewInn(e.target.value)}
                                className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded text-sm focus:outline-none focus:border-teal-500"
                            />
                        </div>
                   )}
                   <div className="flex w-full md:w-auto gap-2">
                        <Button type="submit" className="flex-1 md:flex-none bg-teal-600 text-white">Сохранить</Button>
                        <Button type="button" variant="secondary" onClick={() => setIsAdding(false)} className="flex-1 md:flex-none">Отмена</Button>
                   </div>
               </form>
           </div>
       )}

       {/* Content Area */}
       <div className="flex-1 p-4 md:p-8 overflow-y-auto">
            {renderContent()}
       </div>
    </div>
  );
};
