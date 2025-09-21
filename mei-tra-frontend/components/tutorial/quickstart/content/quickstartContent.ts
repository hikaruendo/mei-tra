export type TrumpType = 'tra' | 'herz' | 'daiya' | 'club' | 'zuppe';

export interface QuickstartStep {
  id: string;
  title: string;
  subtitle?: string;
  estimatedTime?: string;
  cards: StepCard[];
  completionCriteria?: string;
  nextStepPreview?: string;
}

export interface StepCard {
  id: string;
  type: 'concept' | 'interactive' | 'example' | 'practice' | 'tip';
  title: string;
  description?: string;
  content: StepCardContent;
  icon?: string;
}

export interface StepCardContent {
  type: 'text' | 'rule' | 'example' | 'trump-hierarchy' | 'jack-system' | 'score-calculator' | 'interactive-demo' | 'checklist' | 'code-snippet';
  data: unknown; // Using unknown for flexible content data
}

export interface TextData {
  content?: string;
}

export interface RuleData {
  title: string;
  description: string;
  example?: string;
  details?: string;
}

export interface ExampleData {
  scenario: string;
  declaration?: string;
  explanation: string;
  result?: string;
}

export interface TrumpHierarchyData {
  title: string;
  trumps: Array<{
    type: TrumpType;
    label: string;
    strength: number;
    color: string;
  }>;
}

export interface ChecklistData {
  title: string;
  items: Array<{
    text: string;
    checked: boolean;
  }>;
}

export interface CodeSnippetData {
  title: string;
  code: string;
  language?: string;
  explanation?: string;
}

export interface InteractiveData {
  title: string;
  description: string;
}

