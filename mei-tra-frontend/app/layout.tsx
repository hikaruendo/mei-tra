import type { Metadata } from "next";
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AuthProvider>
          <SocialSocketProvider>
            {children}
          </SocialSocketProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
