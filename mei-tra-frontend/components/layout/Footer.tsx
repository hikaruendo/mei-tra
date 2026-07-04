'use client';

import { useTranslations } from 'next-intl';
import styles from './Footer.module.scss';

type FooterLink = {
  label: string;
  href: string;
};

export function Footer() {
  const t = useTranslations('landing');
  const links = t.raw('footer.links') as FooterLink[];

  return (
    <footer className={styles.footer}>
      <nav className={styles.footerLinks}>
        {links.map((link) => (
          <a
            key={link.label}
            className={styles.footerLink}
            href={link.href}
            {...(link.href.startsWith('/')
              ? {}
              : { target: '_blank', rel: 'noreferrer' })}
          >
            {link.label}
          </a>
        ))}
      </nav>
      <p className={styles.footerCopy}>{t('footer.copyright')}</p>
    </footer>
  );
}
