import type { Metadata } from "next";
import { Manrope, Sora } from "next/font/google";
import "./globals.css";

// The two typefaces the official website uses: Sora (headings, 800) and Manrope (body).
const sora = Sora({ subsets: ["latin", "latin-ext"], weight: ["600", "700", "800"], variable: "--font-sora", display: "swap" });
const manrope = Manrope({ subsets: ["latin", "latin-ext"], weight: ["400", "500", "600", "700", "800"], variable: "--font-manrope", display: "swap" });

export const metadata: Metadata = {
  title: "Illyrian Gym & CrossFit - Staff",
  description: "Staff dashboard for Illyrian Gym & CrossFit, Ferizaj",
  icons: { icon: "/brand/logo.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sora.variable} ${manrope.variable}`}>
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
