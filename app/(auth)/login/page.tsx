"use client";

import { motion } from "motion/react";
import Image from "next/image";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FcGoogle } from "react-icons/fc";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    toast.dismiss();

    try {
      const { error } = await authClient.signIn.social({
        provider: "google",
        callbackURL: "/ainzooalgown",
        errorCallbackURL: "/login?error=google",
        newUserCallbackURL: "/welcome",
        disableRedirect: false,
      });

      if (error) {
        toast.error(error.message || "Google sign-in failed");
      } else {
        toast.success("Redirecting to Google...");
      }
    } catch (err: any) {
      console.error("Google sign-in error:", err);
      toast.error(err?.message || "Something went wrong during sign-in");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-svh flex items-center justify-center text-white px-4 bg-gradient-to-br from-emerald-900 via-emerald-950 to-emerald-800">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <Card className="w-[380px] backdrop-blur-xl bg-white/10 border border-white/10 shadow-2xl -mt-14">
          <CardHeader>
            <Image
              src="/logo/logo.png"
              width={100}
              height={100}
              alt="Logo"
              className="mx-auto mb-2 h-10 w-fit"
            />
            <CardTitle className="text-2xl font-bold tracking-tight text-center">
              Welcome Back
            </CardTitle>
            <CardDescription className="text-center text-slate-300">
              Sign in securely with your Google account
            </CardDescription>
          </CardHeader>

          <CardContent className="flex flex-col gap-4">
            <Button
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full bg-white text-black hover:bg-slate-100 transition-all font-semibold flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <FcGoogle className="w-5 h-5" />
                  Continue with Google
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
