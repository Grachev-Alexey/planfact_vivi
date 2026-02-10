import { Sidebar } from "@/components/Sidebar";
import { usePnlReport } from "@/hooks/use-reports";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Loader2 } from "lucide-react";

export default function Reports() {
  const { data: pnl, isLoading } = usePnlReport();

  // Mock data structure for visualization if API returns raw numbers
  // Ideally backend aggregates this. Assuming simple structure for demo:
  const incomeData = [
    { name: 'Абонементы', value: 400000 },
    { name: 'Разовые услуги', value: 300000 },
    { name: 'Косметика', value: 100000 },
  ];
  
  const expenseData = [
    { name: 'Аренда', value: 150000 },
    { name: 'Зарплаты', value: 250000 },
    { name: 'Реклама', value: 80000 },
    { name: 'Расходники', value: 50000 },
  ];

  const COLORS = ['#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe', '#ede9fe'];

  return (
    <div className="flex min-h-screen bg-background text-foreground font-sans">
      <Sidebar />
      <main className="flex-1 p-4 md:p-8 overflow-y-auto">
        <h1 className="text-3xl font-bold font-display mb-8">Отчеты</h1>

        {isLoading ? (
          <div className="flex justify-center"><Loader2 className="animate-spin" /></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Card className="border-none shadow-sm">
              <CardHeader>
                <CardTitle>Структура доходов</CardTitle>
              </CardHeader>
              <CardContent className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={incomeData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      fill="#8884d8"
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {incomeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(val: number) => new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(val)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm">
              <CardHeader>
                <CardTitle>Структура расходов</CardTitle>
              </CardHeader>
              <CardContent className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={expenseData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      fill="#8884d8"
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {expenseData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={['#f43f5e', '#fb7185', '#fda4af', '#fecdd3'][index % 4]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(val: number) => new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(val)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
