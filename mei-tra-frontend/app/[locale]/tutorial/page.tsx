import { redirect } from 'next/navigation';

export default async function TutorialRedirectPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/docs`);
}
