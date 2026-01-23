import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ConfirmEmailRequest {
  email: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email }: ConfirmEmailRequest = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log(`Confirming email for ${email}`);

    // Initialize Supabase admin client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Verify that the email was OTP-verified in our email_otp table
    const { data: otpRecord, error: fetchError } = await supabaseAdmin
      .from("email_otp")
      .select("*")
      .eq("email", email.toLowerCase())
      .eq("type", "signup")
      .eq("verified", true)
      .single();

    if (fetchError || !otpRecord) {
      console.log("OTP not verified for this email:", fetchError);
      return new Response(
        JSON.stringify({ error: "Email not verified via OTP" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Find the user by email using admin API
    const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      console.error("Error listing users:", listError);
      return new Response(
        JSON.stringify({ error: "Failed to find user" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const user = users.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    
    if (!user) {
      console.log("User not found for email:", email);
      return new Response(
        JSON.stringify({ error: "User not found" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Update the user to mark email as confirmed
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      { email_confirm: true }
    );

    if (updateError) {
      console.error("Error confirming email:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to confirm email" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Clean up the OTP record
    await supabaseAdmin
      .from("email_otp")
      .delete()
      .eq("email", email.toLowerCase())
      .eq("type", "signup");

    console.log("Email confirmed successfully for:", email);

    return new Response(
      JSON.stringify({ success: true, message: "Email confirmed successfully" }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in confirm-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to confirm email" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
