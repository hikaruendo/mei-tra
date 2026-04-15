'use client';

import { Section, ContentBlock, RuleBlock, ExampleBlock, TrumpHierarchyBlock, InteractiveDemoBlock, TipBlock, JackSystemBlock, ScoreCalculatorBlock } from '../content/tutorialTypes';
import { RuleCard } from './RuleCard';
import { TrumpHierarchy } from './TrumpHierarchy';
import { ExampleCard } from './ExampleCard';
import { InteractiveDemo } from './InteractiveDemo';
import { TipCard } from './TipCard';
import { JackSystem } from './JackSystem';
import { ScoreCalculator } from './ScoreCalculator';
import styles from './ContentSection.module.scss';
import ruleCardStyles from './RuleCard.module.scss';

interface ContentSectionProps {
  section: Section;
}

export function ContentSection({ section }: ContentSectionProps) {
  const renderRichTextLine = (line: string, index: number, className?: string) => (
    <p
      key={index}
      className={className}
      dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }}
    />
  );

  const renderTextAsRuleCard = (textContent: string) => {
    const lines = textContent
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      return null;
    }

    let title: string | null = null;
    let bodyLines = lines;

    const subtitleMatch = lines[0].match(/^\*\*(.*?)\*\*$/);
    if (subtitleMatch) {
      title = subtitleMatch[1];
      bodyLines = lines.slice(1);
    } else if (section.id === 'reference') {
      title = lines[0];
      bodyLines = lines.slice(1);
    }

    return (
      <div className={ruleCardStyles.ruleCard}>
        {title && <h3 className={ruleCardStyles.ruleTitle}>{title}</h3>}
        <div className={styles.ruleLikeText}>
          {bodyLines.map((line, index) =>
            renderRichTextLine(
              line,
              index,
              `${ruleCardStyles.ruleDescription} ${styles.ruleLikeParagraph}`,
            ),
          )}
        </div>
      </div>
    );
  };

  const renderContent = (block: ContentBlock) => {
    switch (block.type) {
      case 'text': {
        const textContent = block.content as string;

        if (section.id === 'overview' || section.id === 'reference') {
          return renderTextAsRuleCard(textContent);
        }

        return (
          <div className={styles.textBlock}>
            {textContent.split('\n').map((line, index) => {
              const subtitleMatch = line.match(/^\*\*(.*?)\*\*$/);

              if (subtitleMatch) {
                return <h3 key={index}>{subtitleMatch[1]}</h3>;
              }

              return renderRichTextLine(line, index);
            })}
          </div>
        );
      }
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
