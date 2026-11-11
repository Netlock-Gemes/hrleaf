import { Metadata } from "next";

import { LogoMark } from "@/app/components/Logo";

import LoginForm from "./LoginForm";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export default function AdminLoginPage() {
  return (
    <main className="flex min-h-[100svh] items-center justify-center px-4 py-12">
      <div className="w-full max-w-[22rem]">
        <div className="mb-8 flex flex-col items-start gap-5">
          <LogoMark size={34} />
          <div>
            <h1 className="text-[1.375rem] font-semibold tracking-[-0.015em]">
              Sign in to HRLeaf
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Admin access to every note.
            </p>
          </div>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
