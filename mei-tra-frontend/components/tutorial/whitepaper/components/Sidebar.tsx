'use client';

import { Section } from '../content/tutorialContent';
import styles from './Sidebar.module.scss';

interface SidebarProps {
  sections: Section[];
  activeSection: string;
  onSectionClick: (sectionId: string) => void;
}

export function Sidebar({ sections, activeSection, onSectionClick }: SidebarProps) {
  return (
    <nav className={styles.sidebar}>
      <div className={styles.sidebarContent}>
        <h2 className={styles.sidebarTitle}>目次</h2>
        <ul className={styles.sectionList}>
          {sections.map((section) => (
            <li key={section.id}>
              <button
                className={`${styles.sectionLink} ${
                  activeSection === section.id ? styles.active : ''
                }`}
                onClick={() => onSectionClick(section.id)}
              >
                {section.title}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}