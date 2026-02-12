import type { Metadata } from "next";
import "@multica/ui/fonts";
import "@multica/ui/globals.css";
import { ThemeProvider } from "@multica/ui/components/theme-provider";
import { Toaster } from "@multica/ui/components/ui/sonner";
import { ServiceWorkerRegister } from "./sw-register";

export const metadata: Metadata = {
  title: "Multica",
  description: "Distributed AI agent framework",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Multica",
  },
  icons: {
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased h-dvh flex flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <div className="h-dvh overflow-hidden">{children}</div>
        </ThemeProvider>
        <Toaster />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
