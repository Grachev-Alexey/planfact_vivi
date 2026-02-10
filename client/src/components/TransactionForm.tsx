import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertTransactionSchema, type InsertTransaction } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateTransaction } from "@/hooks/use-transactions";
import { useAccounts } from "@/hooks/use-accounts";
import { useCategories } from "@/hooks/use-categories";
import { useStudios } from "@/hooks/use-studios";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

type Props = {
  onSuccess?: () => void;
};

export function TransactionForm({ onSuccess }: Props) {
  const { toast } = useToast();
  const createTx = useCreateTransaction();
  const { data: accounts } = useAccounts();
  const { data: categories } = useCategories();
  const { data: studios } = useStudios();

  const form = useForm<InsertTransaction>({
    resolver: zodResolver(insertTransactionSchema),
    defaultValues: {
      type: "expense",
      date: new Date(),
      amount: 0,
      description: "",
      accountId: undefined,
      categoryId: undefined,
      studioId: undefined,
    },
  });

  const type = form.watch("type");

  async function onSubmit(data: InsertTransaction) {
    try {
      await createTx.mutateAsync(data);
      toast({ title: "Успешно", description: "Операция добавлена" });
      form.reset();
      onSuccess?.();
    } catch (error) {
      toast({ 
        title: "Ошибка", 
        description: "Не удалось добавить операцию", 
        variant: "destructive" 
      });
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Тип</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите тип" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="income">Доход</SelectItem>
                    <SelectItem value="expense">Расход</SelectItem>
                    <SelectItem value="transfer">Перевод</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Дата</FormLabel>
                <FormControl>
                  <Input 
                    type="date" 
                    value={field.value ? format(field.value, "yyyy-MM-dd") : ""}
                    onChange={(e) => field.onChange(new Date(e.target.value))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="amount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Сумма</FormLabel>
              <FormControl>
                <Input 
                  type="number" 
                  step="0.01" 
                  {...field}
                  onChange={(e) => field.onChange(parseFloat(e.target.value))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="accountId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Счет {type === "transfer" ? "(Откуда)" : ""}</FormLabel>
                <Select 
                  onValueChange={(val) => field.onChange(parseInt(val))} 
                  value={field.value?.toString()}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите счет" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {accounts?.map(acc => (
                      <SelectItem key={acc.id} value={acc.id.toString()}>
                        {acc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {type === "transfer" && (
             <FormField
             control={form.control}
             name="toAccountId"
             render={({ field }) => (
               <FormItem>
                 <FormLabel>Счет (Куда)</FormLabel>
                 <Select 
                   onValueChange={(val) => field.onChange(parseInt(val))} 
                   value={field.value?.toString()}
                 >
                   <FormControl>
                     <SelectTrigger>
                       <SelectValue placeholder="Выберите счет" />
                     </SelectTrigger>
                   </FormControl>
                   <SelectContent>
                     {accounts?.map(acc => (
                       <SelectItem key={acc.id} value={acc.id.toString()}>
                         {acc.name}
                       </SelectItem>
                     ))}
                   </SelectContent>
                 </Select>
                 <FormMessage />
               </FormItem>
             )}
           />
          )}

          {type !== "transfer" && (
            <FormField
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Статья</FormLabel>
                  <Select 
                    onValueChange={(val) => field.onChange(parseInt(val))} 
                    value={field.value?.toString()}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите статью" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {categories
                        ?.filter(c => c.type === type)
                        .map(c => (
                        <SelectItem key={c.id} value={c.id.toString()}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </div>

        <FormField
          control={form.control}
          name="studioId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Студия (Опционально)</FormLabel>
              <Select 
                onValueChange={(val) => field.onChange(parseInt(val))} 
                value={field.value?.toString()}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите студию" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {studios?.map(s => (
                    <SelectItem key={s.id} value={s.id.toString()}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Комментарий</FormLabel>
              <FormControl>
                <Input {...field} value={field.value || ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button 
          type="submit" 
          className="w-full bg-primary hover:bg-primary/90 text-white"
          disabled={createTx.isPending}
        >
          {createTx.isPending ? "Сохранение..." : "Добавить операцию"}
        </Button>
      </form>
    </Form>
  );
}
