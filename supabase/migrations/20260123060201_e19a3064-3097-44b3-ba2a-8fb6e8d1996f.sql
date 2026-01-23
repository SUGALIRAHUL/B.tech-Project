-- Create rate limiting table for OTP requests
CREATE TABLE IF NOT EXISTS public.otp_rate_limits (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL,
  action text NOT NULL, -- 'send' or 'verify'
  attempts integer NOT NULL DEFAULT 1,
  first_attempt_at timestamp with time zone NOT NULL DEFAULT now(),
  last_attempt_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create unique constraint on email + action
CREATE UNIQUE INDEX IF NOT EXISTS otp_rate_limits_email_action_idx ON public.otp_rate_limits (email, action);

-- Enable RLS - only edge functions with service role can access
ALTER TABLE public.otp_rate_limits ENABLE ROW LEVEL SECURITY;

-- No direct access - only via edge functions with service role key
CREATE POLICY "No direct access to rate limits" ON public.otp_rate_limits
FOR ALL USING (false);

-- Create function to clean up old rate limit records (older than 1 hour)
CREATE OR REPLACE FUNCTION public.cleanup_old_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.otp_rate_limits 
  WHERE first_attempt_at < NOW() - INTERVAL '1 hour';
END;
$$;