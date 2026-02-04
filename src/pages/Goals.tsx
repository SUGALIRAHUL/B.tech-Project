import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadialProgress } from "@/components/RadialProgress";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CategorySelect, GOAL_TYPES } from "@/components/CategorySelect";

const createGoalSchema = z.object({
  target_amount: z.coerce.number().int("Must be a whole number").min(1, "Target must be greater than 0").max(1_000_000_000),
  current_amount: z.coerce.number().int("Must be a whole number").min(0).max(1_000_000_000),
  deadline: z.string().optional(),
});

export default function Goals() {
  const [goals, setGoals] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [goalName, setGoalName] = useState("");
  const { toast } = useToast();
  
  const form = useForm({
    resolver: zodResolver(createGoalSchema),
    defaultValues: { target_amount: 0, current_amount: 0, deadline: "" },
  });

  useEffect(() => { fetchGoals(); }, []);

  const fetchGoals = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("savings_goals").select("*").eq("user_id", user.id);
    setGoals(data || []);
  };

  const onSubmit = async (values: z.infer<typeof createGoalSchema>) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (!goalName.trim()) {
      toast({ variant: "destructive", title: "Error", description: "Goal name is required" });
      return;
    }

    const payload = { name: goalName, target_amount: values.target_amount, current_amount: values.current_amount, deadline: values.deadline || null };
    
    if (editingId) {
      const { error } = await supabase.from("savings_goals").update(payload).eq("id", editingId);
      if (!error) { 
        toast({ title: "Goal updated" }); 
        setOpen(false); 
        setEditingId(null); 
        form.reset(); 
        setGoalName("");
        fetchGoals(); 
      }
    } else {
      const { error } = await supabase.from("savings_goals").insert({ ...payload, user_id: user.id });
      if (!error) { 
        toast({ title: "Goal created" }); 
        setOpen(false); 
        form.reset(); 
        setGoalName("");
        fetchGoals(); 
      }
    }
  };

  const handleEdit = (goal: any) => {
    setEditingId(goal.id);
    setGoalName(goal.name);
    form.reset({ target_amount: Math.round(goal.target_amount), current_amount: Math.round(goal.current_amount), deadline: goal.deadline || "" });
    setOpen(true);
  };

  const handleDelete = async (id: string) => {
    await supabase.from("savings_goals").delete().eq("id", id);
    toast({ title: "Goal deleted" });
    fetchGoals();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">Savings Goals</h1>
        <Dialog open={open} onOpenChange={(o) => { 
          setOpen(o); 
          if (!o) { 
            setEditingId(null); 
            form.reset(); 
            setGoalName("");
          } 
        }}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Add Goal</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingId ? "Edit Goal" : "Create Goal"}</DialogTitle></DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <CategorySelect
                  value={goalName}
                  onValueChange={setGoalName}
                  categories={GOAL_TYPES}
                  label="Goal Name"
                  placeholder="Select a goal type"
                  required
                />
                <FormField control={form.control} name="target_amount" render={({ field }) => (
                  <FormItem><FormLabel>Target Amount (₹) <span className="text-destructive">*</span></FormLabel><FormControl><Input type="number" step="1" min="1" {...field} onChange={(e) => field.onChange(e.target.value.replace(/\D/g, ''))} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="current_amount" render={({ field }) => (
                  <FormItem><FormLabel>Current Amount (₹) <span className="text-destructive">*</span></FormLabel><FormControl><Input type="number" step="1" min="0" {...field} onChange={(e) => field.onChange(e.target.value.replace(/\D/g, ''))} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="deadline" render={({ field }) => (
                  <FormItem><FormLabel>Deadline (Optional)</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <Button type="submit" className="w-full">{editingId ? "Update" : "Create"}</Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {goals.map((goal) => {
          const progress = goal.target_amount > 0 ? Math.min(100, (goal.current_amount / goal.target_amount) * 100) : 0;
          return (
            <Card key={goal.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle>{goal.name}</CardTitle>
                <div className="flex gap-1">
                  <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={() => handleEdit(goal)}><Pencil className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Edit</TooltipContent></Tooltip>
                  <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={() => handleDelete(goal.id)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Delete</TooltipContent></Tooltip>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col items-center space-y-4">
                <RadialProgress value={progress} size={120} />
                <p className="text-sm text-muted-foreground">₹{Math.round(goal.current_amount).toLocaleString()} / ₹{Math.round(goal.target_amount).toLocaleString()}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
