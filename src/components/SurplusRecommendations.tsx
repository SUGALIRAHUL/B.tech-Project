import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { TrendingUp, PiggyBank, Wallet, Loader2, RefreshCw, Lightbulb, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface Recommendation {
  name: string;
  type: string;
  sector: string;
  allocation: number;
  risk: string;
  expectedReturn: string;
  rationale: string;
}

interface RecommendationData {
  disclaimer: string;
  recommendations: Recommendation[];
  summary: string;
}

interface FinancialSummary {
  totalIncome: number;
  totalBudget: number;
  totalExpenses: number;
  surplus: number;
}

export function SurplusRecommendations() {
  const [loading, setLoading] = useState(false);
  const [financialData, setFinancialData] = useState<FinancialSummary | null>(null);
  const [recommendations, setRecommendations] = useState<RecommendationData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showRecommendations, setShowRecommendations] = useState(false);

  useEffect(() => {
    fetchFinancialData();
  }, []);

  const fetchFinancialData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [incomeRes, budgetRes, expenseRes] = await Promise.all([
        supabase.from("income").select("amount").eq("user_id", user.id),
        supabase.from("budgets").select("amount").eq("user_id", user.id),
        supabase.from("expenses").select("amount").eq("user_id", user.id),
      ]);

      const totalIncome = incomeRes.data?.reduce((sum, i) => sum + Number(i.amount), 0) || 0;
      const totalBudget = budgetRes.data?.reduce((sum, b) => sum + Number(b.amount), 0) || 0;
      const totalExpenses = expenseRes.data?.reduce((sum, e) => sum + Number(e.amount), 0) || 0;
      const surplus = totalIncome - totalBudget - totalExpenses;

      setFinancialData({
        totalIncome,
        totalBudget,
        totalExpenses,
        surplus,
      });
    } catch (err) {
      console.error("Error fetching financial data:", err);
      setError("Failed to load financial data");
    }
  };

  const getRecommendations = async () => {
    if (!financialData || financialData.surplus <= 0) {
      toast({
        variant: "destructive",
        title: "No Surplus Available",
        description: "Add income data that exceeds your budget and expenses to get recommendations.",
      });
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Determine risk profile based on surplus ratio
      const surplusRatio = financialData.surplus / financialData.totalIncome;
      let riskProfile: 'conservative' | 'moderate' | 'aggressive' = 'moderate';
      if (surplusRatio < 0.1) riskProfile = 'conservative';
      else if (surplusRatio > 0.3) riskProfile = 'aggressive';

      const { data, error } = await supabase.functions.invoke('investment-recommendations', {
        body: {
          riskProfile,
          investmentAmount: financialData.surplus,
        },
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      setRecommendations(data);
      setShowRecommendations(true);
    } catch (err: any) {
      console.error("Error getting recommendations:", err);
      setError(err.message || "Failed to get recommendations. Please try again.");
      toast({
        variant: "destructive",
        title: "Error",
        description: err.message || "Failed to get recommendations",
      });
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk.toLowerCase()) {
      case 'low':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'high':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  if (!financialData) {
    return (
      <Card className="border-2 border-primary/20">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  const hasSurplus = financialData.surplus > 0;

  return (
    <Card className="border-2 border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-primary" />
          Smart Financial Recommendations
        </CardTitle>
        <CardDescription>
          AI-powered suggestions based on your financial surplus
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Financial Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-lg bg-primary/10">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Wallet className="h-4 w-4" />
              Total Income
            </div>
            <div className="text-xl font-bold text-primary">₹{financialData.totalIncome.toFixed(0)}</div>
          </div>
          <div className="p-4 rounded-lg bg-destructive/10">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <TrendingUp className="h-4 w-4" />
              Budget + Expenses
            </div>
            <div className="text-xl font-bold text-destructive">
              ₹{(financialData.totalBudget + financialData.totalExpenses).toFixed(0)}
            </div>
          </div>
          <div className="p-4 rounded-lg bg-secondary/10 col-span-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <PiggyBank className="h-4 w-4" />
              Available Surplus
            </div>
            <div className={`text-2xl font-bold ${hasSurplus ? 'text-secondary' : 'text-destructive'}`}>
              ₹{financialData.surplus.toFixed(0)}
            </div>
          </div>
        </div>

        {/* No Surplus Warning */}
        {!hasSurplus && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              You don't have a financial surplus currently. Add more income or reduce expenses to get investment and savings recommendations.
            </AlertDescription>
          </Alert>
        )}

        {/* Get Recommendations Button */}
        {hasSurplus && !recommendations && (
          <Button 
            onClick={getRecommendations} 
            disabled={loading}
            className="w-full"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analyzing Your Finances...
              </>
            ) : (
              <>
                <Lightbulb className="mr-2 h-4 w-4" />
                Get Smart Recommendations
              </>
            )}
          </Button>
        )}

        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Recommendations Display */}
        {recommendations && (
          <Collapsible open={showRecommendations} onOpenChange={setShowRecommendations}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" className="w-full justify-between">
                <span className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  View AI Recommendations
                </span>
                {showRecommendations ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 mt-4">
              {/* Disclaimer */}
              <Alert className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-800 dark:text-amber-200 text-sm">
                  {recommendations.disclaimer || "These are educational suggestions only and not financial advice. Always consult a qualified financial advisor before making investment decisions."}
                </AlertDescription>
              </Alert>

              {/* Summary */}
              {recommendations.summary && (
                <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                  <h4 className="font-semibold mb-2">Strategy Summary</h4>
                  <p className="text-sm text-muted-foreground">{recommendations.summary}</p>
                </div>
              )}

              {/* Individual Recommendations */}
              <div className="space-y-3">
                {recommendations.recommendations?.map((rec, index) => (
                  <div 
                    key={index} 
                    className="p-4 rounded-lg border bg-card hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-semibold">{rec.name}</h4>
                        <p className="text-sm text-muted-foreground">{rec.type} • {rec.sector}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-primary">{rec.allocation}%</div>
                        <div className="text-sm text-muted-foreground">
                          ₹{((financialData.surplus * rec.allocation) / 100).toFixed(0)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className={getRiskColor(rec.risk)}>
                        {rec.risk} Risk
                      </Badge>
                      <Badge variant="outline">
                        {rec.expectedReturn} Expected
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{rec.rationale}</p>
                  </div>
                ))}
              </div>

              {/* Refresh Button */}
              <Button 
                variant="outline" 
                onClick={getRecommendations} 
                disabled={loading}
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Refresh Recommendations
                  </>
                )}
              </Button>
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}