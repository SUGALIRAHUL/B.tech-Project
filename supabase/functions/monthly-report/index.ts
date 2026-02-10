import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": BREVO_API_KEY!,
    },
    body: JSON.stringify({
      sender: { name: "PERSFIN", email: "noreply@persfin.com" },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });
  
  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Failed to send email: ${error}`);
  }
  
  return res.json();
}

interface FinancialData {
  totalIncome: number;
  totalExpenses: number;
  savings: number;
  expensesByCategory: Record<string, number>;
  incomeBySource: Record<string, number>;
  budgets: Array<{ category: string; amount: number; spent: number }>;
  goals: Array<{ name: string; target: number; current: number; progress: number }>;
}

function formatCurrency(amount: number): string {
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}

function generateReportHTML(data: FinancialData, userName: string, month: string): string {
  const expenseCategories = Object.entries(data.expensesByCategory)
    .sort(([, a], [, b]) => b - a)
    .map(([category, amount]) => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #e0e0e0;">${category}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e0e0e0; text-align: right;">${formatCurrency(amount)}</td>
      </tr>
    `).join('');

  const incomeSources = Object.entries(data.incomeBySource)
    .sort(([, a], [, b]) => b - a)
    .map(([source, amount]) => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #e0e0e0;">${source}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e0e0e0; text-align: right;">${formatCurrency(amount)}</td>
      </tr>
    `).join('');

  const budgetRows = data.budgets.map(b => {
    const percentage = b.amount > 0 ? Math.round((b.spent / b.amount) * 100) : 0;
    const status = percentage > 100 ? '🔴 Over' : percentage > 80 ? '🟡 Warning' : '🟢 Good';
    return `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #e0e0e0;">${b.category}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e0e0e0; text-align: right;">${formatCurrency(b.amount)}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e0e0e0; text-align: right;">${formatCurrency(b.spent)}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e0e0e0; text-align: center;">${percentage}%</td>
        <td style="padding: 10px; border-bottom: 1px solid #e0e0e0; text-align: center;">${status}</td>
      </tr>
    `;
  }).join('');

  const goalRows = data.goals.map(g => `
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #e0e0e0;">${g.name}</td>
      <td style="padding: 10px; border-bottom: 1px solid #e0e0e0; text-align: right;">${formatCurrency(g.current)}</td>
      <td style="padding: 10px; border-bottom: 1px solid #e0e0e0; text-align: right;">${formatCurrency(g.target)}</td>
      <td style="padding: 10px; border-bottom: 1px solid #e0e0e0; text-align: center;">${Math.round(g.progress)}%</td>
    </tr>
  `).join('');

  const savingsRate = data.totalIncome > 0 ? Math.round((data.savings / data.totalIncome) * 100) : 0;
  const savingsColor = savingsRate >= 20 ? '#22c55e' : savingsRate >= 10 ? '#eab308' : '#ef4444';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Monthly Financial Report - ${month}</title>
    </head>
    <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 15px; text-align: center; margin-bottom: 30px;">
        <h1 style="margin: 0 0 10px 0; font-size: 28px;">📊 Monthly Financial Report</h1>
        <p style="margin: 0; font-size: 18px; opacity: 0.9;">${month}</p>
        <p style="margin: 10px 0 0 0; font-size: 14px; opacity: 0.8;">Hello, ${userName}!</p>
      </div>

      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 30px;">
        <div style="background: #f0fdf4; border-radius: 10px; padding: 20px; text-align: center;">
          <p style="margin: 0; color: #666; font-size: 14px;">Total Income</p>
          <p style="margin: 5px 0 0; font-size: 24px; font-weight: bold; color: #22c55e;">${formatCurrency(data.totalIncome)}</p>
        </div>
        <div style="background: #fef2f2; border-radius: 10px; padding: 20px; text-align: center;">
          <p style="margin: 0; color: #666; font-size: 14px;">Total Expenses</p>
          <p style="margin: 5px 0 0; font-size: 24px; font-weight: bold; color: #ef4444;">${formatCurrency(data.totalExpenses)}</p>
        </div>
        <div style="background: #f0f9ff; border-radius: 10px; padding: 20px; text-align: center;">
          <p style="margin: 0; color: #666; font-size: 14px;">Net Savings</p>
          <p style="margin: 5px 0 0; font-size: 24px; font-weight: bold; color: ${savingsColor};">${formatCurrency(data.savings)}</p>
          <p style="margin: 5px 0 0; font-size: 12px; color: #666;">${savingsRate}% savings rate</p>
        </div>
      </div>

      ${Object.keys(data.incomeBySource).length > 0 ? `
      <div style="margin-bottom: 30px;">
        <h2 style="color: #22c55e; border-bottom: 2px solid #22c55e; padding-bottom: 10px;">💰 Income Breakdown</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: #f9fafb;">
              <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e0e0e0;">Source</th>
              <th style="padding: 12px; text-align: right; border-bottom: 2px solid #e0e0e0;">Amount</th>
            </tr>
          </thead>
          <tbody>${incomeSources}</tbody>
        </table>
      </div>
      ` : ''}

      ${Object.keys(data.expensesByCategory).length > 0 ? `
      <div style="margin-bottom: 30px;">
        <h2 style="color: #ef4444; border-bottom: 2px solid #ef4444; padding-bottom: 10px;">💸 Expense Breakdown</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: #f9fafb;">
              <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e0e0e0;">Category</th>
              <th style="padding: 12px; text-align: right; border-bottom: 2px solid #e0e0e0;">Amount</th>
            </tr>
          </thead>
          <tbody>${expenseCategories}</tbody>
        </table>
      </div>
      ` : ''}

      ${data.budgets.length > 0 ? `
      <div style="margin-bottom: 30px;">
        <h2 style="color: #8b5cf6; border-bottom: 2px solid #8b5cf6; padding-bottom: 10px;">📋 Budget Status</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: #f9fafb;">
              <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e0e0e0;">Category</th>
              <th style="padding: 12px; text-align: right; border-bottom: 2px solid #e0e0e0;">Budget</th>
              <th style="padding: 12px; text-align: right; border-bottom: 2px solid #e0e0e0;">Spent</th>
              <th style="padding: 12px; text-align: center; border-bottom: 2px solid #e0e0e0;">Used</th>
              <th style="padding: 12px; text-align: center; border-bottom: 2px solid #e0e0e0;">Status</th>
            </tr>
          </thead>
          <tbody>${budgetRows}</tbody>
        </table>
      </div>
      ` : ''}

      ${data.goals.length > 0 ? `
      <div style="margin-bottom: 30px;">
        <h2 style="color: #0ea5e9; border-bottom: 2px solid #0ea5e9; padding-bottom: 10px;">🎯 Savings Goals</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: #f9fafb;">
              <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e0e0e0;">Goal</th>
              <th style="padding: 12px; text-align: right; border-bottom: 2px solid #e0e0e0;">Saved</th>
              <th style="padding: 12px; text-align: right; border-bottom: 2px solid #e0e0e0;">Target</th>
              <th style="padding: 12px; text-align: center; border-bottom: 2px solid #e0e0e0;">Progress</th>
            </tr>
          </thead>
          <tbody>${goalRows}</tbody>
        </table>
      </div>
      ` : ''}

      <div style="background: #f9fafb; border-radius: 10px; padding: 20px; margin-top: 30px; text-align: center;">
        <p style="margin: 0; color: #666; font-size: 14px;">
          This report was automatically generated by PERSFIN.<br>
          Keep tracking your finances for a better financial future! 🚀
        </p>
      </div>
    </body>
    </html>
  `;
}

