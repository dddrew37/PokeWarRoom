import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AccessibilityToggle from "@/components/AccessibilityToggle";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport = {
  themeColor: "#09090b", // zinc-950
};

export const metadata: Metadata = {
  title: "PokeWarRoom",
  description: "VGC Live Coaching & PWA Strategy Planner",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "PokeWarRoom",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} min-h-screen antialiased dark`}
      style={{ colorScheme: 'dark' }}
    >
      <body className="min-h-screen flex flex-col bg-zinc-950 text-white">
        {children}
        <AccessibilityToggle />
      </body>
    </html>
  );
}
