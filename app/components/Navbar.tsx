import Image from 'next/image';
import Link from 'next/link';

// import { GitHubLink } from './icons/social-links/github';
// import { InfoLink } from './icons/social-links/info';
// import { RedditLink } from './icons/social-links/reddit';

export default function Navbar() {
  return (
    <nav className="navbar">
      <div className="navbar-container">
        <div className="navbar-logo">
          <Link href="/info" target="_blank" rel="noopener noreferrer" className='flex justify-center items-center gap-0.5 pr-2 py-0.5 rounded-xl bg-[#0e1d11] ml-2 md:ml-0'>
            <Image
              src="/logo/logo.png"
              alt="Openleaf Logo"
              width={600}
              height={600}
              priority
              className='h-10 w-auto'
            />
            <h1 className='text-2xl font-bold text-[#1eaa52]'>HRLeaf</h1>
          </Link>
        </div>
        {/* <div className="navbar-links">
          <InfoLink />
          <RedditLink />
          <GitHubLink />
        </div> */}
      </div>
    </nav>
  );
}
