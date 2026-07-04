'use client';

import { useTranslations } from 'next-intl';
import { LegalPage, LegalSection } from '@/components/legal/LegalPage';

export default function PrivacyPage() {
  const t = useTranslations('privacy');

  return (
    <LegalPage title={t('title')} updated={t('updated')} backLabel={t('backToTop')}>
      <LegalSection title={t('section1.title')}>
        <p>{t('section1.p1')}</p>
        <p>{t('section1.p2')}</p>
      </LegalSection>

      <LegalSection title={t('section2.title')}>
        <p>{t('section2.p1')}</p>
        <ul>
          <li>{t('section2.item1')}</li>
          <li>{t('section2.item2')}</li>
          <li>{t('section2.item3')}</li>
          <li>{t('section2.item4')}</li>
        </ul>
      </LegalSection>

      <LegalSection title={t('section3.title')}>
        <p>{t('section3.p1')}</p>
        <p>{t('section3.p2')}</p>
      </LegalSection>

      <LegalSection title={t('section4.title')}>
        <p>{t('section4.p1')}</p>
        <p>{t('section4.p2')}</p>
      </LegalSection>

      <LegalSection title={t('section5.title')}>
        <p>{t('section5.p1')}</p>
      </LegalSection>

      <LegalSection title={t('section6.title')}>
        <p>{t('section6.p1')}</p>
      </LegalSection>
    </LegalPage>
  );
}
