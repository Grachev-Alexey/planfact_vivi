import { useAuth } from "@/hooks/use-auth";
import { Sidebar } from "@/components/Sidebar";
import { useAccounts } from "@/hooks/use-accounts";
import { useCashflowReport } from "@/hooks/use-reports";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUpRight, ArrowDownRight, Wallet, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { TransactionForm } from "@/components/TransactionForm";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';

export default function Home() {
  const { user } = useAuth();
  const { data: accounts, isLoading: accountsLoading } = useAccounts();
  const { data: cashflow, isLoading: cashflowLoading } = useCashflowReport();
  const [isTxOpen, setIsTxOpen] = useState(false);

  // Calculate totals
  const totalBalance = accounts?.reduce((sum, acc) => sum + Number(acc.balance), 0) || 0;
  
  // Prepare chart data (mock for demo if empty, ideally comes from API)
  const chartData = cashflow?.history || [
    { period: "Янв", income: 120000, expense: 80000 },
    { period: "Фев", income: 150000, expense: 90000 },
    { period: "Мар", income: 180000, expense: 100000 },
  ];

  if (accountsLoading) return <div className="h-screen w-full flex items-center justify-center bg-background"><Skeleton className="w-[100px] h-[20px] rounded-full" /></div>;

  return (
    <div className="flex min-h-screen bg-background text-foreground font-sans">
      <Sidebar />
      
      <main className="flex-1 p-4 md:p-8 lg:p-12 overflow-y-auto">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold font-display text-foreground">
              Добро пожаловать, {user?.firstName || 'User'}!
            </h1>
            <p className="text-muted-foreground mt-1">Вот обзор финансов вашей сети студий.</p>
          </div>

          <Dialog open={isTxOpen} onOpenChange={setIsTxOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:-translate-y-0.5">
                <Plus className="w-5 h-5 mr-2" />
                Новая операция
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Добавить операцию</DialogTitle>
              </DialogHeader>
              <TransactionForm onSuccess={() => setIsTxOpen(false)} />
            </DialogContent>
          </Dialog>
        </header>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="border-none shadow-md bg-gradient-to-br from-primary/10 to-primary/5">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-primary">Общий баланс</CardTitle>
              <Wallet className="w-4 h-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-display text-foreground">
                {new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(totalBalance)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">По всем счетам</p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-emerald-600">Доходы (Месяц)</CardTitle>
              <ArrowUpRight className="w-4 h-4 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-display text-emerald-600">
                {new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(cashflow?.totalIncome || 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">+12% к прошлому месяцу</p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-rose-600">Расходы (Месяц)</CardTitle>
              <ArrowDownRight className="w-4 h-4 text-rose-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-display text-rose-600">
                {new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(cashflow?.totalExpense || 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">-5% к прошлому месяцу</p>
            </CardContent>
          </Card>
        </div>

        {/* Chart Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card className="col-span-1 shadow-sm border-border/50">
            <CardHeader>
              <CardTitle>Денежный поток</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="period" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `₽${val/1000}k`} />
                  <Tooltip 
                    cursor={{ fill: 'transparent' }}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="income" name="Доход" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expense" name="Расход" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Accounts List */}
          <Card className="col-span-1 shadow-sm border-border/50">
            <CardHeader>
              <CardTitle>Счета</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {accounts?.map((acc) => (
                  <div key={acc.id} className="flex items-center justify-between p-3 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center">
                        <Wallet className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{acc.name}</p>
                        <p className="text-xs text-muted-foreground capitalize">{acc.type}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-sm">
                        {new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(Number(acc.balance))}
                      </p>
                    </div>
                  </div>
                ))}
                
                {accounts?.length === 0 && (
                  <p className="text-center text-muted-foreground py-4">Счетов пока нет</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
