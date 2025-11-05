"use client";

import { Button } from "@/components/ui/button";
import { signOut, useSession } from "@/lib/auth-client";
import Image from "next/image";
import Link from "next/link";

// import { GitHubLink } from './icons/social-links/github';
// import { InfoLink } from './icons/social-links/info';
// import { RedditLink } from './icons/social-links/reddit';

export default function Navbar() {
  const { data: session } = useSession();

  return (
    <nav className="navbar">
      <div className="navbar-container flex justify-between">
        <div className="navbar-logo">
          <Link
            href="/info"
            target="_blank"
            rel="noopener noreferrer"
            className="flex justify-center items-center gap-0.5 pr-2 py-0.5 rounded-xl bg-[#0e1d11] ml-2 md:ml-0"
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
        {/* <div className="navbar-links">
          <InfoLink />
          <RedditLink />
          <GitHubLink />
        </div> */}
        <div className="flex gap-2 pr-2 md:pr-0">
          {session ? (
            <div className="flex items-center gap-2">
              <span>{session.user.name}</span>
              <Button onClick={() => signOut()} className="">
                Logout
              </Button>
            </div>
          ) : (
            <Button>
              <Link href="/login">Login</Link>
            </Button>
          )}
        </div>
      </div>
    </nav>
  );
}
