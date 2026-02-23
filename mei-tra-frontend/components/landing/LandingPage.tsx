'use client';

import { useTranslations } from 'next-intl';
import styles from './LandingPage.module.scss';

interface LandingPageProps {
  onLoginClick: () => void;
  onSignupClick: () => void;
  productUrl?: string;
}

type LandingMetric = {
  value: string;
  label: string;
};

type LandingFeature = {
  badge: string;
  title: string;
  description: string;
};

type LandingStep = {
  step: string;
  title: string;
  description: string;
};

type LandingTestimonial = {
  quote: string;
  name: string;
  role: string;
};

type LandingFaqItem = {
  question: string;
  answer: string;
};

type LandingFooterLink = {
  label: string;
  href: string;
};

export function LandingPage({
  onLoginClick,
  onSignupClick,
  productUrl = 'https://kando1.com',
}: LandingPageProps) {
  const t = useTranslations('landing');

  const metrics = t.raw('hero.metrics') as LandingMetric[];
  const features = t.raw('features.items') as LandingFeature[];
  const steps = t.raw('community.steps') as LandingStep[];
  const testimonials = t.raw('testimonials.items') as LandingTestimonial[];
  const faqItems = t.raw('faq.items') as LandingFaqItem[];
  const footerLinks = t.raw('footer.links') as LandingFooterLink[];

  return (
    <main className={styles.landing}>
      {/* 1. Hero */}
      <section className={styles.hero}>
        <span className={styles.heroLabel}>{t('hero.label')}</span>
        <h1 className={styles.heroTitle}>
          {t('hero.titleLeading')}
          <span>{t('hero.titleHighlight')}</span>
          {t('hero.titleTrailing')}
        </h1>
        <p className={styles.heroDescription}>{t('hero.description')}</p>
        <div className={styles.ctaRow}>
          <button type="button" className={styles.primaryCta} onClick={onLoginClick}>
            {t('hero.loginCta')}
          </button>
          <button type="button" className={styles.secondaryCta} onClick={onSignupClick}>
            {t('hero.signupCta')}
          </button>
        </div>
        <div className={styles.metrics}>
          {metrics.map((metric) => (
            <div key={metric.label} className={styles.metric}>
              <strong>{metric.value}</strong>
              <span>{metric.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* 2. Screenshot */}
      <section className={styles.screenshotSection}>
        <div className={styles.screenshotFrame}>
          <div className={styles.screenshotPlaceholder}>
            {t('screenshot.placeholder')}
          </div>
        </div>
        <p className={styles.screenshotCaption}>{t('screenshot.caption')}</p>
      </section>

      {/* 3. Features */}
      <section className={styles.section} id="features">
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.sectionEyebrow}>{t('features.eyebrow')}</p>
            <h2 className={styles.sectionTitle}>{t('features.title')}</h2>
          </div>
          <p className={styles.sectionDescription}>{t('features.description')}</p>
        </div>
        <div className={styles.featureGrid}>
          {features.map((feature) => (
            <article key={feature.title} className={styles.featureCard}>
              <div className={styles.featureBadge}>{feature.badge}</div>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </article>
          ))}
        </div>
      </section>

      {/* 4. Community */}
      <section className={styles.section} id="experience">
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.sectionEyebrow}>{t('community.eyebrow')}</p>
            <h2 className={styles.sectionTitle}>{t('community.title')}</h2>
          </div>
          <p className={styles.sectionDescription}>{t('community.description')}</p>
        </div>
        <div className={styles.timeline}>
          {steps.map((step) => (
            <article key={step.title} className={styles.timelineCard}>
              <p className={styles.timelineStep}>{step.step}</p>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </article>
          ))}
        </div>
      </section>

      {/* 5. Testimonials */}
      <section className={styles.section} id="testimonials">
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.sectionEyebrow}>{t('testimonials.eyebrow')}</p>
            <h2 className={styles.sectionTitle}>{t('testimonials.title')}</h2>
          </div>
        </div>
        <div className={styles.testimonialGrid}>
          {testimonials.map((item) => (
            <article key={item.name} className={styles.testimonialCard}>
              <p className={styles.testimonialQuote}>&ldquo;{item.quote}&rdquo;</p>
              <div className={styles.testimonialAuthor}>
                <span className={styles.testimonialName}>{item.name}</span>
                <span className={styles.testimonialRole}>{item.role}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* 6. FAQ */}
      <section className={styles.section} id="faq">
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.sectionEyebrow}>{t('faq.eyebrow')}</p>
            <h2 className={styles.sectionTitle}>{t('faq.title')}</h2>
          </div>
        </div>
        <div className={styles.faqList}>
          {faqItems.map((item) => (
            <details key={item.question} className={styles.faqItem}>
              <summary className={styles.faqSummary}>
                {item.question}
                <span className={styles.faqIcon} />
              </summary>
              <p className={styles.faqAnswer}>{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      {/* 7. CTA */}
      <section className={styles.ctaSection} id="cta">
        <p className={styles.sectionEyebrow}>{t('cta.eyebrow')}</p>
        <h2 className={styles.ctaSectionTitle}>{t('cta.title')}</h2>
        <p className={styles.ctaSectionDescription}>{t('cta.description')}</p>
        <div className={styles.ctaSectionRow}>
          <button type="button" className={styles.primaryCta} onClick={onLoginClick}>
            {t('cta.login')}
          </button>
          <button type="button" className={styles.secondaryCta} onClick={onSignupClick}>
            {t('cta.signup')}
          </button>
          <a
            className={styles.secondaryCta}
            href={productUrl}
            target="_blank"
            rel="noreferrer"
          >
            {t('cta.product')}
          </a>
        </div>
      </section>

      {/* 8. Footer */}
      <footer className={styles.footer}>
        <nav className={styles.footerLinks}>
          {footerLinks.map((link) => (
            <a
              key={link.label}
              className={styles.footerLink}
              href={link.href}
              target="_blank"
              rel="noreferrer"
            >
              {link.label}
            </a>
          ))}
        </nav>
        <p className={styles.footerCopy}>{t('footer.copyright')}</p>
      </footer>
    </main>
  );
}
