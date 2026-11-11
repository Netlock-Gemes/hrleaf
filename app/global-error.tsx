"use client";

/** Last-resort fallback when the root layout itself fails. Keeps styling inline: globals may not have loaded. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#121110",
          color: "#ece8e1",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <main style={{ maxWidth: 360, padding: 24 }}>
          <h1 style={{ fontSize: 22, margin: "0 0 8px" }}>HRLeaf couldn&apos;t start</h1>
          <p style={{ color: "#a29d94", lineHeight: 1.6, margin: "0 0 20px", fontSize: 14 }}>
            Something went wrong while loading. Your saved notes are safe.
          </p>
          <button
            onClick={reset}
            style={{
              background: "#4cc47e",
              color: "#0f1a13",
              border: 0,
              borderRadius: 6,
              padding: "9px 14px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
