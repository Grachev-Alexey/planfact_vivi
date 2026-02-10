import { Sidebar } from "@/components/Sidebar";
import { useCategories, useCreateCategory, useDeleteCategory } from "@/hooks/use-categories";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, FolderOpen } from "lucide-react";
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
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function Categories() {
  const { data: categories, isLoading } = useCategories();
  const createCategory = useCreateCategory();
  const deleteCategory = useDeleteCategory();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatType, setNewCatType] = useState<"income" | "expense">("expense");

  const handleCreate = async () => {
    try {
      await createCategory.mutateAsync({ name: newCatName, type: newCatType, isSystem: false });
      toast({ title: "Успешно", description: "Статья добавлена" });
      setIsOpen(false);
      setNewCatName("");
    } catch {
      toast({ title: "Ошибка", variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm("Удалить статью?")) {
      await deleteCategory.mutateAsync(id);
    }
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground font-sans">
      <Sidebar />
      <main className="flex-1 p-4 md:p-8 overflow-y-auto">
        <header className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold font-display">Статьи</h1>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary text-white"><Plus className="w-4 h-4 mr-2" /> Добавить</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Новая статья</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <Input 
                  placeholder="Название (напр. Аренда)" 
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                />
                <Select value={newCatType} onValueChange={(v: any) => setNewCatType(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="income">Доход</SelectItem>
                    <SelectItem value="expense">Расход</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={handleCreate} className="w-full">Создать</Button>
              </div>
            </DialogContent>
          </Dialog>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Card className="border-none shadow-sm">
            <CardHeader><CardTitle className="text-emerald-600">Доходы</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {categories?.filter(c => c.type === 'income').map(cat => (
                <div key={cat.id} className="flex justify-between items-center p-3 bg-secondary/30 rounded-lg group hover:bg-secondary/50 transition-colors">
                  <div className="flex items-center gap-2">
                    <FolderOpen className="w-4 h-4 text-emerald-500" />
                    <span>{cat.name}</span>
                  </div>
                  {!cat.isSystem && (
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(cat.id)} className="opacity-0 group-hover:opacity-100 text-destructive">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardHeader><CardTitle className="text-rose-600">Расходы</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {categories?.filter(c => c.type === 'expense').map(cat => (
                <div key={cat.id} className="flex justify-between items-center p-3 bg-secondary/30 rounded-lg group hover:bg-secondary/50 transition-colors">
                  <div className="flex items-center gap-2">
                    <FolderOpen className="w-4 h-4 text-rose-500" />
                    <span>{cat.name}</span>
                  </div>
                  {!cat.isSystem && (
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(cat.id)} className="opacity-0 group-hover:opacity-100 text-destructive">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
