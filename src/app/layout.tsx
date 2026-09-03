import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { NowProvider } from "@/lib/now";
import { TaskeyGate } from "@/components/TaskeyGate";
import { AppShell } from "@/components/AppShell";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Taskey — daily accountability for small teams",
  description:
    "Calendar-synced daily checklists, automated quote follow-ups, workload escalation and KPI reporting.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <NowProvider>
          <TaskeyGate>
            <AppShell>{children}</AppShell>
          </TaskeyGate>
        </NowProvider>
      </body>
    </html>
  );
}
