import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { User, Key, Mail, Camera, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CountryCodeSelector } from "@/components/CountryCodeSelector";
import { CountrySelector } from "@/components/CountrySelector";
import { CitySelector } from "@/components/CitySelector";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const profileSchema = z.object({
  full_name: z.string().trim().min(1, "Full name is required").max(100, "Full name must be less than 100 characters").regex(/^[a-zA-Z\s'-]+$/, "Full name can only contain letters, spaces, hyphens, and apostrophes"),
  display_name: z.string().trim().min(1, "Display name is required").max(50, "Display name must be less than 50 characters"),
  email: z.string().email(),
  recovery_email: z.string().email("Please enter a valid email address").optional().or(z.literal("")),
  mobile_number: z.string().trim().min(8, "Phone number must be at least 8 characters").max(20, "Phone number too long").optional().or(z.literal("")),
  profession: z.string().trim().max(100, "Profession must be less than 100 characters").optional().or(z.literal("")),
  city: z.string().trim().max(100, "City must be less than 100 characters").optional().or(z.literal("")),
  country: z.string().trim().max(100, "Country must be less than 100 characters").optional().or(z.literal("")),
  date_of_birth: z.string().refine((date) => {
    if (!date) return true;
    const birthDate = new Date(date);
    const today = new Date();
    const age = today.getFullYear() - birthDate.getFullYear();
    return birthDate < today && age >= 13 && age <= 120;
  }, "Please enter a valid date of birth (age must be between 13 and 120)").optional().or(z.literal("")),
  bio: z.string().trim().max(500, "Bio must be less than 500 characters").optional().or(z.literal("")),
});

type ProfileFormData = z.infer<typeof profileSchema>;

export default function Settings() {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  
  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: "",
      display_name: "",
      email: "",
      recovery_email: "",
      mobile_number: "",
      profession: "",
      city: "",
      country: "",
      date_of_birth: "",
      bio: "",
    },
  });

  const watchCountry = form.watch("country");

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    setUserId(session.user.id);

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (error) {
      console.error('Profile fetch error:', error);
      return;
    }

    if (data) {
      setAvatarUrl(data.avatar_url);
      form.reset({
        full_name: data.full_name || "",
        display_name: data.display_name || "",
        email: data.email || "",
        recovery_email: data.recovery_email || "",
        mobile_number: data.mobile_number || "",
        profession: data.profession || "",
        city: data.city || "",
        country: data.country || "",
        date_of_birth: data.date_of_birth || "",
        bio: data.bio || "",
      });
    }
  };

  const onSubmit = async (values: ProfileFormData) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: values.full_name,
        display_name: values.display_name,
        recovery_email: values.recovery_email || null,
        mobile_number: values.mobile_number || null,
        profession: values.profession || null,
        city: values.city || null,
        country: values.country || null,
        date_of_birth: values.date_of_birth || null,
        bio: values.bio || null,
      })
      .eq('id', session.user.id);

    if (error) {
      console.error('Profile update error:', error);
      toast({ variant: "destructive", title: "Failed to update profile" });
    } else {
      toast({ title: "Profile updated successfully!" });
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);

      if (!event.target.files || event.target.files.length === 0) {
        return;
      }

      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();
      const filePath = `${userId}/${Math.random()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', userId);

      if (updateError) {
        throw updateError;
      }

      setAvatarUrl(publicUrl);
      toast({ title: "Profile picture updated successfully!" });
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast({ variant: "destructive", title: "Failed to upload profile picture" });
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteAvatar = async () => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ avatar_url: null })
        .eq('id', userId);

      if (error) throw error;

      setAvatarUrl(null);
      toast({ title: "Profile picture removed successfully!" });
    } catch (error) {
      console.error('Error deleting avatar:', error);
      toast({ variant: "destructive", title: "Failed to remove profile picture" });
    }
  };

  const handlePasswordReset = async () => {
    const email = form.getValues('email');
    if (!email) {
      toast({
        variant: "destructive",
        title: "Email not found",
        description: "Please refresh the page and try again",
      });
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth`,
    });

    if (error) {
      console.error('Password reset error:', error.code, error.message);
    }

    toast({
      title: "Password reset requested",
      description: "If an account exists with this email, you'll receive a password reset link.",
    });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-transparent">
        Profile Settings
      </h1>

      <Card className="border-2 border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            Profile Picture
          </CardTitle>
          <CardDescription>Upload or update your profile picture</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <Avatar className="h-24 w-24">
              <AvatarImage src={avatarUrl || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary text-2xl">
                {form.getValues('display_name')?.charAt(0)?.toUpperCase() || <User className="h-10 w-10" />}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-2">
              <div className="flex gap-2">
                <Label htmlFor="avatar-upload" className="cursor-pointer">
                  <div className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors w-fit">
                    <Camera className="h-4 w-4" />
                    {uploading ? "Uploading..." : "Change Picture"}
                  </div>
                  <Input
                    id="avatar-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    disabled={uploading}
                    className="hidden"
                  />
                </Label>
                {avatarUrl && (
                  <AlertDialog>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="icon">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                      </TooltipTrigger>
                      <TooltipContent>Delete Profile Picture</TooltipContent>
                    </Tooltip>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove Profile Picture?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will remove your current profile picture. You can upload a new one anytime.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteAvatar}>Remove</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                JPG, PNG or GIF. Max size 5MB.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-2 border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            Your Profile
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="full_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Full Name <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="John Doe" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="display_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Display Name <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="Johnny" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input disabled className="bg-muted" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="recovery_email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Recovery Email (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="recovery@email.com" {...field} />
                    </FormControl>
                    <FormMessage />
                    <p className="text-sm text-muted-foreground">
                      Used for account recovery if you lose access to your primary email
                    </p>
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="mobile_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mobile Number</FormLabel>
                      <div className="flex gap-2">
                        <CountryCodeSelector
                          value={field.value || ""}
                          onSelect={(code) => {
                            const currentValue = field.value || "";
                            let numberPart = currentValue;
                            
                            if (currentValue.startsWith("+")) {
                              const match = currentValue.match(/^\+\d+/);
                              if (match) {
                                numberPart = currentValue.substring(match[0].length);
                              }
                            }
                            
                            field.onChange(code + numberPart);
                          }}
                          disabled={form.formState.isSubmitting}
                        />
                        <FormControl>
                          <Input 
                            placeholder="1234567890"
                            inputMode="numeric"
                            type="tel"
                            value={field.value?.replace(/^\+\d+/, '') || ''}
                            onChange={(e) => {
                              const currentValue = field.value || "+1";
                              const match = currentValue.match(/^\+\d+/);
                              const countryCode = match ? match[0] : "+1";
                              const digits = e.target.value.replace(/[^0-9]/g, '');
                              field.onChange(countryCode + digits);
                            }}
                          />
                        </FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="date_of_birth"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date of Birth</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="profession"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Profession</FormLabel>
                    <FormControl>
                      <Input placeholder="Software Engineer" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="country"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Country</FormLabel>
                      <FormControl>
                        <CountrySelector
                          value={field.value || ""}
                          onValueChange={(value) => {
                            field.onChange(value);
                            form.setValue("city", "");
                          }}
                          disabled={form.formState.isSubmitting}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
                      <FormControl>
                        <CitySelector
                          value={field.value || ""}
                          onValueChange={field.onChange}
                          country={watchCountry || ""}
                          disabled={form.formState.isSubmitting}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="bio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bio</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Tell us about yourself..." rows={4} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" disabled={form.formState.isSubmitting} className="w-full">
                {form.formState.isSubmitting ? "Updating..." : "Update Profile"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card className="border-2 border-destructive/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <Key className="h-5 w-5" />
            Security
          </CardTitle>
          <CardDescription>Manage your password and account security</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-muted rounded-lg space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
                <Key className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="font-medium">Password Reset</p>
                <p className="text-sm text-muted-foreground">
                  We'll send a reset link to your email
                </p>
              </div>
            </div>
            <Button
              variant="destructive"
              onClick={handlePasswordReset}
              className="w-full"
            >
              <Mail className="h-4 w-4 mr-2" />
              Send Password Reset Email
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
