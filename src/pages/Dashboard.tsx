import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Wallet, TrendingUp, Target, BarChart3 } from "lucide-react";
import { RadialProgress } from "@/components/RadialProgress";
import { toast } from "@/hooks/use-toast";
import { SurplusRecommendations } from "@/components/SurplusRecommendations";

interface Stats {
  totalBudget: number;
  totalExpenses: number;
  totalInvestments: number;
  goalsProgress: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({
    totalBudget: 0,
    totalExpenses: 0,
    totalInvestments: 0,
    goalsProgress: 0,
  });
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState<string>("User");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchStats();
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data } = await supabase
      .from('profiles')
      .select('display_name, avatar_url')
      .eq('id', session.user.id)
      .single();

    if (data?.display_name) {
      setDisplayName(data.display_name);
    }
    if (data?.avatar_url) {
      setAvatarUrl(data.avatar_url);
    }
  };

  const fetchStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [budgetsRes, expensesRes, investmentsRes, goalsRes] = await Promise.all([
        supabase.from("budgets").select("amount").eq("user_id", user.id),
        supabase.from("expenses").select("amount").eq("user_id", user.id),
        supabase.from("investments").select("current_value").eq("user_id", user.id),
        supabase.from("savings_goals").select("target_amount, current_amount").eq("user_id", user.id),
      ]);

      const totalBudget = budgetsRes.data?.reduce((sum, b) => sum + Number(b.amount), 0) || 0;
      const totalExpenses = expensesRes.data?.reduce((sum, e) => sum + Number(e.amount), 0) || 0;
      const totalInvestments = investmentsRes.data?.reduce((sum, i) => sum + Number(i.current_value), 0) || 0;
      
      const goalsData = goalsRes.data || [];
      const goalsProgress = goalsData.length > 0
        ? (goalsData.reduce((sum, g) => sum + (Number(g.current_amount) / Number(g.target_amount)), 0) / goalsData.length) * 100
        : 0;

      setStats({
        totalBudget,
        totalExpenses,
        totalInvestments,
        goalsProgress,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error fetching stats",
        description: "Failed to load dashboard data",
      });
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: "Total Budget",
      value: `₹${stats.totalBudget.toFixed(2)}`,
      icon: Wallet,
      color: "text-primary",
    },
    {
      title: "Total Expenses",
      value: `₹${stats.totalExpenses.toFixed(2)}`,
      icon: TrendingUp,
      color: "text-destructive",
    },
    {
      title: "Investments",
      value: `₹${stats.totalInvestments.toFixed(2)}`,
      icon: BarChart3,
      color: "text-secondary",
    },
    {
      title: "Goals Progress",
      value: `${stats.goalsProgress.toFixed(0)}%`,
      icon: Target,
      color: "text-accent",
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-transparent">
            Welcome {displayName}!
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">
            Here's your financial overview
          </p>
        </div>
        <Avatar 
          className="h-16 w-16 cursor-pointer hover:ring-2 hover:ring-primary transition-all"
          onClick={() => navigate('/settings')}
        >
          <AvatarImage src={avatarUrl || undefined} alt={displayName} />
          <AvatarFallback className="bg-primary text-primary-foreground text-xl">
            {displayName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card
              key={index}
              className="transition-all hover:shadow-lg hover:-translate-y-1 border-0 bg-gradient-to-br from-card to-card/50"
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <Icon className={`h-5 w-5 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{loading ? "..." : stat.value}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-0 bg-gradient-to-br from-primary/10 to-primary/5">
          <CardHeader>
            <CardTitle>Budget vs Expenses</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center">
            <RadialProgress
              value={(stats.totalExpenses / stats.totalBudget) * 100 || 0}
              size={200}
              strokeWidth={15}
            />
          </CardContent>
        </Card>

        <Card className="border-0 bg-gradient-to-br from-secondary/10 to-secondary/5">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <a
              href="/tutor"
              className="block p-4 rounded-lg bg-card hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <h3 className="font-semibold">📚 Start Learning</h3>
              <p className="text-sm text-muted-foreground">Chat with AI tutor</p>
            </a>
            <a
              href="/expenses"
              className="block p-4 rounded-lg bg-card hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <h3 className="font-semibold">💰 Add Expense</h3>
              <p className="text-sm text-muted-foreground">Track spending</p>
            </a>
            <a
              href="/investments"
              className="block p-4 rounded-lg bg-card hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <h3 className="font-semibold">📈 View Investments</h3>
              <p className="text-sm text-muted-foreground">Check portfolio</p>
            </a>
          </CardContent>
        </Card>
      </div>

      {/* Smart Financial Recommendations Section */}
      <SurplusRecommendations />
    </div>
  );
}