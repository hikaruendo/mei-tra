'use client';

import { useState, useEffect, useMemo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Sidebar } from './components/Sidebar';
import { ContentSection } from './components/ContentSection';
import { Section } from './content/tutorialContent';
import styles from './TutorialWhitepaper.module.scss';

export function TutorialWhitepaper() {
  const t = useTranslations('tutorial');
  const locale = useLocale();

  // Build tutorial sections from translations
  const tutorialSections: Section[] = useMemo(() => {
    const overviewContent = [];

    // Add Bridge note only for English locale
    if (locale === 'en' && t('overview.bridgeNote')) {
      overviewContent.push({ type: 'text' as const, content: t('overview.bridgeNote') });
    }

    overviewContent.push(
      { type: 'text' as const, content: t('overview.description') },
      { type: 'rule' as const, content: { title: t('overview.objective'), description: t('overview.objectiveDesc'), example: t('overview.objectiveExample') } },
      { type: 'rule' as const, content: { title: t('overview.gameFlow'), description: t('overview.gameFlowDesc'), example: t('overview.gameFlowExample') } }
    );

    return [
    // Add comprehensive game introduction for English locale only
    ...(locale === 'en' ? [{
      id: 'game-intro',
      title: t('gameIntro.title'),
      content: [
        { type: 'text' as const, content: `**${t('gameIntro.subtitle')}**\n\n${t('gameIntro.description')}` },
        { type: 'text' as const, content: `**${t('gameIntro.keyFeatures')}**\n\n• ${t('gameIntro.feature1')}\n\n• ${t('gameIntro.feature2')}\n\n• ${t('gameIntro.feature3')}\n\n• ${t('gameIntro.feature4')}\n\n• ${t('gameIntro.feature5')}` },
        { type: 'text' as const, content: `**${t('gameIntro.howToPlay')}**` },
        { type: 'rule' as const, content: {
          title: t('gameIntro.setup'),
          description: t('gameIntro.setupDesc'),
          example: ''
        }},
        { type: 'text' as const, content: `**${t('gameIntro.gameFlow')}**` },
        { type: 'rule' as const, content: {
          title: t('gameIntro.phase1Title'),
          description: t('gameIntro.phase1Desc'),
          example: ''
        }},
        { type: 'rule' as const, content: {
          title: t('gameIntro.phase2Title'),
          description: t('gameIntro.phase2Desc'),
          example: ''
        }},
        { type: 'rule' as const, content: {
          title: t('gameIntro.phase3Title'),
          description: t('gameIntro.phase3Desc'),
          example: ''
        }},
        { type: 'rule' as const, content: {
          title: t('gameIntro.phase4Title'),
          description: t('gameIntro.phase4Desc'),
          example: ''
        }},
        { type: 'text' as const, content: `**${t('gameIntro.uniqueMechanics')}**` },
        { type: 'rule' as const, content: {
          title: t('gameIntro.mechanic1Title'),
          description: t('gameIntro.mechanic1Desc'),
          example: ''
        }},
        { type: 'rule' as const, content: {
          title: t('gameIntro.mechanic2Title'),
          description: t('gameIntro.mechanic2Desc'),
          example: ''
        }},
        { type: 'rule' as const, content: {
          title: t('gameIntro.mechanic3Title'),
          description: t('gameIntro.mechanic3Desc'),
          example: ''
        }},
        { type: 'rule' as const, content: {
          title: t('gameIntro.mechanic4Title'),
          description: t('gameIntro.mechanic4Desc'),
          example: ''
        }},
        { type: 'rule' as const, content: {
          title: t('gameIntro.mechanic5Title'),
          description: t('gameIntro.mechanic5Desc'),
          example: ''
        }},
        { type: 'rule' as const, content: {
          title: t('gameIntro.bridgeComparison'),
          description: t('gameIntro.bridgeComparisonDesc'),
          example: ''
        }},
        { type: 'text' as const, content: `**${t('gameIntro.scoringSystem')}**` },
        { type: 'rule' as const, content: {
          title: t('gameIntro.scoringFormula'),
          description: `${t('gameIntro.scoringExample1')}\n${t('gameIntro.scoringExample2')}\n\n${t('gameIntro.scoringNote')}`,
          example: ''
        }},
        { type: 'rule' as const, content: {
          title: t('gameIntro.culturalNote'),
          description: t('gameIntro.culturalNoteDesc'),
          example: ''
        }},
        { type: 'text' as const, content: `**${t('gameIntro.readyToPlay')}**\n\n${t('gameIntro.readyToPlayDesc')}` }
      ]
    }] : []),
    {
      id: 'overview',
      title: t('overview.title'),
      content: overviewContent
    },
    {
      id: 'cards',
      title: t('cards.title'),
      content: [
        { type: 'rule', content: { title: t('cards.composition'), description: t('cards.compositionDesc'), example: t('cards.compositionExample') } },
        { type: 'rule', content: { title: t('cards.scoreCards'), description: t('cards.scoreCardsDesc'), example: t('cards.scoreCardsExample') } },
        { type: 'rule', content: { title: t('cards.strength'), description: t('cards.strengthDesc'), example: t('cards.strengthExample') } }
      ]
    },
    {
      id: 'blow',
      title: t('blow.title'),
      content: [
        { type: 'text', content: t('blow.description') },
        { type: 'rule', content: { title: t('blow.basicRule'), description: t('blow.basicRuleDesc'), example: t('blow.basicRuleExample') } },
        { type: 'trump-hierarchy', content: { title: t('blow.hierarchy'), trumps: [
          { type: 'tra' as const, label: 'Tra', strength: 5, color: '#FF6B00' },
          { type: 'herz' as const, label: '♥', strength: 4, color: '#E91E63' },
          { type: 'daiya' as const, label: '♦', strength: 3, color: '#2196F3' },
          { type: 'club' as const, label: '♣', strength: 2, color: '#4CAF50' },
          { type: 'zuppe' as const, label: '♠', strength: 1, color: '#424242' }
        ]} },
        { type: 'rule', content: { title: t('blow.higherDeclaration'), description: t('blow.higherDeclarationDesc'), example: t('blow.higherDeclarationExample') } }
      ]
    },
    {
      id: 'jack',
      title: t('jack.title'),
      content: [
        { type: 'text', content: t('jack.description') },
        { type: 'jack-system', content: { title: t('jack.details') } }
      ]
    },
    {
      id: 'play',
      title: t('play.title'),
      content: [
        { type: 'text', content: t('play.description') },
        { type: 'rule', content: { title: t('play.order'), description: t('play.orderDesc'), example: t('play.orderExample') } },
        { type: 'rule', content: { title: t('play.winner'), description: t('play.winnerDesc'), example: t('play.winnerExample') } },
        { type: 'rule', content: { title: t('play.baseSuit'), description: t('play.baseSuitDesc'), example: t('play.baseSuitExample') } },
        { type: 'rule', content: { title: t('play.strength'), description: t('play.strengthDesc'), example: t('play.strengthExample') } }
      ]
    },
    {
      id: 'broken',
      title: t('broken.title'),
      content: [
        { type: 'text', content: t('broken.description') },
        { type: 'rule', content: { title: t('broken.judgment'), description: t('broken.judgmentDesc'), example: t('broken.judgmentExample') } },
        { type: 'rule', content: { title: t('broken.required'), description: t('broken.requiredDesc'), example: t('broken.requiredExample') } },
        { type: 'rule', content: { title: t('broken.negri'), description: t('broken.negriDesc'), example: t('broken.negriExample') } }
      ]
    },
    {
      id: 'scoring',
      title: t('scoring.title'),
      content: [
        { type: 'text', content: t('scoring.description') },
        { type: 'score-calculator', content: { title: t('scoring.calculator'), description: t('scoring.calculatorDesc') } },
        { type: 'rule', content: { title: t('scoring.formula'), description: t('scoring.formulaDesc'), example: t('scoring.formulaExample') } },
        { type: 'example', content: { scenario: t('scoring.successExample'), declaration: t('scoring.successDeclaration'), explanation: t('scoring.successExplanation') } },
        { type: 'example', content: { scenario: t('scoring.failExample'), declaration: t('scoring.failDeclaration'), explanation: t('scoring.failExplanation') } }
      ]
    },
    {
      id: 'chombo',
      title: t('chombo.title'),
      content: [
        { type: 'text', content: t('chombo.description') },
        { type: 'rule', content: { title: t('chombo.negriForget'), description: t('chombo.negriForgetDesc'), example: t('chombo.negriForgetExample') } },
        { type: 'rule', content: { title: t('chombo.fourJack'), description: t('chombo.fourJackDesc'), example: t('chombo.fourJackExample') } },
        { type: 'rule', content: { title: t('chombo.lastTanzen'), description: t('chombo.lastTanzenDesc'), example: t('chombo.lastTanzenExample') } },
        { type: 'rule', content: { title: t('chombo.wrongBroken'), description: t('chombo.wrongBrokenDesc'), example: t('chombo.wrongBrokenExample') } },
        { type: 'rule', content: { title: t('chombo.reportSystem'), description: t('chombo.reportSystemDesc'), example: t('chombo.reportSystemExample') } }
      ]
    },
    {
      id: 'strategy',
      title: t('strategy.title'),
      content: [
        { type: 'tip', content: { title: t('strategy.blowStrategy'), tips: [t('strategy.blowTip1'), t('strategy.blowTip2'), t('strategy.blowTip3'), t('strategy.blowTip4'), t('strategy.blowTip5')] } },
        { type: 'tip', content: { title: t('strategy.playStrategy'), tips: [t('strategy.playTip1'), t('strategy.playTip2'), t('strategy.playTip3'), t('strategy.playTip4'), t('strategy.playTip5')] } },
        { type: 'tip', content: { title: t('strategy.teamStrategy'), tips: [t('strategy.teamTip1'), t('strategy.teamTip2'), t('strategy.teamTip3'), t('strategy.teamTip4'), t('strategy.teamTip5')] } }
      ]
    },
    {
      id: 'reference',
      title: t('reference.title'),
      content: [
        { type: 'text', content: t('reference.trumpStrength') },
        { type: 'text', content: t('reference.cardStrength') },
        { type: 'text', content: t('reference.bonus') },
        { type: 'text', content: t('reference.jackSystem') },
        { type: 'text', content: t('reference.scoreCalc') },
        { type: 'text', content: t('reference.violations') },
        { type: 'text', content: t('reference.flow') },
        { type: 'text', content: t('reference.settings') }
      ]
    }
  ];
  }, [t, locale]);

  const [activeSection, setActiveSection] = useState('overview');

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