async function getFinancialData(supabase: any, userId: string, startDate: string, endDate: string): Promise<FinancialData> {
  // Get income for the month
  const { data: incomeData } = await supabase
    .from('income')
    .select('*')
    .eq('user_id', userId)
    .gte('date', startDate)
    .lte('date', endDate);

  // Get expenses for the month
  const { data: expensesData } = await supabase
    .from('expenses')
    .select('*')
    .eq('user_id', userId)
    .gte('date', startDate)
    .lte('date', endDate);

  // Get budgets (monthly ones active in this period)
  const { data: budgetsData } = await supabase
    .from('budgets')
    .select('*')
    .eq('user_id', userId)
    .eq('period', 'monthly');

  // Get savings goals
  const { data: goalsData } = await supabase
    .from('savings_goals')
    .select('*')
    .eq('user_id', userId);

  // Calculate totals
  const totalIncome = (incomeData || []).reduce((sum: number, inc: any) => sum + Number(inc.amount), 0);
  const totalExpenses = (expensesData || []).reduce((sum: number, exp: any) => sum + Number(exp.amount), 0);

  // Group expenses by category
  const expensesByCategory: Record<string, number> = {};
  (expensesData || []).forEach((exp: any) => {
    expensesByCategory[exp.category] = (expensesByCategory[exp.category] || 0) + Number(exp.amount);
  });

  // Group income by source
  const incomeBySource: Record<string, number> = {};
  (incomeData || []).forEach((inc: any) => {
    incomeBySource[inc.source] = (incomeBySource[inc.source] || 0) + Number(inc.amount);
  });

  // Calculate budget status
  const budgets = (budgetsData || []).map((b: any) => ({
    category: b.category,
    amount: Number(b.amount),
    spent: expensesByCategory[b.category] || 0,
  }));

  // Calculate goals progress
  const goals = (goalsData || []).map((g: any) => ({
    name: g.name,
    target: Number(g.target_amount),
    current: Number(g.current_amount),
    progress: g.target_amount > 0 ? (g.current_amount / g.target_amount) * 100 : 0,
  }));

  return {
    totalIncome,
    totalExpenses,
    savings: totalIncome - totalExpenses,
    expensesByCategory,
    incomeBySource,
    budgets,
    goals,
  };
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get request body for optional user filtering
    let targetUserId: string | null = null;
    try {
      const body = await req.json();
      targetUserId = body.userId || null;
    } catch {
      // No body provided, send to all users
    }

    // Calculate previous month's date range
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const startDate = lastMonth.toISOString().split('T')[0];
    const endDate = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
    const monthName = lastMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    // Get users to send reports to
    let usersQuery = supabase.from('profiles').select('id, email, full_name, display_name');
    if (targetUserId) {
      usersQuery = usersQuery.eq('id', targetUserId);
    }
    
    const { data: users, error: usersError } = await usersQuery;

    if (usersError) {
      throw new Error(`Failed to fetch users: ${usersError.message}`);
    }

    const results: Array<{ email: string; status: string }> = [];

    for (const user of users || []) {
      if (!user.email) continue;

      try {
        const financialData = await getFinancialData(supabase, user.id, startDate, endDate);
        const userName = user.display_name || user.full_name || 'User';
        const htmlContent = generateReportHTML(financialData, userName, monthName);

        const emailResponse = await sendEmail(
          user.email,
          `📊 Your Monthly Financial Report - ${monthName}`,
          htmlContent
        );

        console.log(`Report sent to ${user.email}:`, emailResponse);
        results.push({ email: user.email, status: 'sent' });
      } catch (error: any) {
        console.error(`Failed to send report to ${user.email}:`, error);
        results.push({ email: user.email, status: `failed: ${error.message}` });
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Monthly reports processed`,
        month: monthName,
        results 
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in monthly-report function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
