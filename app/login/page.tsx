import { Metadata } from "next";
import { redirect } from "next/navigation";

import { LogoMark } from "@/app/components/Logo";
import { getViewer, safeNext } from "@/server/auth";

import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Sign in" };

type Props = { searchParams: Promise<{ next?: string | string[] }> };

export default async function LoginPage({ searchParams }: Props) {
  const raw = (await searchParams).next;
  const next = safeNext(Array.isArray(raw) ? raw[0] : raw);
  if (await getViewer()) redirect(next);

  return (
    <main className="flex min-h-[100svh] items-center justify-center px-4 py-12">
      <div className="w-full max-w-[22rem]">
        <div className="mb-8 flex flex-col items-start gap-5">
          <LogoMark size={34} />
          <div>
            <h1 className="text-[1.375rem] font-semibold tracking-[-0.015em]">Sign in to HRLeaf</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {next !== "/" ? "Sign in to open this note." : "Use the username and password you were given."}
            </p>
          </div>
        </div>
        <LoginForm next={next} />
        <p className="mt-8 text-[12.5px] leading-relaxed text-[--text-tertiary]">
          HRLeaf is a private notebook. Accounts are created by invitation only.
        </p>
      </div>
    </main>
  );
}
