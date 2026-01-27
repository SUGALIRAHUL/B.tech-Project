import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestBody = await req.json();
    
    // Validate input
    const tutorSchema = z.object({
      messages: z.array(z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(5000, 'Message content too long')
      })).min(1, 'At least one message required').max(50, 'Too many messages'),
      type: z.enum(['chat', 'quiz']).optional().default('chat')
    });

    const validationResult = tutorSchema.safeParse(requestBody);
    if (!validationResult.success) {
      return new Response(JSON.stringify({ 
        error: 'Invalid input', 
        details: validationResult.error.issues 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { messages, type } = validationResult.data;
    const authHeader = req.headers.get('Authorization')!;
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get user's profile and knowledge level
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('knowledge_level, profession, country, city')
      .eq('id', user.id)
      .single();

    const knowledgeLevel = profile?.knowledge_level || 'beginner';
    const userProfession = profile?.profession || 'professional';
    const userLocation = profile?.country ? `${profile.city || ''}, ${profile.country}`.trim() : 'global';

    // Fetch user's actual financial data for personalized advice
    const currentDate = new Date();
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString();
    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).toISOString();

    const [incomeData, expenseData, budgetData, goalsData, investmentData] = await Promise.all([
      supabaseClient
        .from('income')
        .select('amount, source, frequency')
        .eq('user_id', user.id),
      supabaseClient
        .from('expenses')
        .select('amount, category, date')
        .eq('user_id', user.id)
        .gte('date', startOfMonth)
        .lte('date', endOfMonth),
      supabaseClient
        .from('budgets')
        .select('amount, category, period')
        .eq('user_id', user.id),
      supabaseClient
        .from('savings_goals')
        .select('name, target_amount, current_amount, deadline')
        .eq('user_id', user.id),
      supabaseClient
        .from('investments')
        .select('name, type, amount, current_value, purchase_price')
        .eq('user_id', user.id)
    ]);

    // Calculate financial summary
    const totalMonthlyIncome = (incomeData.data || []).reduce((sum, inc) => {
      const multiplier = inc.frequency === 'weekly' ? 4 : inc.frequency === 'bi-weekly' ? 2 : 1;
      return sum + (inc.amount * multiplier);
    }, 0);

    const totalMonthlyExpenses = (expenseData.data || []).reduce((sum, exp) => sum + exp.amount, 0);
    const totalBudgeted = (budgetData.data || []).reduce((sum, b) => sum + b.amount, 0);
    const totalInvestmentValue = (investmentData.data || []).reduce((sum, inv) => sum + inv.current_value, 0);
    const totalInvestmentCost = (investmentData.data || []).reduce((sum, inv) => sum + inv.amount, 0);
    const investmentReturn = totalInvestmentCost > 0 ? ((totalInvestmentValue - totalInvestmentCost) / totalInvestmentCost * 100).toFixed(1) : 0;

    const expensesByCategory: Record<string, number> = {};
    (expenseData.data || []).forEach(exp => {
      expensesByCategory[exp.category] = (expensesByCategory[exp.category] || 0) + exp.amount;
    });

    const goalsProgress = (goalsData.data || []).map(g => ({
      name: g.name,
      progress: g.target_amount > 0 ? Math.round((g.current_amount / g.target_amount) * 100) : 0,
      remaining: g.target_amount - g.current_amount,
      deadline: g.deadline
    }));

    const investmentsByType: Record<string, number> = {};
    (investmentData.data || []).forEach(inv => {
      investmentsByType[inv.type] = (investmentsByType[inv.type] || 0) + inv.current_value;
    });

    // Build comprehensive financial context
    const financialContext = `
USER'S CURRENT FINANCIAL SNAPSHOT (as of ${currentDate.toLocaleDateString()}):

📊 INCOME & CASH FLOW:
- Monthly Income: ₹${totalMonthlyIncome.toLocaleString()}
- Monthly Expenses (this month): ₹${totalMonthlyExpenses.toLocaleString()}
- Monthly Surplus/Deficit: ₹${(totalMonthlyIncome - totalMonthlyExpenses).toLocaleString()}
- Savings Rate: ${totalMonthlyIncome > 0 ? ((totalMonthlyIncome - totalMonthlyExpenses) / totalMonthlyIncome * 100).toFixed(1) : 0}%

📈 SPENDING BREAKDOWN (This Month):
${Object.entries(expensesByCategory).map(([cat, amt]) => `- ${cat}: ₹${amt.toLocaleString()}`).join('\n') || '- No expenses recorded yet'}

💰 BUDGETS SET:
${(budgetData.data || []).map(b => `- ${b.category}: ₹${b.amount.toLocaleString()} (${b.period})`).join('\n') || '- No budgets set yet'}

🎯 SAVINGS GOALS:
${goalsProgress.map(g => `- ${g.name}: ${g.progress}% complete, ₹${g.remaining.toLocaleString()} remaining${g.deadline ? `, deadline: ${new Date(g.deadline).toLocaleDateString()}` : ''}`).join('\n') || '- No savings goals set yet'}

📊 INVESTMENT PORTFOLIO:
- Total Invested: ₹${totalInvestmentCost.toLocaleString()}
- Current Value: ₹${totalInvestmentValue.toLocaleString()}
- Overall Return: ${investmentReturn}%
- Portfolio Allocation:
${Object.entries(investmentsByType).map(([type, value]) => `  • ${type}: ₹${value.toLocaleString()} (${totalInvestmentValue > 0 ? (value / totalInvestmentValue * 100).toFixed(1) : 0}%)`).join('\n') || '  • No investments yet'}

USER PROFILE:
- Knowledge Level: ${knowledgeLevel}
- Profession: ${userProfession}
- Location: ${userLocation}
`;

    let systemPrompt = '';
    if (type === 'chat') {
      systemPrompt = `You are PERSFIN AI, a highly professional and experienced Certified Financial Planner (CFP) with 20+ years of expertise in personal finance, wealth management, and financial education. You combine academic knowledge with real-world practical experience.

${financialContext}

YOUR EXPERTISE AREAS:
1. **Budgeting & Cash Flow Management**: Zero-based budgeting, 50/30/20 rule, envelope method, expense tracking
2. **Investment Strategy**: Asset allocation, diversification, index funds vs active funds, SIPs, mutual funds, stocks, bonds, ETFs, REITs
3. **Tax Planning**: Tax-saving instruments (80C, 80D, HRA), capital gains optimization, tax-loss harvesting
4. **Retirement Planning**: EPF, PPF, NPS, retirement corpus calculation, FIRE movement strategies
5. **Debt Management**: Debt avalanche vs snowball, loan restructuring, credit score improvement
6. **Insurance**: Term life, health insurance, adequate coverage calculation, avoiding over-insurance
7. **Emergency Funds**: 3-6 months expense calculation, liquidity management
8. **Real Estate**: Rent vs buy analysis, home loan optimization, property investment

TEACHING APPROACH BY LEVEL:
${knowledgeLevel === 'beginner' ? `
- Use simple, jargon-free language
- Explain concepts with everyday analogies
- Provide step-by-step action items
- Use examples with small, relatable numbers
- Focus on foundational habits first` : knowledgeLevel === 'intermediate' ? `
- Use moderate financial terminology with brief explanations
- Discuss strategies and their trade-offs
- Provide comparative analysis between options
- Include relevant calculations and ratios
- Connect concepts to broader financial planning` : `
- Use professional financial terminology freely
- Discuss advanced strategies and edge cases
- Include detailed quantitative analysis
- Reference market research and studies
- Discuss portfolio theory and optimization`}

RESPONSE GUIDELINES:
1. **Personalize**: Always reference the user's actual financial data when relevant
2. **Be Actionable**: End responses with specific, numbered action steps they can take TODAY
3. **Use Real Numbers**: Calculate using their actual income, expenses, and goals
4. **Cite Benchmarks**: Compare to industry standards (e.g., "The average savings rate in India is 30%, you're at X%")
5. **Risk Awareness**: Always mention risks and disclaimers for investment advice
6. **Local Context**: Consider Indian tax laws, investment options (SIPs, PPF, ELSS), and economic context
7. **Holistic View**: Connect advice to their overall financial picture

FORMAT YOUR RESPONSES:
- Use **bold** for key terms and important numbers
- Use bullet points for lists and action items
- Include relevant calculations when helpful
- Structure long responses with clear headings
- End complex topics with a summary

IMPORTANT DISCLAIMERS:
- For investment advice, remind users that past performance doesn't guarantee future returns
- Recommend consulting a registered financial advisor for major decisions
- Clarify that you're providing educational guidance, not personalized investment recommendations

Remember: You're not just teaching concepts—you're helping build real financial wellness. Every response should move them closer to their financial goals.`;
    } else if (type === 'quiz') {
      systemPrompt = `You are a quiz generator for personal finance education. The user's level is ${knowledgeLevel} and their profession is ${userProfession}.

Generate a quiz with 5 multiple-choice questions appropriate for their level. Questions should be:
- Practical and scenario-based for real-world application
- Relevant to Indian financial context (tax laws, investment options like SIPs, PPF, etc.)
- Progressive in difficulty
- Include calculation-based questions for intermediate/advanced levels

Return the quiz in this exact JSON format:
{
  "questions": [
    {
      "question": "Question text here?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctIndex": 0,
      "explanation": "Detailed explanation of why this answer is correct and why others are wrong"
    }
  ]
}`;
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Use a more capable model for better financial advice
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages
        ],
        stream: type === 'chat',
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Service temporarily unavailable. Please try again later.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'Service unavailable. Please contact support.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      console.error('AI gateway error:', response.status, await response.text());
      return new Response(JSON.stringify({ error: 'An error occurred. Please try again.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (type === 'chat') {
      return new Response(response.body, {
        headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
      });
    } else {
      const data = await response.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } catch (error) {
    console.error('Error in ai-tutor function:', error);
    return new Response(JSON.stringify({ error: 'An error occurred. Please try again.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
