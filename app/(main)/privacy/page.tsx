import Link from "next/link";

import { NewNoteButton } from "@/app/components/NewNoteDialog";
import SiteHeader from "@/app/components/SiteHeader";
import UserMenu from "@/app/components/UserMenu";
import { getViewer } from "@/server/auth";

export const metadata = {
  title: "Privacy Policy",
  description: "How HRLeaf handles notes, links and the little data it keeps.",
  openGraph: {
    title: "Privacy Policy",
    description: "How HRLeaf handles notes, links and the little data it keeps.",
    url: "/privacy",
  },
};

export default async function PrivacyPage() {
  const viewer = await getViewer();
  return (
    <main className="min-h-screen">
      <SiteHeader>
        {viewer ? (
          <>
            <NewNoteButton />
            <UserMenu viewer={viewer} className="ml-0.5" />
          </>
        ) : (
          <Link
            href="/login"
            className="flex h-8 items-center rounded-md px-2.5 text-[13px] text-[--text-secondary] transition-colors hover:bg-accent hover:text-foreground"
          >
            Sign in
          </Link>
        )}
      </SiteHeader>
      <div className="mx-auto max-w-[44rem] px-5 py-12 sm:px-8 lg:py-20">
        <header className="mb-12">
          <Link
            href="/"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            ← Back to HRLeaf
          </Link>

          <h1 className="mt-8 text-[2.25rem] font-semibold leading-tight tracking-[-0.02em] sm:text-[2.75rem]">
            Privacy Policy
          </h1>

          <p className="tabular mt-3 text-sm text-muted-foreground">
            Last updated: November 11, 2026
          </p>
        </header>

        <div className="space-y-10 text-[15px] leading-7 text-[--text-secondary]">
          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">
              1. Introduction
            </h2>

            <p>
              Welcome to HRLeaf. HRLeaf is a minimalist, browser-based
              writing and rich text editor that allows users to create and
              access documents through web URLs.
            </p>

            <p className="mt-4">
              This Privacy Policy explains what information may be collected,
              how it is used, and how it is handled when you use HRLeaf.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">
              2. Information We Collect
            </h2>

            <p>
              HRLeaf is a private, invitation-only notebook. Accounts are
              created by the administrator and hold only a username, a display
              name and a securely hashed password. HRLeaf does not ask for
              personal information such as your email, phone number or address.
            </p>

            <p className="mt-4">
              Depending on how you use the service, information that may be
              processed includes:
            </p>

            <ul className="mt-4 list-disc space-y-2 pl-6">
              <li>
                Content that you voluntarily enter into an HRLeaf document.
              </li>
              <li>
                The URL or identifier associated with the document you create
                or access.
              </li>
              <li>
                Basic technical information required to operate and secure the
                service, such as browser requests, IP address, and server
                logs, where applicable.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">
              3. How We Use Information
            </h2>

            <p>Information processed by HRLeaf may be used to:</p>

            <ul className="mt-4 list-disc space-y-2 pl-6">
              <li>Provide and operate the HRLeaf editor.</li>
              <li>Save and retrieve document content.</li>
              <li>Make documents available through their associated URLs.</li>
              <li>Maintain, troubleshoot, and improve the service.</li>
              <li>Detect and prevent abuse, misuse, or security issues.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">
              4. Document Privacy
            </h2>

            <p>
              Notes are private by default and can only be opened by signed-in
              accounts. The administrator can make a note visible to themselves
              only, or turn on a public share link. Anyone who has a share link
              can read that one note, or edit it if the link allows editing,
              without an account. The administrator can turn a link off or
              replace it at any time.
            </p>

            <p className="mt-4">
              Because share links work for anyone who has them, avoid putting
              passwords, financial information, confidential business
              information or other sensitive details in a note that has a
              public share link.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">
              5. Cookies and Local Storage
            </h2>

            <p>
              HRLeaf may use browser storage, cookies, or similar
              technologies when necessary to provide functionality, maintain
              preferences, authenticate users, or operate the service.
            </p>

            <p className="mt-4">
              These technologies are not used by HRLeaf to sell your
              personal information to third parties.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">
              6. Data Storage and Security
            </h2>

            <p>
              Document data and other information required to operate HRLeaf
              may be stored on third-party infrastructure providers used by
              the service.
            </p>

            <p className="mt-4">
              Reasonable technical and organizational measures are used to
              protect information against unauthorized access, alteration,
              disclosure, or destruction. However, no internet service or
              storage system can be guaranteed to be completely secure.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">
              7. Third-Party Services
            </h2>

            <p>
              HRLeaf may rely on third-party providers for infrastructure,
              hosting, authentication, database storage, analytics, or other
              services required to operate the application.
            </p>

            <p className="mt-4">
              These providers may process information on behalf of HRLeaf
              according to their respective privacy policies and applicable
              agreements.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">
              8. Data Retention and Deletion
            </h2>

            <p>
              Information is retained for as long as reasonably necessary to
              provide the service, maintain the application, comply with legal
              obligations, resolve disputes, and enforce applicable
              agreements.
            </p>

            <p className="mt-4">
              If you would like to request deletion of information associated
              with your use of HRLeaf, please contact us using the contact
              information provided below.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">
              9. Children&apos;s Privacy
            </h2>

            <p>
              HRLeaf is not specifically directed toward children under the
              age of 13. We do not knowingly collect personal information from
              children under 13. If you believe that a child has provided
              personal information to the service, please contact us so that we
              can take appropriate action.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">
              10. Changes to This Privacy Policy
            </h2>

            <p>
              We may update this Privacy Policy from time to time to reflect
              changes to HRLeaf, applicable law, or our data practices. Any
              changes will be published on this page with an updated revision
              date.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">
              11. Contact
            </h2>

            <p>
              If you have questions about this Privacy Policy or would like to
              make a privacy-related request, please contact the HRLeaf
              project maintainer through the project&apos;s GitHub repository.
            </p>

            <p className="mt-4">
              <a
                href="https://github.com/netlock-Gemes/hrleaf"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-foreground underline underline-offset-4"
              >
                HRLeaf on GitHub
              </a>
            </p>
          </section>
        </div>

        <footer className="mt-16 border-t border-border pt-8 text-sm text-muted-foreground">
          © {new Date().getFullYear()} HRLeaf. All rights reserved.
        </footer>
      </div>
    </main>
  );
}
