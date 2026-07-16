import type { Metadata } from "next";
import Script from "next/script";
import localFont from "next/font/local";
import "./globals.scss";
import { AuthProvider } from "@/contexts/AuthContext";
import { SocialSocketProvider } from "@/contexts/SocialSocketContext";

// Headings / wordmark (Latin) with Japanese mincho fallback
const fraunces = localFont({
  src: "./fonts/Fraunces-Variable.woff2",
  variable: "--font-fraunces",
  weight: "100 900",
  display: "swap",
});

const shipporiMincho = localFont({
  src: [
    { path: "./fonts/ShipporiMincho-400.woff2", weight: "400" },
    { path: "./fonts/ShipporiMincho-500.woff2", weight: "500" },
    { path: "./fonts/ShipporiMincho-700.woff2", weight: "700" },
  ],
  variable: "--font-shippori-mincho",
  preload: false,
  display: "swap",
});

// Body / UI (Latin) with Japanese gothic fallback
const hanken = localFont({
  src: "./fonts/HankenGrotesk-Variable.woff2",
  variable: "--font-hanken",
  weight: "100 900",
  display: "swap",
});

const zenKaku = localFont({
  src: [
    { path: "./fonts/ZenKakuGothicNew-400.woff2", weight: "400" },
    { path: "./fonts/ZenKakuGothicNew-500.woff2", weight: "500" },
    { path: "./fonts/ZenKakuGothicNew-700.woff2", weight: "700" },
  ],
  variable: "--font-zen-kaku",
  preload: false,
  display: "swap",
});

export const metadata: Metadata = {
  title: "Meitra - オンラインマルチプレイヤーカードゲーム",
  description: "4人対戦のオンラインカードゲーム「Meitra」をプレイしよう",
};

const preferenceBootstrapScript = `
  (function () {
    try {
      var root = document.documentElement;
      var theme = localStorage.getItem('theme');
      var resolvedTheme = theme === 'system'
        ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : (theme === 'light' || theme === 'dark' ? theme : 'dark');
      root.setAttribute('data-theme', resolvedTheme);

      var fontSize = localStorage.getItem('fontSize');
      var resolvedFontSize =
        fontSize === 'large' ||
        fontSize === 'xlarge'
          ? fontSize
          : fontSize === 'xxlarge'
            ? 'xlarge'
          : 'standard';
      root.setAttribute('data-font-size', resolvedFontSize);
    } catch (error) {
      console.warn('[preferences] Failed to apply boot preferences', error);
    }
  })();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const gaId = process.env.NEXT_PUBLIC_GA_ID;

  return (
    <html
      suppressHydrationWarning
      className={`${fraunces.variable} ${shipporiMincho.variable} ${hanken.variable} ${zenKaku.variable}`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{ __html: preferenceBootstrapScript }}
        />
      </head>
      <body className="antialiased">
        {gaId && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
              strategy="afterInteractive"
            />
            <Script id="ga4" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${gaId}');
              `}
            </Script>
          </>
        )}
        <AuthProvider>
          <SocialSocketProvider>
            {children}
          </SocialSocketProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
