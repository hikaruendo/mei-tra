'use client';

import { useTranslations } from 'next-intl';
import { LegalPage, LegalSection } from '@/components/legal/LegalPage';
import styles from './page.module.scss';

const CONTACT_EMAIL = 'contact@kando1.com';

export default function AccountDeletionPage() {
  const t = useTranslations('accountDeletion');
  const requestUrl = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(t('emailSubject'))}`;

  return (
    <LegalPage title={t('title')} backLabel={t('backToTop')}>
      <LegalSection title={t('requestTitle')}>
        <p>{t('requestDescription')}</p>
        <p>{t('requestInstructions', { email: CONTACT_EMAIL })}</p>
        <a className={styles.requestButton} href={requestUrl}>
          {t('requestButton')}
        </a>
        <p>{t('securityNote')}</p>
      </LegalSection>

      <LegalSection title={t('dataTitle')}>
        <p>{t('dataDescription')}</p>
      </LegalSection>

      <LegalSection title={t('inAppTitle')}>
        <p>{t('inAppDescription')}</p>
      </LegalSection>
    </LegalPage>
  );
}
