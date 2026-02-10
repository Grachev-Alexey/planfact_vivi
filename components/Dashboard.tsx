import React from 'react';
import { useFinance } from '../context/FinanceContext';
import { formatCurrency } from '../utils/format';
import { ArrowUpRight, ArrowDownRight, Wallet, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export const Dashboard: React.FC = () => {
  const { transactions, getTotalBalance, studios } = useFinance();

  // Basic Stats for current month
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  
  const currentMonthTx = transactions.filter(t => {
    const d = new Date(t.date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  const income = currentMonthTx.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const expense = currentMonthTx.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const profit = income - expense;

  // Chart Data Preparation (Last 6 months)
  const chartData = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const monthKey = d.toLocaleString('ru-RU', { month: 'short' });
    
    const monthTx = transactions.filter(t => {
      const td = new Date(t.date);
      return td.getMonth() === d.getMonth() && td.getFullYear() === d.getFullYear();
    });
    
    const mIncome = monthTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const mExpense = monthTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    
    chartData.push({
      name: monthKey,
      income: mIncome,
      expense: mExpense,
      profit: mIncome - mExpense
    });
  }

  // Profit by Studio (Current Month)
  const studioStats = studios.map(studio => {
    const sTxs = currentMonthTx.filter(t => t.studioId === studio.id);
    const sIncome = sTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const sExpense = sTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    return { ...studio, profit: sIncome - sExpense };
  });

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Сводка</h1>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Month Stats */}
        <div className="flex-1 grid grid-cols-2 gap-4">
          <div className="bg-white p-6 rounded shadow-sm border border-slate-200">
            <div className="flex items-center gap-2 text-slate-500 mb-2 text-sm font-medium">
              <div className="p-1.5 bg-emerald-50 rounded-full text-emerald-600">
                <ArrowUpRight size={16} />
              </div>
              Доход (мес)
            </div>
            <div className="text-2xl font-bold text-slate-800">{formatCurrency(income)}</div>
          </div>
          <div className="bg-white p-6 rounded shadow-sm border border-slate-200">
            <div className="flex items-center gap-2 text-slate-500 mb-2 text-sm font-medium">
              <div className="p-1.5 bg-rose-50 rounded-full text-rose-600">
                <ArrowDownRight size={16} />
              </div>
              Расход (мес)
            </div>
            <div className="text-2xl font-bold text-slate-800">{formatCurrency(expense)}</div>
          </div>
          <div className="col-span-2 bg-white p-6 rounded shadow-sm border border-slate-200">
             <div className="flex items-center gap-2 text-slate-500 mb-2 text-sm font-medium">
              <div className="p-1.5 bg-slate-50 rounded-full text-primary-600">
                <TrendingUp size={16} />
              </div>
              Чистая прибыль (мес)
            </div>
            <div className={`text-2xl font-bold ${profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {formatCurrency(profit)}
            </div>
          </div>
        </div>
      </div>

      {/* Main Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-6 rounded shadow-sm border border-slate-200 h-[400px]">
          <h3 className="text-lg font-bold text-slate-800 mb-6">Динамика финансов</h3>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barGap={8}>
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{fill: '#94a3b8', fontSize: 12}} 
                dy={10}
              />
              <YAxis 
                hide={true} 
              />
              <Tooltip 
                cursor={{fill: '#f1f5f9'}}
                contentStyle={{borderRadius: '4px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
              />
              <Bar dataKey="income" name="Доход" fill="#10b981" radius={[2, 2, 0, 0]} barSize={30} />
              <Bar dataKey="expense" name="Расход" fill="#f43f5e" radius={[2, 2, 0, 0]} barSize={30} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Studio Stats */}
        <div className="bg-white p-6 rounded shadow-sm border border-slate-200">
          <h3 className="text-lg font-bold text-slate-800 mb-6">Прибыль по студиям</h3>
          <div className="space-y-6">
            {studioStats.map(s => (
              <div key={s.id} className="group">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium text-slate-700">{s.name}</span>
                  <span className={`font-semibold ${s.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {formatCurrency(s.profit)}
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${s.color.replace('bg-', 'bg-')}`} 
                    style={{ width: `${Math.min(Math.max((s.profit / (income || 1)) * 100, 0), 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-8 pt-6 border-t border-slate-100">
             <div className="text-sm text-slate-400 text-center">
               Данные за текущий месяц
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};
