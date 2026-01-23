import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface VerifyOtpRequest {
  email: string;
  otp: string;
  type: "login" | "signup";
}

// Rate limiting constants
const MAX_VERIFY_ATTEMPTS = 5; // Max verification attempts per email per OTP
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes in milliseconds

async function checkVerifyRateLimit(
  supabase: any,
  email: string
): Promise<{ allowed: boolean; attemptsRemaining: number }> {
  const normalizedEmail = email.toLowerCase();
  const action = "verify";
  
  // Get or create rate limit record
  const { data: existing } = await supabase
    .from("otp_rate_limits")
    .select("*")
    .eq("email", normalizedEmail)
    .eq("action", action)
    .single();

  const now = new Date();

  if (!existing) {
    // First attempt - create new record
    await supabase.from("otp_rate_limits").insert({
      email: normalizedEmail,
      action,
      attempts: 1,
      first_attempt_at: now.toISOString(),
      last_attempt_at: now.toISOString(),
    });
    return { allowed: true, attemptsRemaining: MAX_VERIFY_ATTEMPTS - 1 };
  }

  const firstAttempt = new Date(existing.first_attempt_at);
  const timeSinceFirst = now.getTime() - firstAttempt.getTime();

  // Reset if window has passed
  if (timeSinceFirst > RATE_LIMIT_WINDOW_MS) {
    await supabase
      .from("otp_rate_limits")
      .update({
        attempts: 1,
        first_attempt_at: now.toISOString(),
        last_attempt_at: now.toISOString(),
      })
      .eq("id", existing.id);
    return { allowed: true, attemptsRemaining: MAX_VERIFY_ATTEMPTS - 1 };
  }

  // Check if limit exceeded
  if (existing.attempts >= MAX_VERIFY_ATTEMPTS) {
    console.log(`Verify rate limit exceeded for ${normalizedEmail}`);
    return { allowed: false, attemptsRemaining: 0 };
  }

  // Increment attempt counter
  await supabase
    .from("otp_rate_limits")
    .update({
      attempts: existing.attempts + 1,
      last_attempt_at: now.toISOString(),
    })
    .eq("id", existing.id);

  return { allowed: true, attemptsRemaining: MAX_VERIFY_ATTEMPTS - existing.attempts - 1 };
}

async function clearVerifyRateLimit(supabase: any, email: string): Promise<void> {
  await supabase
    .from("otp_rate_limits")
    .delete()
    .eq("email", email.toLowerCase())
    .eq("action", "verify");
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, otp, type }: VerifyOtpRequest = await req.json();

    if (!email || !otp) {
      return new Response(
        JSON.stringify({ error: "Email and OTP are required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Validate OTP format (8 alphanumeric characters)
    const otpRegex = /^[A-Z0-9]{6,8}$/i;
    if (!otpRegex.test(otp)) {
      return new Response(
        JSON.stringify({ error: "Invalid OTP format" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log(`Verifying OTP for ${email}, type: ${type}`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check rate limit first
    const rateLimit = await checkVerifyRateLimit(supabase, email);
    if (!rateLimit.allowed) {
      // Delete the OTP to force user to request a new one
      await supabase
        .from("email_otp")
        .delete()
        .eq("email", email.toLowerCase())
        .eq("type", type);
      
      return new Response(
        JSON.stringify({ 
          error: "Too many failed attempts. Please request a new OTP.",
          locked: true
        }),
        {
          status: 429,
          headers: { 
            "Content-Type": "application/json",
            "Retry-After": "900",
            ...corsHeaders 
          },
        }
      );
    }

    // Find the OTP record
    const { data: otpRecord, error: fetchError } = await supabase
      .from("email_otp")
      .select("*")
      .eq("email", email.toLowerCase())
      .eq("type", type)
      .eq("verified", false)
      .single();

    if (fetchError || !otpRecord) {
      console.log("OTP not found:", fetchError);
      return new Response(
        JSON.stringify({ 
          error: "Invalid or expired OTP",
          attemptsRemaining: rateLimit.attemptsRemaining
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Check if OTP is expired
    if (new Date(otpRecord.expires_at) < new Date()) {
      // Delete expired OTP
      await supabase.from("email_otp").delete().eq("id", otpRecord.id);
      // Clear rate limit for this email
      await clearVerifyRateLimit(supabase, email);
      
      return new Response(
        JSON.stringify({ error: "OTP has expired. Please request a new one." }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Verify OTP code (case-insensitive comparison)
    if (otpRecord.otp_code.toUpperCase() !== otp.toUpperCase()) {
      return new Response(
        JSON.stringify({ 
          error: "Invalid OTP code",
          attemptsRemaining: rateLimit.attemptsRemaining
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Mark OTP as verified
    await supabase
      .from("email_otp")
      .update({ verified: true })
      .eq("id", otpRecord.id);

    // Clear rate limit on successful verification
    await clearVerifyRateLimit(supabase, email);

    console.log("OTP verified successfully");

    return new Response(
      JSON.stringify({ success: true, message: "OTP verified successfully" }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in verify-otp function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to verify OTP" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
