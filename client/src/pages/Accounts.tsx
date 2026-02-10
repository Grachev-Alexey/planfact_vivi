import { Sidebar } from "@/components/Sidebar";
import { useAccounts, useCreateAccount, useDeleteAccount } from "@/hooks/use-accounts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Wallet } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertAccountSchema, type InsertAccount } from "@shared/schema";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function AccountsPage() {
  const { data: accounts, isLoading } = useAccounts();
  const createAccount = useCreateAccount();
  const deleteAccount = useDeleteAccount();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);

  const form = useForm<InsertAccount>({
    resolver: zodResolver(insertAccountSchema),
    defaultValues: { name: "", type: "cash", currency: "RUB", balance: 0 },
  });

  const onSubmit = async (data: InsertAccount) => {
    try {
      await createAccount.mutateAsync(data);
      toast({ title: "Успешно", description: "Счет добавлен" });
      form.reset();
      setIsOpen(false);
    } catch {
      toast({ title: "Ошибка", variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm("Удалить счет? История операций может быть потеряна.")) {
      await deleteAccount.mutateAsync(id);
    }
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground font-sans">
      <Sidebar />
      <main className="flex-1 p-4 md:p-8 overflow-y-auto">
        <header className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold font-display">Счета</h1>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary text-white"><Plus className="w-4 h-4 mr-2" /> Добавить</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Новый счет</DialogTitle></DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Название</FormLabel>
                        <FormControl><Input {...field} placeholder="Касса Основная" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Тип</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="cash">Наличные</SelectItem>
                            <SelectItem value="card">Карта</SelectItem>
                            <SelectItem value="bank_account">Расчетный счет</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="balance"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Начальный баланс</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            {...field} 
                            onChange={e => field.onChange(parseFloat(e.target.value))} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full" disabled={createAccount.isPending}>Создать</Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {accounts?.map((acc) => (
            <Card key={acc.id} className="border-none shadow-sm hover:shadow-md transition-all group bg-gradient-to-br from-white to-secondary/30">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg font-bold">{acc.name}</CardTitle>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => handleDelete(acc.id)}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 mb-4">
                  <Wallet className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground capitalize">
                    {acc.type === 'cash' ? 'Наличные' : acc.type === 'card' ? 'Карта' : 'Р/С'}
                  </span>
                </div>
                <div className="text-2xl font-bold text-primary font-display">
                  {new Intl.NumberFormat('ru-RU', { style: 'currency', currency: acc.currency }).format(Number(acc.balance))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