export const quickstartSteps: QuickstartStep[] = [
  {
    id: 'welcome',
    title: 'Getting Started',
    subtitle: 'Welcome to Mei-Tra Trump',
    estimatedTime: '2 minutes',
    cards: [
      {
        id: 'game-intro',
        type: 'concept',
        title: 'What is Mei-Tra Trump?',
        description: 'A strategic 4-player, 2-team card game',
        icon: '🎯',
        content: {
          type: 'text',
          data: '明専トランプは4人2チーム制の戦略的カードゲームです。**ブロー（宣言）システム**、**特殊なジャック機能**、**詳細なスコアリングシステム**が組み合わさった高度なゲームです。\\n\\n**目標**: 先に10点を獲得したチームが勝利'
        }
      },
      {
        id: 'game-flow',
        type: 'concept',
        title: 'Game Flow Overview',
        description: 'Each round has 4 distinct phases',
        icon: '🔄',
        content: {
          type: 'checklist',
          data: {
            title: 'Round Structure',
            items: [
              { text: 'Deal - Cards are distributed to players', checked: false },
              { text: 'Blow - Players declare trump and pairs', checked: false },
              { text: 'Play - Cards are played in 10 fields', checked: false },
              { text: 'Waiting - Scores calculated and next round', checked: false }
            ]
          }
        }
      },
      {
        id: 'team-setup',
        type: 'example',
        title: 'Team Formation',
        description: 'How players are arranged',
        icon: '👥',
        content: {
          type: 'text',
          data: '**チーム構成**: 対面に座る2人が1チーム\\n\\n```\\n    Player 2\\n      │\\nPlayer 3 ─┼─ Player 1\\n      │\\n    Player 4\\n```\\n\\n**Team A**: Player 1 & Player 3\\n**Team B**: Player 2 & Player 4'
        }
      }
    ],
    completionCriteria: 'Understand basic game structure and team formation',
    nextStepPreview: 'Learn about the cards used in the game'
  },
  {
    id: 'cards',
    title: 'Cards & Deck',
    subtitle: 'Understanding the card system',
    estimatedTime: '3 minutes',
    cards: [
      {
        id: 'deck-composition',
        type: 'concept',
        title: 'Deck Composition',
        description: 'Cards used for playing',
        icon: '🃏',
        content: {
          type: 'rule',
          data: {
            title: 'Playing Cards (53 total)',
            description: 'Cards 5-A from each suit + 1 JOKER',
            example: '各スート（♠♥♦♣）：5,6,7,8,9,10,J,Q,K,A + JOKER1枚',
            details: 'Cards 2, 3, 4 are excluded from play but used for scoring display'
          }
        }
      },
      {
        id: 'card-strength',
        type: 'concept',
        title: 'Basic Card Strength',
        description: 'How cards are ranked',
        icon: '💪',
        content: {
          type: 'code-snippet',
          data: {
            title: 'Card Strength Hierarchy',
            code: 'JOKER (150) > A (14) > K (13) > Q (12) > J (11) > 10 (10) > 9 (9) > 8 (8) > 7 (7) > 6 (6) > 5 (5)',
            language: 'ranking',
            explanation: 'Base strength values - bonuses are added during play'
          }
        }
      },
      {
        id: 'score-cards',
        type: 'tip',
        title: 'Score Display Cards',
        description: 'Separate cards for tracking points',
        icon: '📊',
        content: {
          type: 'text',
          data: '**スコア表示用**\\n\\n- **赤チーム**: ♥の2,3,4\\n- **黒チーム**: ♠の2,3,4\\n\\nこれらのカードはプレイには使用せず、チームのスコア表示にのみ使用します。'
        }
      }
    ],
    completionCriteria: 'Understand deck composition and basic card rankings',
    nextStepPreview: 'Learn the blow declaration system'
  },
  {
    id: 'blow-declaration',
    title: 'Blow Declaration',
    subtitle: 'The heart of the game strategy',
    estimatedTime: '5 minutes',
    cards: [
      {
        id: 'blow-concept',
        type: 'concept',
        title: 'What is Blow Declaration?',
        description: 'Declaring trump suit and pairs to win',
        icon: '🎯',
        content: {
          type: 'text',
          data: 'ブロー宣言では**「10フィールドのうち何ペア取れるか」**と**「使用するスート（切り札）」**を宣言します。\\n\\n**ペア = フィールド数**: 獲得できるトリック数を意味します\\n**最低宣言**: 6ペア以上が必須'
        }
      },
      {
        id: 'trump-hierarchy',
        type: 'interactive',
        title: 'Trump Suit Hierarchy',
        description: 'Understanding suit strength order',
        icon: '👑',
        content: {
          type: 'trump-hierarchy',
          data: {
            title: 'スートの強さ順',
            trumps: [
              { type: 'tra', label: 'トラ', strength: 5, color: '#FF6B00' },
              { type: 'herz', label: 'ハート', strength: 4, color: '#E91E63' },
              { type: 'daiya', label: 'ダイヤ', strength: 3, color: '#2196F3' },
              { type: 'club', label: 'クラブ', strength: 2, color: '#4CAF50' },
              { type: 'zuppe', label: 'スペード', strength: 1, color: '#424242' }
            ]
          }
        }
      },
      {
        id: 'declaration-rules',
        type: 'concept',
        title: 'Declaration Rules',
        description: 'How to make higher declarations',
        icon: '📈',
        content: {
          type: 'rule',
          data: {
            title: '上位宣言の条件',
            description: '以下のいずれかで上位宣言が可能',
            example: 'クラブ7ペア → ハート7ペア（同ペア、強スート）\\nクラブ7ペア → クラブ8ペア（多ペア）',
            details: '①ペア数を増やす　②同ペア数で強いスートにする'
          }
        }
      },
      {
        id: 'blow-practice',
        type: 'practice',
        title: 'Try Blow Declaration',
        description: 'Practice making declarations',
        icon: '🎮',
        content: {
          type: 'interactive-demo',
          data: {
            title: 'ブロー宣言を練習してみよう',
            description: '実際のブロー宣言システムを体験して、上位宣言のルールを理解しましょう。'
          }
        }
      }
    ],
    completionCriteria: 'Successfully make a valid blow declaration',
    nextStepPreview: 'Explore the special Jack and JOKER system'
  },
  {
    id: 'jack-system',
    title: 'Jack & JOKER System',
    subtitle: 'Special card mechanics',
    estimatedTime: '4 minutes',
    cards: [
      {
        id: 'joker-supreme',
        type: 'concept',
        title: 'JOKER - The Supreme Card',
        description: 'Always the strongest card',
        icon: '🃏',
        content: {
          type: 'text',
          data: '**JOKER**は**いかなる状況でも最強**のカードです。\\n\\n- **強度**: 150（他のカードより圧倒的に強い）\\n- **トランプボーナス**: なし（既に最強のため）\\n- **戦略**: 使うタイミングが勝負を決める'
        }
      },
      {
        id: 'jack-special',
        type: 'interactive',
        title: 'Jack Special System',
        description: 'Primary and Secondary Jacks',
        icon: '👑',
        content: {
          type: 'jack-system',
          data: {
            title: 'ジャックシステム詳細'
          }
        }
      },
      {
        id: 'jack-strength',
        type: 'example',
        title: 'Jack Strength Examples',
        description: 'How Jack strength works in practice',
        icon: '💡',
        content: {
          type: 'code-snippet',
          data: {
            title: 'ハートトランプ時のジャック強度',
            code: '♥J (正J): 11 + 100 = 111 (最強ジャック)\\n♦J (副J): 11 + 100 = 111 (同等に強い)\\n♠J (通常): 11 + 0 = 11 (通常ジャック)\\n♣J (通常): 11 + 0 = 11 (通常ジャック)',
            language: 'calculation',
            explanation: 'トランプスートによって特定のジャックが特別な強さを持ちます'
          }
        }
      }
    ],
    completionCriteria: 'Understand JOKER supremacy and Jack special mechanics',
    nextStepPreview: 'Learn how to play cards in the Play phase'
  },
  {
    id: 'play-phase',
    title: 'Play Phase',
    subtitle: 'Playing cards to win fields',
    estimatedTime: '4 minutes',
    cards: [
      {
        id: 'play-order',
        type: 'concept',
        title: 'Play Order',
        description: 'Who plays when',
        icon: '🔄',
        content: {
          type: 'rule',
          data: {
            title: 'プレイの基本順序',
            description: 'ディーラー（最高宣言者）から時計回りにカードを出す',
            example: '1枚目：ディーラー → 2枚目：左隣 → 3枚目：正面 → 4枚目：右隣',
            details: 'フィールド勝者が次のフィールドのディーラーになる'
          }
        }
      },
      {
        id: 'base-suit',
        type: 'concept',
        title: 'Base Suit System',
        description: 'First card determines field advantage',
        icon: '🎴',
        content: {
          type: 'text',
          data: '**ベーススート（台札）**\\n\\n最初に出されたカードのスートがそのフィールドのベーススートになります。\\n\\n**ボーナス**: ベーススートのカードは**+50**の強度ボーナス\\n\\n**例**: ♠5が最初 → ♠がベーススート → ♠のカードに+50ボーナス'
        }
      },
      {
        id: 'strength-calculation',
        type: 'example',
        title: 'Card Strength Calculation',
        description: 'How final strength is determined',
        icon: '🧮',
        content: {
          type: 'code-snippet',
          data: {
            title: 'カード強度の計算式',
            code: '最終強度 = 基本強度 + トランプボーナス(+100) + ベーススートボーナス(+50)',
            language: 'formula',
            explanation: 'ハートトランプ、♠ベース時:\\n♥K = 13 + 100 + 0 = 113\\n♠K = 13 + 0 + 50 = 63\\n♦7 = 7 + 0 + 0 = 7'
          }
        }
      },
      {
        id: 'field-winner',
        type: 'tip',
        title: 'Determining Field Winner',
        description: 'Strongest card wins the field',
        icon: '🏆',
        content: {
          type: 'text',
          data: '**フィールド勝者の決定**\\n\\n1. **JOKER** - 常に勝利\\n2. **トランプスートのカード** - +100ボーナス\\n3. **ベーススートのカード** - +50ボーナス\\n4. **その他のカード** - 基本強度のみ\\n\\n最も強度の高いカードを出したプレイヤーがフィールドを獲得します。'
        }
      }
    ],
    completionCriteria: 'Understand play order and card strength calculation',
    nextStepPreview: 'Learn the scoring system'
  },
  {
    id: 'scoring',
    title: 'Scoring System',
    subtitle: 'How points are calculated',
    estimatedTime: '5 minutes',
    cards: [
      {
        id: 'score-formula',
        type: 'concept',
        title: 'Scoring Formula',
        description: 'Based on declared vs actual pairs',
        icon: '📊',
        content: {
          type: 'code-snippet',
          data: {
            title: 'スコア計算式',
            code: 'X = 宣言ペア数, Y = 獲得フィールド数\\n\\nY ≥ X の場合: 0.5 × (Y - X) + X - 5 点\\nY < X の場合: Y - X 点（マイナス）',
            language: 'formula',
            explanation: '宣言を達成すれば基本点 + ボーナス、失敗すればマイナス点'
          }
        }
      },
      {
        id: 'score-calculator',
        type: 'interactive',
        title: 'Score Calculator',
        description: 'Calculate scores for different scenarios',
        icon: '🧮',
        content: {
          type: 'score-calculator',
          data: {
            title: 'スコア計算機',
            description: '宣言ペア数と獲得フィールド数を入力して、実際のスコアを計算してみましょう。'
          }
        }
      },
      {
        id: 'success-example',
        type: 'example',
        title: 'Success Example',
        description: 'When declaration is achieved',
        icon: '✅',
        content: {
          type: 'example',
          data: {
            scenario: '宣言達成の例',
            declaration: '7ペア宣言で8フィールド獲得',
            explanation: 'Y(8)≥X(7)なので：0.5×(8-7)+7-5 = 0.5×1+2 = 2.5点',
            result: '+2.5点獲得'
          }
        }
      },
      {
        id: 'failure-example',
        type: 'example',
        title: 'Failure Example',
        description: 'When declaration fails',
        icon: '❌',
        content: {
          type: 'example',
          data: {
            scenario: '宣言失敗の例',
            declaration: '8ペア宣言で6フィールド獲得',
            explanation: 'Y(6)<X(8)なので：6-8 = -2点（マイナス）',
            result: '-2点（相手チームが+2点）'
          }
        }
      }
    ],
    completionCriteria: 'Successfully calculate scores using the calculator',
    nextStepPreview: 'Learn about game violations and penalties'
  },
  {
    id: 'violations',
    title: 'Chombo System',
    subtitle: 'Violations and penalties',
    estimatedTime: '3 minutes',
    cards: [
      {
        id: 'chombo-concept',
        type: 'concept',
        title: 'What is Chombo?',
        description: 'Violation reporting system',
        icon: '⚠️',
        content: {
          type: 'text',
          data: '**Chombo（チョンボ）**はゲーム中の規則違反です。\\n\\n- **報告者**: 相手チームのみ（同チーム内は不可）\\n- **効果**: 違反チームにペナルティ\\n- **重要性**: 戦略的に勝負を決定する要素'
        }
      },
      {
        id: 'common-violations',
        type: 'concept',
        title: 'Common Violations',
        description: 'Main types of rule violations',
        icon: '📋',
        content: {
          type: 'checklist',
          data: {
            title: '主要な違反タイプ',
            items: [
              { text: 'ネグリ忘れ - Negri card selection forgotten', checked: false },
              { text: '4J違反 - Failed to declare broken with 4 Jacks', checked: false },
              { text: '最後タンツェン - Last card is JOKER', checked: false },
              { text: '間違ったブロークン宣言 - Invalid broken declaration', checked: false },
              { text: '間違ったオープン宣言 - Invalid open declaration', checked: false },
              { text: '点数間違い - Score calculation error', checked: false }
            ]
          }
        }
      },
      {
        id: 'four-jack-rule',
        type: 'tip',
        title: 'Four Jack Rule',
        description: 'Special mandatory broken declaration',
        icon: '👑',
        content: {
          type: 'rule',
          data: {
            title: '4J違反（four-jack）',
            description: 'ジャック4枚所持時に必須ブロークン宣言を怠る違反',
            example: '♠J,♥J,♦J,♣J所持でブロークン未宣言 → 違反',
            details: 'この状況では必ずブロークンを宣言する必要があります'
          }
        }
      }
    ],
    completionCriteria: 'Understand major violation types and reporting rules',
    nextStepPreview: 'Learn winning strategies and tips'
  },
  {
    id: 'strategy',
    title: 'Strategy & Tips',
    subtitle: 'Winning tactics and team play',
    estimatedTime: '4 minutes',
    cards: [
      {
        id: 'blow-strategy',
        type: 'tip',
        title: 'Blow Declaration Strategy',
        description: 'How to make smart declarations',
        icon: '🎯',
        content: {
          type: 'checklist',
          data: {
            title: 'ブロー宣言のコツ',
            items: [
              { text: '手札の強さを見極めて、取れるペア数を予測', checked: false },
              { text: '6-7ペア程度の安全な宣言から始める', checked: false },
              { text: '強いトランプは高リスク・高リターン', checked: false },
              { text: 'パートナーの宣言パターンを観察', checked: false },
              { text: 'ジャック4枚時は必須ブロークン宣言', checked: false }
            ]
          }
        }
      },
      {
        id: 'play-strategy',
        type: 'tip',
        title: 'Play Phase Strategy',
        description: 'Tactical card play',
        icon: '🃏',
        content: {
          type: 'checklist',
          data: {
            title: 'プレイフェーズの戦略',
            items: [
              { text: 'トランプカードの使いどころを見極める', checked: false },
              { text: 'ベーススートを意識したプレイ', checked: false },
              { text: '正J・副Jは温存か早期使用か判断', checked: false },
              { text: 'パートナーの強いカードを活かす', checked: false },
              { text: '相手の宣言数を覚えて調整する', checked: false }
            ]
          }
        }
      },
      {
        id: 'team-coordination',
        type: 'tip',
        title: 'Team Coordination',
        description: 'Working with your partner',
        icon: '🤝',
        content: {
          type: 'checklist',
          data: {
            title: 'チーム連携のポイント',
            items: [
              { text: 'パートナーの宣言を支援する動き', checked: false },
              { text: '相手チームの宣言妨害戦略', checked: false },
              { text: 'Chombo違反を見逃さずに指摘', checked: false },
              { text: 'スコア計算を共有して状況把握', checked: false },
              { text: '長期的視点で10点到達を目指す', checked: false }
            ]
          }
        }
      }
    ],
    completionCriteria: 'Review all strategic guidelines',
    nextStepPreview: 'Quick reference and next steps'
  },
  {
    id: 'reference',
    title: 'Quick Reference',
    subtitle: 'Summary and next steps',
    estimatedTime: '2 minutes',
    cards: [
      {
        id: 'quick-reference',
        type: 'concept',
        title: 'Essential Information',
        description: 'Key facts at a glance',
        icon: '📋',
        content: {
          type: 'code-snippet',
          data: {
            title: 'クイックリファレンス',
            code: '# Trump Hierarchy\\nトラ(5) > ハート(4) > ダイヤ(3) > クラブ(2) > スペード(1)\\n\\n# Card Strength\\nJOKER(150) > A(14) > K(13) > Q(12) > J(11) > 10-5\\n\\n# Strength Bonuses\\nTrump Suit: +100 | Base Suit: +50\\n\\n# Scoring\\nY≥X: 0.5×(Y-X)+X-5 | Y<X: Y-X\\n\\n# Game Flow\\nDeal → Blow → Play → Waiting',
            language: 'reference',
            explanation: 'Keep this handy during your first games!'
          }
        }
      },
      {
        id: 'next-steps',
        type: 'tip',
        title: 'What\'s Next?',
        description: 'Continue your learning journey',
        icon: '🚀',
        content: {
          type: 'checklist',
          data: {
            title: '次のアクション',
            items: [
              { text: 'ロビーで練習対局を開始する', checked: false },
              { text: '観戦モードで上級者のプレイを学ぶ', checked: false },
              { text: 'スコア計算機で様々なシナリオを試す', checked: false },
              { text: 'ジャックシステムデモで理解を深める', checked: false },
              { text: '友達とチーム戦を楽しむ', checked: false }
            ]
          }
        }
      }
    ],
    completionCriteria: 'Tutorial completed! Ready to play',
    nextStepPreview: 'Start playing in the lobby!'
  }
];

export const stepTitles = quickstartSteps.map(step => step.title);