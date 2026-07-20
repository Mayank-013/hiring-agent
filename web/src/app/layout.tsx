import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HackerRank ATS — Signal",
  description: "Recruiter ATS for resume scoring and conversational hiring review.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
