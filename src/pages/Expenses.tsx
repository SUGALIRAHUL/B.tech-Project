import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { z } from "zod";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CategorySelect, EXPENSE_CATEGORIES } from "@/components/CategorySelect";

const expenseSchema = z.object({
  category: z.string()
    .trim()
    .min(1, 'Category required')
    .max(50, 'Category too long'),
  amount: z.number()
    .int('Amount must be a whole number')
    .min(1, 'Amount must be positive')
    .max(10000000, 'Amount too large'),
  description: z.string()
    .max(500, 'Description too long')
    .optional(),
  date: z.string()
});

export default function Expenses() {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    category: "",
    amount: "",
    description: "",
    date: new Date().toISOString().split("T")[0],
  });

  useEffect(() => {
    fetchExpenses();
  }, []);

  const fetchExpenses = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("expenses")
      .select("*")
      .eq("user_id", user.id)
      .order("date", { ascending: false });

    setExpenses(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validation = expenseSchema.safeParse({
      category: formData.category,
      amount: parseInt(formData.amount),
      description: formData.description || undefined,
      date: formData.date
    });
    
    if (!validation.success) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: validation.error.errors[0].message,
      });
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (editingId) {
      const { error } = await supabase.from("expenses").update({
        category: validation.data.category,
        amount: validation.data.amount,
        description: validation.data.description,
        date: validation.data.date,
      }).eq("id", editingId);

      if (!error) {
        toast({ title: "Expense updated" });
        setDialogOpen(false);
        setEditingId(null);
        setFormData({ category: "", amount: "", description: "", date: new Date().toISOString().split("T")[0] });
        fetchExpenses();
      }
    } else {
      const { error } = await supabase.from("expenses").insert({
        user_id: user.id,
        category: validation.data.category,
        amount: validation.data.amount,
        description: validation.data.description,
        date: validation.data.date,
      });

      if (!error) {
        toast({ title: "Expense added" });
        setDialogOpen(false);
        setFormData({ category: "", amount: "", description: "", date: new Date().toISOString().split("T")[0] });
        fetchExpenses();
      }
    }
  };

  const handleEdit = (expense: any) => {
    setEditingId(expense.id);
    setFormData({
      category: expense.category,
      amount: Math.round(expense.amount).toString(),
      description: expense.description || "",
      date: expense.date,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    
    if (error) {
      toast({ 
        variant: "destructive",
        title: "Error",
        description: "Failed to delete expense"
      });
    } else {
      toast({ title: "Expense deleted" });
      fetchExpenses();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
          Expenses
        </h1>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditingId(null);
            setFormData({ category: "", amount: "", description: "", date: new Date().toISOString().split("T")[0] });
          }
        }}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />Add Expense</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingId ? "Edit Expense" : "Add Expense"}</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <CategorySelect
                value={formData.category}
                onValueChange={(value) => setFormData({...formData, category: value})}
                categories={EXPENSE_CATEGORIES}
                label="Category"
                placeholder="Select a category"
                required
              />
              <div className="space-y-2">
                <Label>Amount (₹) <span className="text-destructive">*</span></Label>
                <Input 
                  type="number" 
                  step="1" 
                  min="1"
                  value={formData.amount} 
                  onChange={(e) => setFormData({...formData, amount: e.target.value.replace(/\D/g, '')})} 
                  placeholder="Enter whole number"
                  required 
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Date <span className="text-destructive">*</span></Label>
                <Input type="date" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} required />
              </div>
              <Button type="submit" className="w-full">{editingId ? "Update" : "Add"}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {expenses.map((expense) => (
          <Card key={expense.id}>
            <CardContent className="flex justify-between items-center p-4">
              <div>
                <h3 className="font-semibold">{expense.category}</h3>
                <p className="text-sm text-muted-foreground">{expense.description}</p>
                <p className="text-xs text-muted-foreground">{new Date(expense.date).toLocaleDateString()}</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-xl font-bold text-destructive">₹{Math.round(Number(expense.amount)).toLocaleString()}</div>
                <div className="flex gap-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(expense)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Edit</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(expense.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Delete</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
