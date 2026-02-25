import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import jaMessages from '@/messages/ja.json';
import enMessages from '@/messages/en.json';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://meitra.kando1.com';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;

  const jaTitle = '明専トランプ（Mei-Tra）とは？ルール解説とオンライン対戦';
  const jaDescription = '明専トランプとは、4人2チームで遊ぶ戦略的トランプゲーム。Mei-Traでルール解説・チュートリアル・オンライン対戦を無料で始められます。';

  const enTitle = 'What is Meisen Trump (Mei-Tra)? Rules & Online Play';
  const enDescription = 'Meisen Trump (明専トランプ) is a strategic 4-player partnership card game. Learn the rules and play online for free on Mei-Tra.';

  const title = locale === 'ja' ? jaTitle : enTitle;
  const description = locale === 'ja' ? jaDescription : enDescription;
  const path = locale === 'ja' ? '/' : `/${locale}`;
  const url = new URL(path, SITE_URL).toString();

  return {
    title,
    description,
    keywords: locale === 'ja'
      ? ['明専トランプ', '明専トランプとは', 'Mei-Tra', 'トランプゲーム', 'オンライン対戦']
      : ['Meisen Trump', 'Mei-Tra', 'what is meisen trump', 'online card game'],
    alternates: {
      canonical: url,
      languages: {
        ja: new URL('/', SITE_URL).toString(),
        en: new URL('/en', SITE_URL).toString(),
      },
    },
    openGraph: {
      title,
      description,
      url,
      siteName: 'Mei-Tra',
      locale: locale === 'ja' ? 'ja_JP' : 'en_US',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

function getJsonLd(locale: string) {
  const msgs = locale === 'ja' ? jaMessages : enMessages;
  const faqItems = (msgs as Record<string, Record<string, unknown>>).landing as Record<string, unknown>;
  const faq = faqItems.faq as { items: { question: string; answer: string }[] };

  const webApplication = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: '明専トランプ (Mei-Tra)',
    url: SITE_URL,
    description:
      locale === 'ja'
        ? '4人2チーム制の戦略的オンライントランプゲーム。ブロー宣言やジャックシステムなど独自ルールを持つトリックテイキングゲームをオンラインで無料プレイ。'
        : 'A strategic 4-player, 2-team online card game. Play this unique trick-taking game with Blow declarations and the Jack system for free.',
    applicationCategory: 'GameApplication',
    operatingSystem: 'Web',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'JPY',
    },
    inLanguage: ['ja', 'en'],
  };

  const faqPage = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };

  const organization = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Kando',
    url: 'https://kando1.com',
    logo: `${SITE_URL}/meitra2.webp`,
  };

  return [webApplication, faqPage, organization];
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as 'ja' | 'en')) {
    notFound();
  }

  const messages = await getMessages();
  const jsonLd = getJsonLd(locale);

  return (
    <NextIntlClientProvider messages={messages}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {children}
    </NextIntlClientProvider>
  );
}
