import Link from "next/link";

export const metadata = {
  title: "Privacy Policy | Openleaf",
  description: "Privacy Policy for Openleaf.",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-white text-neutral-900">
      <div className="mx-auto max-w-3xl px-6 py-16 sm:px-8 lg:py-24">
        <header className="mb-12">
          <Link
            href="/"
            className="text-sm font-medium text-neutral-500 transition hover:text-neutral-900"
          >
            ← Back to Openleaf
          </Link>

          <h1 className="mt-8 text-4xl font-semibold tracking-tight sm:text-5xl">
            Privacy Policy
          </h1>

          <p className="mt-4 text-sm text-neutral-500">
            Last updated: September 25, 2026
          </p>
        </header>

        <div className="space-y-10 text-[15px] leading-7 text-neutral-700">
          <section>
            <h2 className="mb-3 text-xl font-semibold text-neutral-900">
              1. Introduction
            </h2>

            <p>
              Welcome to Openleaf. Openleaf is a minimalist, browser-based
              writing and rich text editor that allows users to create and
              access documents through web URLs.
            </p>

            <p className="mt-4">
              This Privacy Policy explains what information may be collected,
              how it is used, and how it is handled when you use Openleaf.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-neutral-900">
              2. Information We Collect
            </h2>

            <p>
              Openleaf is designed to work without requiring users to create
              an account or provide personal information such as their name,
              phone number, or address.
            </p>

            <p className="mt-4">
              Depending on how you use the service, information that may be
              processed includes:
            </p>

            <ul className="mt-4 list-disc space-y-2 pl-6">
              <li>
                Content that you voluntarily enter into an Openleaf document.
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
            <h2 className="mb-3 text-xl font-semibold text-neutral-900">
              3. How We Use Information
            </h2>

            <p>Information processed by Openleaf may be used to:</p>

            <ul className="mt-4 list-disc space-y-2 pl-6">
              <li>Provide and operate the Openleaf editor.</li>
              <li>Save and retrieve document content.</li>
              <li>Make documents available through their associated URLs.</li>
              <li>Maintain, troubleshoot, and improve the service.</li>
              <li>Detect and prevent abuse, misuse, or security issues.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-neutral-900">
              4. Google Services
            </h2>

            <p>
              If Openleaf provides a Google sign-in or another Google
              integration, Google may provide certain account information
              necessary for that feature.
            </p>

            <p className="mt-4">
              Openleaf only uses information obtained through Google services
              for the purposes necessary to provide the requested feature.
              Openleaf does not sell Google user data or use Google user data
              for advertising.
            </p>

            <p className="mt-4">
              Openleaf does not request access to Google data that is not
              necessary for the functionality being provided.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-neutral-900">
              5. Document Privacy
            </h2>

            <p>
              Openleaf documents are not private by default. A person who has
              access to a document&apos;s URL may be able to view or edit its
              contents, depending on the functionality available for that
              document.
            </p>

            <p className="mt-4">
              Users should therefore avoid storing passwords, financial
              information, confidential business information, sensitive
              personal information, or other information that they do not want
              to be accessible through a shared or discoverable URL.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-neutral-900">
              6. Cookies and Local Storage
            </h2>

            <p>
              Openleaf may use browser storage, cookies, or similar
              technologies when necessary to provide functionality, maintain
              preferences, authenticate users, or operate the service.
            </p>

            <p className="mt-4">
              These technologies are not used by Openleaf to sell your
              personal information to third parties.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-neutral-900">
              7. Data Storage and Security
            </h2>

            <p>
              Document data and other information required to operate Openleaf
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
            <h2 className="mb-3 text-xl font-semibold text-neutral-900">
              8. Third-Party Services
            </h2>

            <p>
              Openleaf may rely on third-party providers for infrastructure,
              hosting, authentication, database storage, analytics, or other
              services required to operate the application.
            </p>

            <p className="mt-4">
              These providers may process information on behalf of Openleaf
              according to their respective privacy policies and applicable
              agreements.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-neutral-900">
              9. Data Retention and Deletion
            </h2>

            <p>
              Information is retained for as long as reasonably necessary to
              provide the service, maintain the application, comply with legal
              obligations, resolve disputes, and enforce applicable
              agreements.
            </p>

            <p className="mt-4">
              If you would like to request deletion of information associated
              with your use of Openleaf, please contact us using the contact
              information provided below.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-neutral-900">
              10. Children&apos;s Privacy
            </h2>

            <p>
              Openleaf is not specifically directed toward children under the
              age of 13. We do not knowingly collect personal information from
              children under 13. If you believe that a child has provided
              personal information to the service, please contact us so that we
              can take appropriate action.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-neutral-900">
              11. Changes to This Privacy Policy
            </h2>

            <p>
              We may update this Privacy Policy from time to time to reflect
              changes to Openleaf, applicable law, or our data practices. Any
              changes will be published on this page with an updated revision
              date.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-neutral-900">
              12. Contact
            </h2>

            <p>
              If you have questions about this Privacy Policy or would like to
              make a privacy-related request, please contact the Openleaf
              project maintainer through the project&apos;s GitHub repository.
            </p>

            <p className="mt-4">
              <a
                href="https://github.com/netlock-Gemes/hrleaf"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-neutral-900 underline underline-offset-4"
              >
                Openleaf GitHub Repository
              </a>
            </p>
          </section>
        </div>

        <footer className="mt-16 border-t border-neutral-200 pt-8 text-sm text-neutral-500">
          © {new Date().getFullYear()} Openleaf. All rights reserved.
        </footer>
      </div>
    </main>
  );
}
