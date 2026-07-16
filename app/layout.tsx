import type { Metadata } from "next";
import { Inter, Montserrat, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { PostLoginGate } from "@/components/loading/PostLoginGate";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "VAA Workspace",
  description: "Manage virtual assistants, tasks, and deadlines",
  icons: { icon: "/icon.png" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${montserrat.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full font-sans">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <PostLoginGate>{children}</PostLoginGate>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
