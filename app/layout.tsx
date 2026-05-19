import type { Metadata, Viewport } from "next";
import { Pixelify_Sans, M_PLUS_Rounded_1c, Caveat } from "next/font/google";
import { Toaster } from "react-hot-toast";
import { themeInitScript } from "@/components/theme-toggle";
import "./globals.css";

// Display: Pixelify Sans — chunky pixel display, classic 2D-game UI.
const pixelify = Pixelify_Sans({
  variable: "--font-pixelify",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

// Body / UI: M PLUS Rounded 1c — chunky rounded, very readable, game-menu friendly.
const mplus = M_PLUS_Rounded_1c({
  variable: "--font-mplus",
  subsets: ["latin"],
  weight: ["400", "500", "700", "800"],
  display: "swap",
});

// Handwritten — for notes/annotations later.
const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "read‑together",
  description: "A tiny shared library for two.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Resize layout when the soft keyboard appears so `dvh` and fixed-
  // positioned elements stay above the keyboard. (Chrome 108+; safe to
  // include — older browsers ignore.)
  interactiveWidget: "resizes-content",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${pixelify.variable} ${mplus.variable} ${caveat.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full flex flex-col relative overflow-x-hidden">
        {children}
        <Toaster
          position="bottom-center"
          toastOptions={{
            style: {
              background: "var(--color-paper)",
              color: "var(--color-ink)",
              border: "2px solid var(--color-ink-soft)",
              borderRadius: "16px",
              fontFamily: "var(--font-sans)",
              fontWeight: 700,
              boxShadow: "4px 4px 0 0 var(--color-ink-soft)",
            },
          }}
        />
      </body>
    </html>
  );
}
