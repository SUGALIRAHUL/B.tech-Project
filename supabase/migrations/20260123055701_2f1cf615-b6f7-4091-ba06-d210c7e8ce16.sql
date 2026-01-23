-- Fix security vulnerabilities in email_otp table
-- The edge functions use service role key which bypasses RLS, so we can restrict direct table access

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Anyone can create OTP for verification" ON public.email_otp;
DROP POLICY IF EXISTS "Anyone can verify OTP" ON public.email_otp;
DROP POLICY IF EXISTS "Anyone can update OTP verification" ON public.email_otp;
DROP POLICY IF EXISTS "Anyone can delete expired OTPs" ON public.email_otp;

-- Create restrictive policies that block direct client access
-- All OTP operations must go through edge functions which use service role key

-- No direct INSERT from client - edge functions handle this
CREATE POLICY "No direct OTP creation" ON public.email_otp
FOR INSERT WITH CHECK (false);

-- No direct SELECT from client - prevents OTP code exposure
CREATE POLICY "No direct OTP reading" ON public.email_otp
FOR SELECT USING (false);

-- No direct UPDATE from client - prevents unauthorized verification
CREATE POLICY "No direct OTP updates" ON public.email_otp
FOR UPDATE USING (false);

-- Allow deletion of expired OTPs only (cleanup)
CREATE POLICY "Cleanup expired OTPs only" ON public.email_otp
FOR DELETE USING (expires_at < now());