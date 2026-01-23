import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SendOtpRequest {
  email: string;
  type: "login" | "signup";
}

// Rate limiting constants
const MAX_SEND_ATTEMPTS = 3; // Max OTP sends per email per hour
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour in milliseconds

function generateOtp(): string {
  // Generate 8-character alphanumeric OTP for better security
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Excluding similar chars like 0/O, 1/I
  let otp = "";
  for (let i = 0; i < 8; i++) {
    otp += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return otp;
}

async function checkRateLimit(
  supabase: any,
  email: string,
  action: string
): Promise<{ allowed: boolean; remaining: number }> {
  const normalizedEmail = email.toLowerCase();
  
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
    return { allowed: true, remaining: MAX_SEND_ATTEMPTS - 1 };
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
    return { allowed: true, remaining: MAX_SEND_ATTEMPTS - 1 };
  }

  // Check if limit exceeded
  if (existing.attempts >= MAX_SEND_ATTEMPTS) {
    const waitTime = Math.ceil((RATE_LIMIT_WINDOW_MS - timeSinceFirst) / 60000);
    console.log(`Rate limit exceeded for ${normalizedEmail}. Wait ${waitTime} minutes.`);
    return { allowed: false, remaining: 0 };
  }

  // Increment attempt counter
  await supabase
    .from("otp_rate_limits")
    .update({
      attempts: existing.attempts + 1,
      last_attempt_at: now.toISOString(),
    })
    .eq("id", existing.id);

  return { allowed: true, remaining: MAX_SEND_ATTEMPTS - existing.attempts - 1 };
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, type }: SendOtpRequest = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: "Invalid email format" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check rate limit
    const rateLimit = await checkRateLimit(supabase, email, `send_${type}`);
    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({ 
          error: "Too many OTP requests. Please try again later.",
          retryAfter: 60 // minutes
        }),
        {
          status: 429,
          headers: { 
            "Content-Type": "application/json", 
            "Retry-After": "3600",
            ...corsHeaders 
          },
        }
      );
    }

    // For login type, verify the user exists first (prevents email enumeration)
    if (type === "login") {
      const { data: users } = await supabase.auth.admin.listUsers();
      const userExists = users?.users?.some(
        (u) => u.email?.toLowerCase() === email.toLowerCase()
      );
      
      // Always return success to prevent email enumeration
      // But only actually send email if user exists
      if (!userExists) {
        console.log(`Login OTP requested for non-existent email: ${email}`);
        // Return success but don't actually send email
        return new Response(
          JSON.stringify({ success: true, message: "OTP sent if email exists" }),
          {
            status: 200,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }
    }

    console.log(`Generating OTP for ${email}, type: ${type}`);

    // Generate 8-character alphanumeric OTP
    const otpCode = generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

    // Delete any existing OTPs for this email
    await supabase
      .from("email_otp")
      .delete()
      .eq("email", email.toLowerCase())
      .eq("type", type);

    // Store OTP in database
    const { error: insertError } = await supabase.from("email_otp").insert({
      email: email.toLowerCase(),
      otp_code: otpCode,
      type,
      expires_at: expiresAt.toISOString(),
      verified: false,
    });

    if (insertError) {
      console.error("Error storing OTP:", insertError);
      throw new Error("Failed to generate OTP");
    }

    // Send OTP email using Resend API
    const subject = type === "login" 
      ? "Your PERSFIN Login Verification Code" 
      : "Verify Your Email - PERSFIN";
    
    const message = type === "login"
      ? `Your login verification code is: <strong>${otpCode}</strong>. This code will expire in 10 minutes.`
      : `Your email verification code is: <strong>${otpCode}</strong>. Enter this code to complete your registration. This code will expire in 10 minutes.`;

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "PERSFIN <noreply@persfin.com>",
        to: [email],
        subject,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px; }
              .container { max-width: 500px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
              .header { text-align: center; margin-bottom: 30px; }
              .header h1 { color: #7c3aed; margin: 0; }
              .otp-box { background: linear-gradient(135deg, #7c3aed, #ec4899); color: white; font-size: 28px; letter-spacing: 6px; text-align: center; padding: 20px; border-radius: 8px; margin: 20px 0; font-family: monospace; }
              .message { color: #666; line-height: 1.6; }
              .footer { text-align: center; color: #999; font-size: 12px; margin-top: 30px; }
              .security-note { background: #fef3cd; border: 1px solid #ffc107; padding: 10px; border-radius: 5px; margin-top: 20px; font-size: 12px; color: #856404; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>PERSFIN</h1>
                <p style="color: #666;">Your Personal Finance Companion</p>
              </div>
              <p class="message">${message}</p>
              <div class="otp-box">${otpCode}</div>
              <div class="security-note">
                <strong>Security Notice:</strong> Never share this code with anyone. PERSFIN will never ask for this code via phone or message.
              </div>
              <p class="message">If you didn't request this code, please ignore this email and consider securing your account.</p>
              <div class="footer">
                <p>&copy; ${new Date().getFullYear()} PERSFIN. All rights reserved.</p>
              </div>
            </div>
          </body>
          </html>
        `,
      }),
    });

    const emailResult = await emailResponse.json();
    console.log("Email sent:", emailResult);

    if (!emailResponse.ok) {
      throw new Error(emailResult.message || "Failed to send email");
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "OTP sent successfully",
        remaining: rateLimit.remaining 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-otp function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to send OTP" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
