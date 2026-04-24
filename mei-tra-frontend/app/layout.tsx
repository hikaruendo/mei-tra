import type { Metadata } from "next";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.scss";
import { AuthProvider } from "@/contexts/AuthContext";
import { SocialSocketProvider } from "@/contexts/SocialSocketContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
    <html suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{ __html: preferenceBootstrapScript }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
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
