export type TrumpType = 'tra' | 'herz' | 'daiya' | 'club' | 'zuppe';

export interface Section {
  id: string;
  title: string;
  content: ContentBlock[];
}

export interface ContentBlock {
  type:
    | 'text'
    | 'rule'
    | 'example'
    | 'trump-hierarchy'
    | 'interactive-demo'
    | 'tip'
    | 'jack-system'
    | 'score-calculator';
  content:
    | string
    | RuleBlock
    | ExampleBlock
    | TrumpHierarchyBlock
    | InteractiveDemoBlock
    | TipBlock
    | JackSystemBlock
    | ScoreCalculatorBlock;
}

export interface RuleBlock {
  title: string;
  description: string;
  example?: string;
}

export interface ExampleBlock {
  scenario: string;
  cards?: string[];
  declaration?: string;
  explanation: string;
}

export interface TrumpHierarchyBlock {
  title: string;
  trumps: Array<{
    type: TrumpType;
    label: string;
    strength: number;
    color: string;
  }>;
}

export interface InteractiveDemoBlock {
  title: string;
  description: string;
}

export interface TipBlock {
  title: string;
  tips: string[];
}

export interface JackSystemBlock {
  title: string;
}

export interface ScoreCalculatorBlock {
  title: string;
  description: string;
}
