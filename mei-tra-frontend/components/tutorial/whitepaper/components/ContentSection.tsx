'use client';

import { Section, ContentBlock, RuleBlock, ExampleBlock, TrumpHierarchyBlock, InteractiveDemoBlock, TipBlock, JackSystemBlock, ScoreCalculatorBlock } from '../content/tutorialContent';
import { RuleCard } from './RuleCard';
import { TrumpHierarchy } from './TrumpHierarchy';
import { ExampleCard } from './ExampleCard';
import { InteractiveDemo } from './InteractiveDemo';
import { TipCard } from './TipCard';
import { JackSystem } from './JackSystem';
import { ScoreCalculator } from './ScoreCalculator';
import styles from './ContentSection.module.scss';

interface ContentSectionProps {
  section: Section;
}

export function ContentSection({ section }: ContentSectionProps) {
  const renderContent = (block: ContentBlock) => {
    switch (block.type) {
      case 'text':
        const textContent = block.content as string;
        return (
          <div className={styles.textBlock}>
            {textContent.split('\n').map((line, index) => (
              <p key={index} dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
            ))}
          </div>
        );
      case 'rule':
        return <RuleCard rule={block.content as RuleBlock} />;
      case 'example':
        return <ExampleCard example={block.content as ExampleBlock} />;
      case 'trump-hierarchy':
        return <TrumpHierarchy data={block.content as TrumpHierarchyBlock} />;
      case 'interactive-demo':
        return <InteractiveDemo config={block.content as InteractiveDemoBlock} />;
      case 'tip':
        return <TipCard tips={block.content as TipBlock} />;
      case 'jack-system':
        return <JackSystem data={block.content as JackSystemBlock} />;
      case 'score-calculator':
        return <ScoreCalculator data={block.content as ScoreCalculatorBlock} />;
      default:
        return null;
    }
  };

  return (
    <section id={section.id} className={styles.section}>
      <h2 className={styles.sectionTitle}>{section.title}</h2>
      <div className={styles.sectionContent}>
        {section.content.map((block, index) => (
          <div key={index} className={styles.contentBlock}>
            {renderContent(block)}
          </div>
        ))}
      </div>
    </section>
  );
}