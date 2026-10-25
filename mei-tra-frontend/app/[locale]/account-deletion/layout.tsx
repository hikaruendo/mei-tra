import type { Metadata } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://meitra.kando1.com';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const isJapanese = locale === 'ja';
  const title = isJapanese
    ? 'Meitraのアカウント削除'
    : 'Delete your Meitra account';
  const description = isJapanese
    ? 'Meitraのアカウントと関連データの削除を依頼できます。'
    : 'Request deletion of your Meitra account and associated data.';
  const path = isJapanese ? '/account-deletion' : '/en/account-deletion';

  return {
    title,
    description,
    alternates: {
      canonical: new URL(path, SITE_URL).toString(),
      languages: {
        ja: new URL('/account-deletion', SITE_URL).toString(),
        en: new URL('/en/account-deletion', SITE_URL).toString(),
      },
    },
    openGraph: {
      title,
      description,
      url: new URL(path, SITE_URL).toString(),
    },
  };
}

export default function AccountDeletionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
