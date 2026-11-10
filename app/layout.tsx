import { Geist, Geist_Mono } from "next/font/google";

import { Toaster } from "@/components/ui/sonner";

import type { Metadata, Viewport } from "next";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "HRLeaf",
  applicationName: "HRLeaf",
  description:
    "A minimalist browser-based rich text editor with markdown support. No signup: open any URL and start writing.",
  keywords: [
    "browser text editor",
    "no-signup editor",
    "markdown editor",
    "minimalist editor",
    "online notepad",
    "quick notes",
    "online scratchpad",
  ],
  icons: {
    icon: [
      { url: "/favicon/favicon.ico" },
      { url: "/favicon/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/favicon/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/favicon/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#121110",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
        <Toaster position="bottom-center" />
      </body>
    </html>
  );
}
