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

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      const { error } = await authClient.signIn.social({
        provider: "google",
        callbackURL: "/",
        errorCallbackURL: "/login?error=google",
        newUserCallbackURL: "/",
        disableRedirect: false,
      });
      if (error) setError(error.message || "Google sign-in failed");
    } catch (err: any) {
      setError(err.message || "Something went wrong");
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
              <FcGoogle className="w-5 h-5" />
              {loading ? "Connecting..." : "Continue with Google"}
            </Button>

            {error && (
              <p className="text-sm text-red-400 text-center mt-2">{error}</p>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
