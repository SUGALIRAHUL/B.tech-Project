import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { z } from "zod";
import { Mail, UserCircle, Loader2 } from "lucide-react";
import { CountryCodeSelector } from "@/components/CountryCodeSelector";
import { CountrySelector } from "@/components/CountrySelector";
import { CitySelector } from "@/components/CitySelector";
import { PasswordInput } from "@/components/PasswordInput";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { getMaxDigits, getPhoneLengthHint, isValidPhoneLength, formatPhoneNumber, getFormatPlaceholder, stripPhoneFormatting } from "@/lib/phone-validation";

const signupSchema = z.object({
  email: z.string().email('Invalid email address').max(255, 'Email too long'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain an uppercase letter')
    .regex(/[a-z]/, 'Password must contain a lowercase letter')
    .regex(/[0-9]/, 'Password must contain a number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain a special character'),
  fullName: z.string()
    .trim()
    .min(1, 'Name required')
    .max(100, 'Name too long')
    .regex(/^[a-zA-Z\s\-']+$/, 'Name contains invalid characters'),
  displayName: z.string()
    .trim()
    .min(1, 'Display name required')
    .max(50, 'Display name too long'),
  mobileNumber: z.string()
    .trim()
    .min(1, 'Phone number is required')
    .max(20, 'Phone number too long'),
  profession: z.string()
    .trim()
    .min(1, 'Profession required')
    .max(100, 'Profession too long'),
  city: z.string()
    .trim()
    .min(1, 'City required')
    .max(100, 'City too long'),
  country: z.string()
    .trim()
    .min(1, 'Country required')
    .max(100, 'Country too long'),
  dateOfBirth: z.string()
    .refine((date) => {
      const d = new Date(date);
      return d instanceof Date && !isNaN(d.getTime());
    }, 'Invalid date'),
  bio: z.string()
    .trim()
    .max(500, 'Bio too long')
    .optional()
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address').max(255, 'Email too long'),
  password: z.string().min(1, 'Password required')
});

type AuthStep = 'credentials' | 'otp';
type SignupStep = 'email-verify' | 'details' | 'complete';

export default function Auth() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [countryCode, setCountryCode] = useState("+1");
  const [countryName, setCountryName] = useState("United States");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [profession, setProfession] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [bio, setBio] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [isPasswordReset, setIsPasswordReset] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  // OTP states
  const [loginStep, setLoginStep] = useState<AuthStep>('credentials');
  const [signupStep, setSignupStep] = useState<SignupStep>('email-verify');
  const [otp, setOtp] = useState("");
  const [signupOtp, setSignupOtp] = useState("");
  const [signupData, setSignupData] = useState<any>(null);
  const [demoOtp, setDemoOtp] = useState<string | null>(null); // Demo mode OTP display

  const extractFunctionErrorMessage = async (err: any): Promise<string> => {
    // supabase-js Functions errors often include a Response in `context`.
    // We try to parse it so users see the real server message.
    try {
      const ctx = err?.context;
      const res: any =
        ctx instanceof Response
          ? ctx
          : ctx?.response instanceof Response
            ? ctx.response
            : ctx;

      if (res && typeof res.clone === "function" && typeof res.json === "function") {
        const body = await res.clone().json().catch(() => null);
        const msg = body?.error || body?.message;
        if (typeof msg === "string" && msg.trim().length > 0) return msg;
      }
    } catch {
      // ignore parse errors
    }

    const fallback = err?.message || "Something went wrong. Please try again.";
    return typeof fallback === "string" ? fallback : "Something went wrong. Please try again.";
  };

  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const type = hashParams.get('type');
    
    if (type === 'recovery') {
      setIsPasswordReset(true);
    }
  }, []);

  const sendOtp = async (targetEmail: string, type: 'login' | 'signup') => {
    try {
      const { data, error } = await supabase.functions.invoke('send-otp', {
        body: { email: targetEmail, type }
      });
      
      if (error) throw error;
      
      // Check for demo mode OTP
      if (data?.demoMode && data?.otp) {
        setDemoOtp(data.otp);
        return { success: true, demoMode: true, otp: data.otp };
      }
      
      setDemoOtp(null);
      return { success: true };
    } catch (error: any) {
      console.error('Error sending OTP:', error);
      const message = await extractFunctionErrorMessage(error);
      return { success: false, error: message };
    }
  };

  const verifyOtp = async (targetEmail: string, otpCode: string, type: 'login' | 'signup') => {
    try {
      const { data, error } = await supabase.functions.invoke('verify-otp', {
        body: { email: targetEmail, otp: otpCode, type }
      });
      
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return { success: true };
    } catch (error: any) {
      console.error('Error verifying OTP:', error);
      const message = await extractFunctionErrorMessage(error);
      return { success: false, error: message };
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validation = loginSchema.safeParse({ email, password });
    if (!validation.success) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: validation.error.errors[0].message,
      });
      return;
    }

    setLoading(true);

    // First verify credentials
    const { error } = await supabase.auth.signInWithPassword({
      email: validation.data.email,
      password: validation.data.password,
    });

    if (error) {
      console.error('Auth error:', error.code, error.message);
      toast({
        variant: "destructive",
        title: "Authentication failed",
        description: "Invalid email or password. Please try again.",
      });
      setLoading(false);
      return;
    }

    // Sign out temporarily to require OTP verification
    await supabase.auth.signOut();

    // Send OTP
    const result = await sendOtp(validation.data.email, 'login');
    
    if (!result.success) {
      toast({
        variant: "destructive",
        title: "Error",
        description: result.error || "Failed to send verification code",
      });
      setLoading(false);
      return;
    }

    toast({
      title: "Verification Code Sent",
      description: "Please check your email for the 8-character code.",
    });
    
    setLoginStep('otp');
    setLoading(false);
  };

  const handleLoginOtpVerify = async () => {
    if (otp.length !== 8) {
      toast({
        variant: "destructive",
        title: "Invalid Code",
        description: "Please enter the complete 8-character code.",
      });
      return;
    }

    setLoading(true);

    const result = await verifyOtp(email, otp, 'login');
    
    if (!result.success) {
      toast({
        variant: "destructive",
        title: "Verification Failed",
        description: result.error || "Invalid or expired code.",
      });
      setLoading(false);
      return;
    }

    // Now actually sign in
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      toast({
        variant: "destructive",
        title: "Login Failed",
        description: "Unable to complete login. Please try again.",
      });
      setLoginStep('credentials');
    } else {
      toast({
        title: "Welcome back!",
        description: "You have successfully logged in.",
      });
      navigate("/dashboard");
    }

    setLoading(false);
  };

  const handleSendSignupOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !z.string().email().safeParse(email).success) {
      toast({
        variant: "destructive",
        title: "Invalid Email",
        description: "Please enter a valid email address.",
      });
      return;
    }

    setLoading(true);

    const result = await sendOtp(email, 'signup');
    
    if (!result.success) {
      toast({
        variant: "destructive",
        title: "Error",
        description: result.error || "Failed to send verification code",
      });
      setLoading(false);
      return;
    }

    toast({
      title: "Verification Code Sent",
      description: "Please check your email for the 8-character code.",
    });
    
    setSignupStep('details');
    setLoading(false);
  };

  const handleVerifySignupOtp = async () => {
    if (signupOtp.length !== 8) {
      toast({
        variant: "destructive",
        title: "Invalid Code",
        description: "Please enter the complete 8-character code.",
      });
      return;
    }

    setLoading(true);

    const result = await verifyOtp(email, signupOtp, 'signup');
    
    if (!result.success) {
      toast({
        variant: "destructive",
        title: "Verification Failed",
        description: result.error || "Invalid or expired code.",
      });
      setLoading(false);
      return;
    }

    // Now complete the signup
    const mobileNumber = `${countryCode}${phoneNumber}`;
    
    const { data, error } = await supabase.auth.signUp({
      email: signupData.email,
      password: signupData.password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: {
          full_name: signupData.fullName,
          display_name: signupData.displayName,
          mobile_number: mobileNumber,
          profession: signupData.profession,
          city: signupData.city,
          country: signupData.country,
          date_of_birth: signupData.dateOfBirth,
          bio: signupData.bio,
        },
      },
    });

    if (error) {
      console.error('Signup error:', error.code, error.message);
      toast({
        variant: "destructive",
        title: "Account creation failed",
        description: error.message || "Unable to create account. Please try again.",
      });
      setLoading(false);
      return;
    }

    // After successful signup, mark email as confirmed via edge function
    try {
      const { error: confirmError } = await supabase.functions.invoke('confirm-email', {
        body: { email: signupData.email }
      });
      
      if (confirmError) {
        console.error('Error confirming email:', confirmError);
        // Don't fail the signup, just log the error
      }
    } catch (confirmErr) {
      console.error('Error calling confirm-email:', confirmErr);
    }

    toast({
      title: "Account created!",
      description: "Welcome to PERSFIN. You can now log in.",
    });
    setSignupStep('email-verify');
    setEmail("");
    setPassword("");
    setSignupOtp("");

    setLoading(false);
  };

  const handleSignupDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate phone number length for the selected country
    if (!isValidPhoneLength(phoneNumber, countryCode, countryName)) {
      toast({
        variant: "destructive",
        title: "Invalid Phone Number",
        description: `Phone number for ${countryName} must be ${getPhoneLengthHint(countryCode, countryName)}.`,
      });
      return;
    }
    
    const mobileNumber = `${countryCode}${phoneNumber}`;
    
    const validation = signupSchema.safeParse({ 
      email, 
      password, 
      fullName,
      displayName,
      mobileNumber,
      profession,
      city,
      country,
      dateOfBirth,
      bio
    });
    
    if (!validation.success) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: validation.error.errors[0].message,
      });
      return;
    }

    // Store signup data for later
    setSignupData({
      email: validation.data.email,
      password: validation.data.password,
      fullName: validation.data.fullName,
      displayName: validation.data.displayName,
      profession: validation.data.profession,
      city: validation.data.city,
      country: validation.data.country,
      dateOfBirth: validation.data.dateOfBirth,
      bio: validation.data.bio,
    });
    
    setSignupStep('complete');
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!resetEmail) {
      toast({
        variant: "destructive",
        title: "Email required",
        description: "Please enter your email address",
      });
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/auth`,
    });

    if (error) {
      console.error('Password reset error:', error.code, error.message);
    }
    
    setResetSent(true);
    toast({
      title: "Check your email",
      description: "If an account exists with this email, you will receive a password reset link.",
    });

    setLoading(false);
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Passwords do not match",
      });
      return;
    }

    const passwordValidation = signupSchema.shape.password.safeParse(newPassword);
    if (!passwordValidation.success) {
      toast({
        variant: "destructive",
        title: "Weak Password",
        description: passwordValidation.error.errors[0].message,
      });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        console.error('Password update error:', error.code, error.message);
        throw error;
      }

      toast({
        title: "Success",
        description: "Your password has been updated successfully!",
      });

      window.location.hash = '';
      setIsPasswordReset(false);
      setNewPassword("");
      setConfirmPassword("");
      navigate("/dashboard");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Password Update Failed",
        description: "Unable to update your password. Please try again or request a new reset link.",
      });
    } finally {
      setLoading(false);
    }
  };

  const resendOtp = async (type: 'login' | 'signup') => {
    setLoading(true);
    const result = await sendOtp(email, type);
    
    if (result.success) {
      toast({
        title: "Code Resent",
        description: "A new verification code has been sent to your email.",
      });
    } else {
      toast({
        variant: "destructive",
        title: "Error",
        description: result.error || "Failed to resend code.",
      });
    }
    setLoading(false);
  };

  if (isPasswordReset) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/20 via-accent/10 to-secondary/20 p-4">
        <Card className="w-full max-w-md shadow-2xl border-0">
          <CardHeader className="space-y-4">
            <div className="flex justify-center mb-2">
              <UserCircle className="h-24 w-24 text-primary" />
            </div>
            <CardTitle className="text-3xl text-center bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-transparent font-bold">
              Reset Password
            </CardTitle>
            <CardDescription className="text-center">
              Enter your new password below
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordReset} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">
                  New Password <span className="text-destructive">*</span>
                </Label>
                <PasswordInput
                  id="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter your new password"
                  required
                  minLength={8}
                  showStrength
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">
                  Confirm Password <span className="text-destructive">*</span>
                </Label>
                <PasswordInput
                  id="confirm-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  required
                  minLength={8}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Updating..." : "Update Password"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/20 via-accent/10 to-secondary/20 p-4">
      <Card className="w-full max-w-2xl shadow-2xl border-0">
        <CardHeader className="space-y-4">
          <div className="flex justify-center mb-2">
            <UserCircle className="h-24 w-24 text-primary" />
          </div>
          <CardTitle className="text-4xl text-center bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-transparent font-bold">
            PERSFIN
          </CardTitle>
          <CardDescription className="text-center text-base">
            Your personal finance planning companion powered by AI
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="login" onClick={() => { setLoginStep('credentials'); setOtp(''); }}>Login</TabsTrigger>
              <TabsTrigger value="signup" onClick={() => { setSignupStep('email-verify'); setSignupOtp(''); }}>Sign Up</TabsTrigger>
              <TabsTrigger value="forgot">Forgot Password</TabsTrigger>
            </TabsList>
            
            {/* LOGIN TAB */}
            <TabsContent value="login">
              {loginStep === 'credentials' ? (
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">
                      Email <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">
                      Password <span className="text-destructive">*</span>
                    </Label>
                    <PasswordInput
                      id="login-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      "Login"
                    )}
                  </Button>
                </form>
              ) : (
                <div className="space-y-6 py-4">
                  <div className="text-center space-y-2">
                    <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                      <Mail className="h-8 w-8 text-primary" />
                    </div>
                    <h3 className="text-xl font-semibold">Enter Verification Code</h3>
                    <p className="text-muted-foreground text-sm">
                      We sent an 8-character code to <strong>{email}</strong>
                    </p>
                  </div>

                  {/* Demo Mode OTP Display */}
                  {demoOtp && (
                    <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4 text-center">
                      <p className="text-sm text-amber-800 dark:text-amber-200 font-medium mb-1">
                        🎓 Demo Mode - Your OTP Code:
                      </p>
                      <p className="text-2xl font-mono font-bold tracking-widest text-amber-900 dark:text-amber-100">
                        {demoOtp}
                      </p>
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                        (In production, this would be sent to your email)
                      </p>
                    </div>
                  )}
                  
                  <div className="flex justify-center">
                    <InputOTP maxLength={8} value={otp} onChange={setOtp}>
                      <InputOTPGroup>
                        <InputOTPSlot index={0} />
                        <InputOTPSlot index={1} />
                        <InputOTPSlot index={2} />
                        <InputOTPSlot index={3} />
                        <InputOTPSlot index={4} />
                        <InputOTPSlot index={5} />
                        <InputOTPSlot index={6} />
                        <InputOTPSlot index={7} />
                      </InputOTPGroup>
                    </InputOTP>
                  </div>

                  <Button 
                    onClick={handleLoginOtpVerify} 
                    className="w-full" 
                    disabled={loading || otp.length !== 8}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      "Verify & Login"
                    )}
                  </Button>

                  <div className="flex justify-between items-center text-sm">
                    <Button 
                      variant="link" 
                      className="p-0 h-auto"
                      onClick={() => resendOtp('login')}
                      disabled={loading}
                    >
                      Resend Code
                    </Button>
                    <Button 
                      variant="link" 
                      className="p-0 h-auto"
                      onClick={() => { setLoginStep('credentials'); setOtp(''); }}
                    >
                      Back to Login
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>
            
            {/* SIGNUP TAB */}
            <TabsContent value="signup">
              {signupStep === 'email-verify' && (
                <form onSubmit={handleSendSignupOtp} className="space-y-4">
                  <div className="text-center py-4">
                    <h3 className="text-lg font-semibold mb-2">Step 1: Verify Your Email</h3>
                    <p className="text-muted-foreground text-sm">
                      Enter your email address to receive a verification code
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">
                      Email <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending Code...
                      </>
                    ) : (
                      "Send Verification Code"
                    )}
                  </Button>
                </form>
              )}

              {signupStep === 'details' && (
                <form onSubmit={handleSignupDetails} className="space-y-4">
                  <div className="text-center py-2">
                    <h3 className="text-lg font-semibold mb-1">Step 2: Complete Your Profile</h3>
                    <p className="text-muted-foreground text-sm">
                      Fill in your details to create your account
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-name">
                        Full Name <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="signup-name"
                        type="text"
                        placeholder="John Doe"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-display-name">
                        Display Name <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="signup-display-name"
                        type="text"
                        placeholder="Johnny"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">
                      Password <span className="text-destructive">*</span>
                    </Label>
                    <PasswordInput
                      id="signup-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      required
                      minLength={8}
                      showStrength
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-mobile">
                        Mobile Number <span className="text-destructive">*</span>
                      </Label>
                      <div className="flex gap-2">
                        <CountryCodeSelector
                          value={countryCode}
                          onSelect={(code, name) => {
                            setCountryCode(code);
                            setCountryName(name);
                            const max = getMaxDigits(code, name);
                            if (phoneNumber.length > max) {
                              setPhoneNumber(phoneNumber.slice(0, max));
                            }
                          }}
                          disabled={loading}
                        />
                        <Input
                          id="signup-mobile"
                          type="tel"
                          inputMode="tel"
                          placeholder={getFormatPlaceholder(countryCode, countryName)}
                          value={formatPhoneNumber(phoneNumber, countryCode, countryName)}
                          onChange={(e) => {
                            const digits = stripPhoneFormatting(e.target.value);
                            const max = getMaxDigits(countryCode, countryName);
                            setPhoneNumber(digits.slice(0, max));
                          }}
                          required
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {countryName}: {getPhoneLengthHint(countryCode, countryName)}
                        {phoneNumber.length > 0 && (
                          <span className={
                            isValidPhoneLength(phoneNumber, countryCode, countryName) 
                              ? " text-green-600 dark:text-green-400" 
                              : " text-destructive"
                          }>
                            {" "}({phoneNumber.length}/{getMaxDigits(countryCode, countryName)})
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-dob">
                        Date of Birth <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="signup-dob"
                        type="date"
                        value={dateOfBirth}
                        onChange={(e) => setDateOfBirth(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="signup-profession">
                      Profession <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="signup-profession"
                      type="text"
                      placeholder="Software Engineer"
                      value={profession}
                      onChange={(e) => setProfession(e.target.value)}
                      required
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-country">
                        Country <span className="text-destructive">*</span>
                      </Label>
                      <CountrySelector
                        value={country}
                        onValueChange={(value) => {
                          setCountry(value);
                          setCity("");
                        }}
                        disabled={loading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-city">
                        City <span className="text-destructive">*</span>
                      </Label>
                      <CitySelector
                        value={city}
                        onValueChange={setCity}
                        country={country}
                        disabled={loading || !country}
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="signup-bio">Bio (Optional)</Label>
                    <Input
                      id="signup-bio"
                      type="text"
                      placeholder="Tell us about yourself..."
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                    />
                  </div>
                  
                  <div className="flex gap-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      className="flex-1"
                      onClick={() => setSignupStep('email-verify')}
                    >
                      Back
                    </Button>
                    <Button type="submit" className="flex-1" disabled={loading}>
                      Continue
                    </Button>
                  </div>
                </form>
              )}

              {signupStep === 'complete' && (
                <div className="space-y-6 py-4">
                  <div className="text-center space-y-2">
                    <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                      <Mail className="h-8 w-8 text-primary" />
                    </div>
                    <h3 className="text-xl font-semibold">Step 3: Verify Email Code</h3>
                    <p className="text-muted-foreground text-sm">
                      Enter the 8-character code sent to <strong>{email}</strong>
                    </p>
                  </div>

                  {/* Demo Mode OTP Display */}
                  {demoOtp && (
                    <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4 text-center">
                      <p className="text-sm text-amber-800 dark:text-amber-200 font-medium mb-1">
                        🎓 Demo Mode - Your OTP Code:
                      </p>
                      <p className="text-2xl font-mono font-bold tracking-widest text-amber-900 dark:text-amber-100">
                        {demoOtp}
                      </p>
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                        (In production, this would be sent to your email)
                      </p>
                    </div>
                  )}
                  
                  <div className="flex justify-center">
                    <InputOTP maxLength={8} value={signupOtp} onChange={setSignupOtp}>
                      <InputOTPGroup>
                        <InputOTPSlot index={0} />
                        <InputOTPSlot index={1} />
                        <InputOTPSlot index={2} />
                        <InputOTPSlot index={3} />
                        <InputOTPSlot index={4} />
                        <InputOTPSlot index={5} />
                        <InputOTPSlot index={6} />
                        <InputOTPSlot index={7} />
                      </InputOTPGroup>
                    </InputOTP>
                  </div>

                  <Button 
                    onClick={handleVerifySignupOtp} 
                    className="w-full" 
                    disabled={loading || signupOtp.length !== 8}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating Account...
                      </>
                    ) : (
                      "Verify & Create Account"
                    )}
                  </Button>

                  <div className="flex justify-between items-center text-sm">
                    <Button 
                      variant="link" 
                      className="p-0 h-auto"
                      onClick={() => resendOtp('signup')}
                      disabled={loading}
                    >
                      Resend Code
                    </Button>
                    <Button 
                      variant="link" 
                      className="p-0 h-auto"
                      onClick={() => setSignupStep('details')}
                    >
                      Back
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>
            
            {/* FORGOT PASSWORD TAB */}
            <TabsContent value="forgot">
              {resetSent ? (
                <div className="text-center py-6 space-y-4">
                  <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                    <Mail className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold">Check Your Email</h3>
                  <p className="text-muted-foreground">
                    We've sent a password reset link to <strong>{resetEmail}</strong>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Click the link in the email to reset your password. The link will expire in 1 hour.
                  </p>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setResetSent(false);
                      setResetEmail("");
                    }}
                    className="mt-4"
                  >
                    Send Another Link
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="reset-email">
                      Email Address <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="reset-email"
                      type="email"
                      placeholder="your@email.com"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      required
                    />
                    <p className="text-sm text-muted-foreground">
                      Enter your registered email address and we'll send you a link to reset your password.
                    </p>
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Sending..." : "Send Reset Link"}
                  </Button>
                </form>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
