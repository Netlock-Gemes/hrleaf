import Image from "next/image";
import Link from "next/link";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import UserMenu from "./UserMenu";

export default async function Navbar() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  return (
    <nav className="navbar">
      <div className="navbar-container flex justify-between items-center">
        {/* Logo */}
        <div className="navbar-logo">
          <Link
            href="/info"
            target="_blank"
            rel="noopener noreferrer"
            className="flex justify-center items-center gap-0.5 pr-2 py-0.5 rounded-xl backdrop-blur-xl bg-[#0e1d11]/60 border border-white/10 ml-3 md:ml-0"
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

        {/* Right section */}
        <div className="flex items-center gap-2 mr-3 md:mr-0">
          {session ? (
            <UserMenu name={session.user.name} image={session.user.image} />
          ) : null}
        </div>
      </div>
    </nav>
  );
}
