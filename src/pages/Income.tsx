import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Pencil, DollarSign } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { z } from "zod";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CategorySelect, INCOME_SOURCES } from "@/components/CategorySelect";

type Income = {
  id: string;
  source: string;
  amount: number;
  frequency: string;
  date: string;
  description: string | null;
};

const incomeSchema = z.object({
  source: z.string()
    .trim()
    .min(1, 'Source required')
    .max(100, 'Source too long'),
  amount: z.number()
    .int('Amount must be a whole number')
    .min(1, 'Amount must be positive')
    .max(10000000, 'Amount too large'),
  frequency: z.enum(['one-time', 'weekly', 'bi-weekly', 'monthly', 'yearly']),
  description: z.string()
    .max(500, 'Description too long')
    .optional(),
  date: z.string()
});

export default function Income() {
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    source: "",
    amount: "",
    frequency: "monthly",
    description: "",
    date: new Date().toISOString().split("T")[0],
  });

  useEffect(() => {
    fetchIncomes();
  }, []);

  const fetchIncomes = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("income")
        .select("*")
        .eq("user_id", user.id)
        .order("date", { ascending: false });

      if (error) throw error;
      setIncomes(data || []);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch income records",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validation = incomeSchema.safeParse({
      source: formData.source,
      amount: parseInt(formData.amount),
      frequency: formData.frequency,
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

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (editingId) {
        const { error } = await supabase.from("income").update({
          source: validation.data.source,
          amount: validation.data.amount,
          frequency: validation.data.frequency,
          description: validation.data.description,
          date: validation.data.date,
        }).eq("id", editingId);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Income updated successfully",
        });
      } else {
        const { error } = await supabase.from("income").insert({
          user_id: user.id,
          source: validation.data.source,
          amount: validation.data.amount,
          frequency: validation.data.frequency,
          description: validation.data.description,
          date: validation.data.date,
        });

        if (error) throw error;

        toast({
          title: "Success",
          description: "Income added successfully",
        });
      }

      setDialogOpen(false);
      setEditingId(null);
      setFormData({
        source: "",
        amount: "",
        frequency: "monthly",
        description: "",
        date: new Date().toISOString().split("T")[0],
      });
      fetchIncomes();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: editingId ? "Failed to update income" : "Failed to add income",
      });
    }
  };

  const handleEdit = (income: Income) => {
    setEditingId(income.id);
    setFormData({
      source: income.source,
      amount: Math.round(income.amount).toString(),
      frequency: income.frequency,
      description: income.description || "",
      date: income.date,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from("income").delete().eq("id", id);
      if (error) throw error;

      toast({
        title: "Success",
        description: "Income deleted",
      });
      fetchIncomes();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete income",
      });
    }
  };

  const totalMonthlyIncome = incomes.reduce((total, income) => {
    const amount = Number(income.amount);
    switch (income.frequency) {
      case 'weekly': return total + (amount * 4.33);
      case 'bi-weekly': return total + (amount * 2.17);
      case 'monthly': return total + amount;
      case 'yearly': return total + (amount / 12);
      case 'one-time': return total;
      default: return total + amount;
    }
  }, 0);

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-500">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
          Income Tracker
        </h1>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditingId(null);
            setFormData({
              source: "",
              amount: "",
              frequency: "monthly",
              description: "",
              date: new Date().toISOString().split("T")[0],
            });
          }
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Income
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Income" : "Add New Income"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <CategorySelect
                value={formData.source}
                onValueChange={(value) => setFormData({ ...formData, source: value })}
                categories={INCOME_SOURCES}
                label="Source"
                placeholder="Select income source"
                required
              />
              <div className="space-y-2">
                <Label>
                  Amount (₹) <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="number"
                  step="1"
                  min="1"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value.replace(/\D/g, '') })}
                  placeholder="Enter whole number"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>
                  Frequency <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={formData.frequency}
                  onValueChange={(value) => setFormData({ ...formData, frequency: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background border">
                    <SelectItem value="one-time">One-time</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="bi-weekly">Bi-weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional description"
                />
              </div>
              <div className="space-y-2">
                <Label>
                  Date <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                />
              </div>
              <Button type="submit" className="w-full">
                {editingId ? "Update Income" : "Add Income"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-0 shadow-lg bg-gradient-to-r from-green-500/10 to-emerald-500/10">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-500" />
            Total Monthly Income
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-green-500">
            ₹{Math.round(totalMonthlyIncome).toLocaleString()}
          </div>
          <p className="text-sm text-muted-foreground">Estimated based on frequency</p>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {incomes.map((income) => (
          <Card key={income.id} className="border-0 shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg">{income.source}</CardTitle>
              <div className="flex gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(income)}
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
                      onClick={() => handleDelete(income.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Delete</TooltipContent>
                </Tooltip>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500">
                ₹{Math.round(Number(income.amount)).toLocaleString()}
              </div>
              <p className="text-sm text-muted-foreground capitalize">
                {income.frequency}
              </p>
              {income.description && (
                <p className="text-sm text-muted-foreground mt-1">{income.description}</p>
              )}
              <p className="text-xs text-muted-foreground mt-2">
                {new Date(income.date).toLocaleDateString()}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {!loading && incomes.length === 0 && (
        <Card className="border-2 border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <DollarSign className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              No income records yet. Click "Add Income" to get started!
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
