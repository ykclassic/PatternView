import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PatternView — Crypto Pattern Analysis",
  description: "Explainable chart-pattern analysis for crypto spot markets. No order execution.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
