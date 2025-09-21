'use client';

import { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { ContentSection } from './components/ContentSection';
import { tutorialSections } from './content/tutorialContent';
import styles from './TutorialWhitepaper.module.scss';

export function TutorialWhitepaper() {
  const [activeSection, setActiveSection] = useState(tutorialSections[0].id);

  const handleSectionClick = (sectionId: string) => {
    setActiveSection(sectionId);
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  useEffect(() => {
    const handleScroll = () => {
      const sections = tutorialSections.map(s => ({
        id: s.id,
        element: document.getElementById(s.id)
      }));

      for (const section of sections) {
        if (section.element) {
          const rect = section.element.getBoundingClientRect();
          if (rect.top <= 100 && rect.bottom >= 100) {
            setActiveSection(section.id);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className={styles.whitepaperContainer}>
      <Sidebar
        sections={tutorialSections}
        activeSection={activeSection}
        onSectionClick={handleSectionClick}
      />
      <main className={styles.mainContent}>
        <div className={styles.contentWrapper}>
          {tutorialSections.map((section) => (
            <ContentSection key={section.id} section={section} />
          ))}
        </div>
      </main>
    </div>
  );
}