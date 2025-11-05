"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { authClient, signIn } from "@/lib/auth-client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setForm((prev) => ({ ...prev, [id]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { error } = await authClient.signIn.email(
        {
          email: form.email,
          password: form.password,
          callbackURL: "/dashboard",
          rememberMe: true,
        },
        {
          onRequest: () => console.log("Signing in..."),
          onSuccess: () => router.push("/dashboard"),
          onError: (ctx) => setError(ctx.error.message),
        }
      );

      if (error && error.message) setError(error.message);
    } catch (err: any) {
      setError(err.message || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-svh flex items-center justify-center text-white px-4">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <Card className="w-[380px] backdrop-blur-xl bg-white/10 border border-white/10 shadow-2xl -mt-20">
          <CardHeader>
            <CardTitle className="text-2xl font-bold tracking-tight text-center">
              Welcome Back
            </CardTitle>
            <CardDescription className="text-center text-slate-300">
              Sign in to access your editor
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  className="bg-white/10 border-white/20 text-white placeholder:text-slate-400"
                  value={form.email}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  className="bg-white/10 border-white/20 text-white placeholder:text-slate-400"
                  value={form.password}
                  onChange={handleChange}
                  required
                />
              </div>

              {error && (
                <p className="text-sm text-red-400 text-center">{error}</p>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-white text-black hover:bg-slate-100 transition-all font-semibold"
              >
                {loading ? "Signing in..." : "Sign In"}
              </Button>
            </form>
          </CardContent>

          <CardFooter className="text-center text-sm text-slate-300">
            Don’t have an account?{" "}
            <Link
              href="/signup"
              className="text-white font-medium hover:underline"
            >
              Sign up
            </Link>
          </CardFooter>
        </Card>
      </motion.div>
    </div>
  );
}
