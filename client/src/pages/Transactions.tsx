import { Sidebar } from "@/components/Sidebar";
import { useTransactions, useDeleteTransaction } from "@/hooks/use-transactions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2, ArrowUpCircle, ArrowDownCircle, ArrowRightCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function Transactions() {
  const { data: transactions, isLoading } = useTransactions();
  const deleteTx = useDeleteTransaction();
  const { toast } = useToast();

  const handleDelete = async (id: number) => {
    try {
      await deleteTx.mutateAsync(id);
      toast({ title: "Удалено", description: "Операция успешно удалена" });
    } catch {
      toast({ title: "Ошибка", description: "Не удалось удалить операцию", variant: "destructive" });
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'income': return <ArrowUpCircle className="w-5 h-5 text-emerald-500" />;
      case 'expense': return <ArrowDownCircle className="w-5 h-5 text-rose-500" />;
      default: return <ArrowRightCircle className="w-5 h-5 text-blue-500" />;
    }
  };

  const getAmountColor = (type: string) => {
    switch (type) {
      case 'income': return 'text-emerald-600';
      case 'expense': return 'text-rose-600';
      default: return 'text-foreground';
    }
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground font-sans">
      <Sidebar />
      <main className="flex-1 p-4 md:p-8 overflow-y-auto">
        <h1 className="text-3xl font-bold font-display mb-8">Операции</h1>

        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle>История операций</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]"></TableHead>
                    <TableHead>Дата</TableHead>
                    <TableHead>Описание</TableHead>
                    <TableHead>Категория</TableHead>
                    <TableHead>Счет</TableHead>
                    <TableHead className="text-right">Сумма</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions?.map((tx) => (
                    <TableRow key={tx.id} className="group">
                      <TableCell>{getTypeIcon(tx.type)}</TableCell>
                      <TableCell>
                        {format(new Date(tx.date), "dd MMM yyyy", { locale: ru })}
                      </TableCell>
                      <TableCell className="font-medium">
                        {tx.description || "Без описания"}
                      </TableCell>
                      <TableCell>
                        <span className="px-2 py-1 rounded-full bg-secondary text-xs font-medium">
                          {tx.category?.name || (tx.type === 'transfer' ? 'Перевод' : 'Без категории')}
                        </span>
                      </TableCell>
                      <TableCell>
                        {tx.account?.name} 
                        {tx.toAccount && ` → ${tx.toAccount.name}`}
                      </TableCell>
                      <TableCell className={`text-right font-bold ${getAmountColor(tx.type)}`}>
                        {tx.type === 'expense' ? '-' : '+'}
                        {new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(Number(tx.amount))}
                      </TableCell>
                      <TableCell>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Удалить операцию?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Это действие нельзя отменить. Баланс счетов будет пересчитан.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Отмена</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => handleDelete(tx.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Удалить
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                  {transactions?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        Операций пока нет
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
