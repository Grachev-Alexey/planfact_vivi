import { Sidebar } from "@/components/Sidebar";
import { useStudios, useCreateStudio, useDeleteStudio } from "@/hooks/use-studios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Trash2, MapPin, Plus } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertStudioSchema, type InsertStudio } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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

export default function Studios() {
  const { data: studios, isLoading } = useStudios();
  const createStudio = useCreateStudio();
  const deleteStudio = useDeleteStudio();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);

  const form = useForm<InsertStudio>({
    resolver: zodResolver(insertStudioSchema),
    defaultValues: { name: "", address: "" },
  });

  const onSubmit = async (data: InsertStudio) => {
    try {
      await createStudio.mutateAsync(data);
      toast({ title: "Успешно", description: "Студия добавлена" });
      form.reset();
      setIsOpen(false);
    } catch {
      toast({ title: "Ошибка", description: "Не удалось создать студию", variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm("Вы уверены? Это удалит связанные данные.")) {
      await deleteStudio.mutateAsync(id);
    }
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground font-sans">
      <Sidebar />
      <main className="flex-1 p-4 md:p-8 overflow-y-auto">
        <header className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold font-display">Студии</h1>
          
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary text-white hover:bg-primary/90">
                <Plus className="w-4 h-4 mr-2" /> Добавить
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Новая студия</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Название</FormLabel>
                        <FormControl><Input {...field} placeholder="ViVi Москва" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Адрес</FormLabel>
                        <FormControl><Input {...field} value={field.value || ""} placeholder="ул. Ленина, 1" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full" disabled={createStudio.isPending}>
                    {createStudio.isPending ? "Сохранение..." : "Создать"}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </header>

        {isLoading ? (
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {studios?.map((studio) => (
              <Card key={studio.id} className="border border-border shadow-sm hover:shadow-md transition-all group">
                <CardHeader className="flex flex-row items-start justify-between pb-2">
                  <CardTitle className="text-xl font-bold text-primary">{studio.name}</CardTitle>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                    onClick={() => handleDelete(studio.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center text-muted-foreground text-sm">
                    <MapPin className="w-4 h-4 mr-2" />
                    {studio.address || "Адрес не указан"}
                  </div>
                </CardContent>
              </Card>
            ))}
            {studios?.length === 0 && <p className="text-muted-foreground col-span-full text-center">Нет студий</p>}
          </div>
        )}
      </main>
    </div>
  );
}
