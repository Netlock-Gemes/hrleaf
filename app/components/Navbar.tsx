import { Button } from "@/components/ui/button";
import Image from "next/image";
import Link from "next/link";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import SignOutButton from "./SignOutButton";

export default async function Navbar() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  const logOut = async () => {};

  return (
    <nav className="navbar">
      <div className="navbar-container flex justify-between">
        <div className="navbar-logo">
          <Link
            href="/info"
            target="_blank"
            rel="noopener noreferrer"
            className="flex justify-center items-center gap-0.5 pr-2 py-0.5 rounded-xl backdrop-blur-xl bg-[#0e1d11]/60 border border-white/10 ml-2 md:ml-0"
          >
            <Image
              src="/logo/logo.png"
              alt="Openleaf Logo"
              width={600}
              height={600}
              priority
              className="h-10 w-auto"
            />
            <h1 className="text-2xl font-bold text-[#1eaa52]">HRLeaf</h1>
          </Link>
        </div>
        <div className="flex gap-2 pr-2 md:pr-0">
          {session ? (
            <div className="flex items-center gap-2">
              <span>{session.user.name}</span>
              <SignOutButton />
            </div>
          ) : (
            <Button className="rounded-xl">
              <Link href="/login">Login</Link>
            </Button>
          )}
        </div>
      </div>
    </nav>
  );
}
