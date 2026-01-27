import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Bot, User, History, Plus, Trash2, MessageSquare } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { FormattedMessage } from "@/components/FormattedMessage";
import DOMPurify from 'dompurify';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type Conversation = {
  id: string;
  title: string;
  created_at: string;
};

export default function Tutor() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: `👋 **Welcome to PERSFIN AI - Your Personal Finance Advisor**

I'm your AI-powered Certified Financial Planner with expertise in:

• **Budgeting & Cash Flow** - Optimize your spending habits
• **Investment Strategy** - SIPs, Mutual Funds, Stocks, ETFs
• **Tax Planning** - Maximize savings under 80C, 80D, HRA
• **Retirement Planning** - EPF, PPF, NPS, FIRE strategies
• **Debt Management** - Smart payoff strategies
• **Goal-Based Planning** - Personalized roadmaps

I have access to your financial data, so I can provide **personalized advice** based on your actual income, expenses, investments, and goals.

**Try asking me:**
- "Analyze my current spending and suggest improvements"
- "How much should I invest monthly to retire by 50?"
- "Is my emergency fund adequate?"
- "Review my investment portfolio allocation"

What would you like to work on today?`,
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    fetchConversations();
  }, []);

  const fetchConversations = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("chat_conversations")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    if (!error && data) {
      setConversations(data);
    }
  };

  const loadConversation = async (conversationId: string) => {
    const { data, error } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (!error && data) {
      setMessages(data.map(msg => ({ role: msg.role as "user" | "assistant", content: msg.content })));
      setCurrentConversationId(conversationId);
      setHistoryOpen(false);
    }
  };

  const startNewConversation = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setMessages([
      {
        role: "assistant",
        content: `👋 **Welcome to PERSFIN AI - Your Personal Finance Advisor**

I'm your AI-powered Certified Financial Planner with expertise in:

• **Budgeting & Cash Flow** - Optimize your spending habits
• **Investment Strategy** - SIPs, Mutual Funds, Stocks, ETFs
• **Tax Planning** - Maximize savings under 80C, 80D, HRA
• **Retirement Planning** - EPF, PPF, NPS, FIRE strategies
• **Debt Management** - Smart payoff strategies
• **Goal-Based Planning** - Personalized roadmaps

I have access to your financial data, so I can provide **personalized advice** based on your actual income, expenses, investments, and goals.

**Try asking me:**
- "Analyze my current spending and suggest improvements"
- "How much should I invest monthly to retire by 50?"
- "Is my emergency fund adequate?"
- "Review my investment portfolio allocation"

What would you like to work on today?`,
      },
    ]);
    setCurrentConversationId(null);
    setHistoryOpen(false);
  };

  const deleteConversation = async (conversationId: string) => {
    const { error } = await supabase
      .from("chat_conversations")
      .delete()
      .eq("id", conversationId);

    if (!error) {
      setConversations(prev => prev.filter(c => c.id !== conversationId));
      if (currentConversationId === conversationId) {
        startNewConversation();
      }
      toast({ title: "Conversation deleted" });
    }
  };

  const saveMessage = async (conversationId: string, role: "user" | "assistant", content: string) => {
    await supabase.from("chat_messages").insert({
      conversation_id: conversationId,
      role,
      content,
    });
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const sanitizedInput = DOMPurify.sanitize(input, { 
      ALLOWED_TAGS: [],
      KEEP_CONTENT: true 
    });
    
    const userMessage: Message = { role: "user", content: sanitizedInput };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          variant: "destructive",
          title: "Authentication required",
          description: "Please log in to use the AI tutor",
        });
        return;
      }

      // Create or get conversation
      let conversationId = currentConversationId;
      if (!conversationId) {
        const title = sanitizedInput.slice(0, 50) + (sanitizedInput.length > 50 ? "..." : "");
        const { data: newConv, error } = await supabase
          .from("chat_conversations")
          .insert({
            user_id: session.user.id,
            title,
          })
          .select()
          .single();

        if (!error && newConv) {
          conversationId = newConv.id;
          setCurrentConversationId(conversationId);
          setConversations(prev => [newConv, ...prev]);
        }
      } else {
        // Update conversation timestamp
        await supabase
          .from("chat_conversations")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", conversationId);
      }

      // Save user message
      if (conversationId) {
        await saveMessage(conversationId, "user", sanitizedInput);
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-tutor`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            messages: [...messages, userMessage],
            type: "chat",
          }),
        }
      );

      if (!response.ok || !response.body) {
        throw new Error("Failed to get response");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";

      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n").filter((line) => line.trim() !== "");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                assistantContent += content;
                setMessages((prev) => {
                  const newMessages = [...prev];
                  newMessages[newMessages.length - 1].content = assistantContent;
                  return newMessages;
                });
              }
            } catch (e) {
              // Ignore parse errors for partial chunks
            }
          }
        }
      }

      // Save assistant message
      if (conversationId && assistantContent) {
        await saveMessage(conversationId, "assistant", assistantContent);
      }

      // Refresh conversations list
      fetchConversations();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to get AI response",
      });
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col animate-in fade-in-50 duration-500">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
          AI Finance Tutor
        </h1>
        <div className="flex gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" onClick={startNewConversation}>
                <Plus className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>New Conversation</TooltipContent>
          </Tooltip>
          <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
            <Tooltip>
              <TooltipTrigger asChild>
                <SheetTrigger asChild>
                  <Button variant="outline" size="icon">
                    <History className="h-4 w-4" />
                  </Button>
                </SheetTrigger>
              </TooltipTrigger>
              <TooltipContent>Chat History</TooltipContent>
            </Tooltip>
            <SheetContent className="w-[350px]">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Chat History
                </SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-2">
                {conversations.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No conversation history yet
                  </p>
                ) : (
                  conversations.map((conv) => (
                    <div
                      key={conv.id}
                      className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                        currentConversationId === conv.id
                          ? "bg-primary/10"
                          : "hover:bg-muted"
                      }`}
                    >
                      <div
                        className="flex-1 min-w-0"
                        onClick={() => loadConversation(conv.id)}
                      >
                        <div className="flex items-center gap-2">
                          <MessageSquare className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <p className="text-sm font-medium truncate">{conv.title}</p>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(conv.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 flex-shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteConversation(conv.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Delete</TooltipContent>
                      </Tooltip>
                    </div>
                  ))
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      <Card className="flex-1 flex flex-col border-0 shadow-lg">
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            Chat with Your Tutor
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col p-0">
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex gap-3 ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  {message.role === "assistant" && (
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Bot className="h-5 w-5 text-primary" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] rounded-lg p-4 ${
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    {message.role === "user" ? (
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    ) : (
                      <FormattedMessage content={message.content} />
                    )}
                  </div>
                  {message.role === "user" && (
                    <div className="h-8 w-8 rounded-full bg-secondary/10 flex items-center justify-center flex-shrink-0">
                      <User className="h-5 w-5 text-secondary" />
                    </div>
                  )}
                </div>
              ))}
              <div ref={scrollRef} />
            </div>
          </ScrollArea>

          <div className="p-4 border-t">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage();
              }}
              className="flex gap-2"
            >
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask anything about personal finance..."
                disabled={loading}
              />
              <Button type="submit" disabled={loading || !input.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
