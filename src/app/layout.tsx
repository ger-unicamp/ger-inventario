import type { Metadata } from "next";
import localFont from "next/font/local";
import { Toaster } from "sonner";

import "./globals.css";

// As mesmas fontes dos posts do GER. Locais de proposito: o PC do
// laboratorio nem sempre tem internet.
const display = localFont({
  src: [
    { path: "./fonts/display.woff2", weight: "800", style: "normal" },
    { path: "./fonts/display-black.woff2", weight: "900", style: "normal" },
  ],
  variable: "--font-display",
  display: "swap",
});

const body = localFont({
  src: [
    { path: "./fonts/body.woff2", weight: "400", style: "normal" },
    { path: "./fonts/body-med.woff2", weight: "500", style: "normal" },
    { path: "./fonts/body-bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Inventário GER",
  description:
    "Inventário do Grupo de Estudos em Robótica da Unicamp, sobre o Google Sheets.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${display.variable} ${body.variable}`}
    >
      <body className="min-h-screen antialiased">
        {children}
        <Toaster position="bottom-right" richColors closeButton />
      </body>
    </html>
  );
}
