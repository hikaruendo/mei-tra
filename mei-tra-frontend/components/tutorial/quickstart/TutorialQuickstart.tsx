'use client';

import { useState, useEffect } from 'react';
import { ProgressBar } from './ProgressBar';
import { TutorialStep } from './TutorialStep';
import { StepCard } from './StepCard';
import { StepNavigation } from './StepNavigation';
import { quickstartSteps, stepTitles, StepCard as StepCardType, StepCardContent } from './content/quickstartContent';
import styles from './TutorialQuickstart.module.scss';

export function TutorialQuickstart() {
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [stepProgress, setStepProgress] = useState<{ [key: number]: boolean }>({});

  const totalSteps = quickstartSteps.length;
  const currentStepData = quickstartSteps[currentStep - 1];

  // Check if current step is complete based on completion criteria
  const isCurrentStepComplete = stepProgress[currentStep] || false;

  const handleStepComplete = () => {
    setStepProgress(prev => ({ ...prev, [currentStep]: true }));
    setCompletedSteps(prev => new Set([...prev, currentStep]));
  };

  const handleNextStep = () => {
    if (currentStep < totalSteps && isCurrentStepComplete) {
      setCurrentStep(currentStep + 1);
      // Scroll to top of the new step
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 100);
    }
  };

  const handlePreviousStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      // Scroll to top of the previous step
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 100);
    }
  };

  const handleTutorialComplete = () => {
    // Handle tutorial completion - could redirect to lobby or show completion modal
    alert('Tutorial completed! Ready to play in the lobby!');
  };

  // Auto-complete steps that don't require user interaction
  useEffect(() => {
    // Auto-complete certain steps (like welcome, reference)
    if (currentStepData && (
      currentStepData.id === 'welcome' ||
      currentStepData.id === 'reference'
    )) {
      const timer = setTimeout(() => {
        setStepProgress(prev => ({ ...prev, [currentStep]: true }));
        setCompletedSteps(prev => new Set([...prev, currentStep]));
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [currentStep, currentStepData]);

  const renderStepCard = (card: StepCardType) => {
    const iconMap: { [key: string]: string } = {
      'concept': '📚',
      'interactive': '🎮',
      'example': '💡',
      'practice': '✏️',
      'tip': '💡'
    };

    const getCardIcon = () => {
      if (card.icon) return card.icon;
      return iconMap[card.type] || '📄';
    };

    return (
      <StepCard
        key={card.id}
        title={card.title}
        description={card.description}
        variant={card.type}
        icon={<span style={{ fontSize: '1.2em' }}>{getCardIcon()}</span>}
      >
        {renderCardContent(card.content)}
      </StepCard>
    );
  };

  const renderCardContent = (content: StepCardContent) => {
    switch (content.type) {
      case 'text':
        const data = content.data as string | { content?: string };
        const textContent = typeof data === 'string' ? data : (data as { content?: string })?.content || '';
        return (
          <div className={styles.textContent}>
            {textContent.split('\\n').map((line: string, index: number) => (
              <p key={index} dangerouslySetInnerHTML={{
                __html: line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
              }} />
            ))}
          </div>
        );

      case 'rule':
        const ruleData = content.data as { title: string; description: string; example?: string; details?: string };
        return (
          <div className={styles.ruleContent}>
            <h4>{ruleData.title}</h4>
            <p>{ruleData.description}</p>
            {ruleData.example && (
              <div className={styles.example}>
                <strong>例:</strong> {ruleData.example}
              </div>
            )}
            {ruleData.details && (
              <div className={styles.details}>
                {ruleData.details}
              </div>
            )}
          </div>
        );

      case 'checklist':
        const checklistData = content.data as { title: string; items: Array<{ text: string; checked: boolean }> };
        return (
          <div className={styles.checklistContent}>
            <h4>{checklistData.title}</h4>
            <ul className={styles.checklist}>
              {checklistData.items.map((item, index: number) => (
                <li key={index} className={item.checked ? styles.checked : ''}>
                  <input
                    type="checkbox"
                    checked={item.checked}
                    onChange={() => {
                      // Update item check status and step progress
                      const allChecked = checklistData.items.every((checkItem, i: number) =>
                        i === index ? !checkItem.checked : checkItem.checked
                      );
                      if (allChecked) {
                        handleStepComplete();
                      }
                    }}
                  />
                  <span>{item.text}</span>
                </li>
              ))}
            </ul>
          </div>
        );

      case 'code-snippet':
        const codeData = content.data as { title: string; code: string; explanation?: string };
        return (
          <div className={styles.codeContent}>
            <h4>{codeData.title}</h4>
            <pre className={styles.codeBlock}>
              <code>{codeData.code}</code>
            </pre>
            {codeData.explanation && (
              <p className={styles.explanation}>{codeData.explanation}</p>
            )}
          </div>
        );

      case 'example':
        const exampleData = content.data as { scenario: string; declaration?: string; explanation: string; result?: string };
        return (
          <div className={styles.exampleContent}>
            <h4>{exampleData.scenario}</h4>
            {exampleData.declaration && (
              <div className={styles.declaration}>
                <strong>宣言:</strong> {exampleData.declaration}
              </div>
            )}
            <p>{exampleData.explanation}</p>
            {exampleData.result && (
              <div className={styles.result}>
                <strong>結果:</strong> {exampleData.result}
              </div>
            )}
          </div>
        );

      case 'trump-hierarchy':
      case 'jack-system':
      case 'score-calculator':
      case 'interactive-demo':
        // These will be handled by the existing interactive components
        const interactiveData = content.data as { title?: string; description?: string };
        return (
          <div className={styles.interactivePlaceholder}>
            <button
              className={styles.interactiveButton}
              onClick={handleStepComplete}
            >
              {interactiveData.title || 'Try Interactive Demo'}
            </button>
            <p>{interactiveData.description}</p>
          </div>
        );

      default:
        return <div>Content type not supported</div>;
    }
  };

  return (
    <div className={styles.quickstartContainer}>
      <ProgressBar
        currentStep={currentStep}
        totalSteps={totalSteps}
        stepTitles={stepTitles}
      />

      <TutorialStep
        stepNumber={currentStep}
        title={currentStepData.title}
        subtitle={currentStepData.subtitle}
        isActive={true}
        isCompleted={completedSteps.has(currentStep)}
      >
        <div className={styles.stepInfo}>
          {currentStepData.estimatedTime && (
            <span className={styles.timeEstimate}>
              ⏱️ {currentStepData.estimatedTime}
            </span>
          )}
        </div>

        <div className={styles.stepCards}>
          {currentStepData.cards.map(renderStepCard)}
        </div>

        {currentStepData.nextStepPreview && !isCurrentStepComplete && (
          <div className={styles.nextPreview}>
            <h4>Next Up:</h4>
            <p>{currentStepData.nextStepPreview}</p>
          </div>
        )}
      </TutorialStep>

      <StepNavigation
        currentStep={currentStep}
        totalSteps={totalSteps}
        onPrevious={handlePreviousStep}
        onNext={handleNextStep}
        onStepComplete={handleTutorialComplete}
        isStepComplete={isCurrentStepComplete}
        nextStepLabel={currentStep === totalSteps ? 'Complete Tutorial' : 'Next Step'}
      />
    </div>
  );
}