export type TrumpType = 'tra' | 'herz' | 'daiya' | 'club' | 'zuppe';

export interface Section {
  id: string;
  title: string;
  content: ContentBlock[];
}

export interface ContentBlock {
  type: 'text' | 'rule' | 'example' | 'trump-hierarchy' | 'interactive-demo' | 'tip' | 'jack-system' | 'score-calculator';
  content: string | RuleBlock | ExampleBlock | TrumpHierarchyBlock | InteractiveDemoBlock | TipBlock | JackSystemBlock | ScoreCalculatorBlock;
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

export const tutorialSections: Section[] = [
  {
    id: 'overview',
    title: 'ゲームの概要',
    content: [
      {
        type: 'text',
        content: '明専トランプは4人2チーム制の戦略的カードゲームです。ブロー（宣言）システム、特殊なジャック機能、詳細なスコアリングシステムが組み合わさった高度なゲームです。'
      },
      {
        type: 'rule',
        content: {
          title: 'ゲームの目的',
          description: 'ブロー宣言で宣言したペア数を達成し、先に10点を獲得したチームが勝利',
          example: 'チーム戦：対面に座る2人が1チーム、規定点数は設定により変更可能'
        }
      },
      {
        type: 'rule',
        content: {
          title: 'ゲームフロー',
          description: '各ラウンドは4つのフェーズで構成される',
          example: 'Deal（配布） → Blow（宣言） → Play（プレイ） → Waiting（待機）'
        }
      }
    ]
  },
  {
    id: 'cards-and-deck',
    title: 'カードとデッキ',
    content: [
      {
        type: 'rule',
        content: {
          title: '使用カード構成',
          description: 'プレイ用：5-A + JOKER（計53枚）を使用。2,3,4は除外',
          example: '各スート（♠♥♦♣）：5,6,7,8,9,10,J,Q,K,A + JOKER1枚'
        }
      },
      {
        type: 'rule',
        content: {
          title: 'スコアカード',
          description: 'スコア表示に2,3,4のカードを別途使用',
          example: '赤チーム：♥の2,3,4 / 黒チーム：♠の2,3,4'
        }
      },
      {
        type: 'rule',
        content: {
          title: 'カード強度の基本',
          description: 'JOKER > A > K > Q > J > 10 > 9 > 8 > 7 > 6 > 5',
          example: '数値：JOKER, A, K, Q, J, 10, 9, 8, 7, 6, 5...'
        }
      }
    ]
  },
  {
    id: 'blow-system',
    title: 'ブロー（宣言）システム',
    content: [
      {
        type: 'text',
        content: 'ブロー宣言では「10フィールドのうち何ペア取れるか」と「使用するスート（切り札）」を宣言します。このシステムがゲームの核心部分です。ペアとは獲得できるフィールド数を意味します。'
      },
      {
        type: 'rule',
        content: {
          title: '基本宣言ルール',
          description: '最低6ペア宣言が必須。ペア数とスート種類の組み合わせで宣言',
          example: '「ハート7ペア」「ダイヤ6ペア」「トラ8ペア」など'
        }
      },
      {
        type: 'trump-hierarchy',
        content: {
          title: 'スートの強さ順',
          trumps: [
            { type: 'tra', label: 'トラ', strength: 5, color: '#FF6B00' },
            { type: 'herz', label: 'ハート', strength: 4, color: '#E91E63' },
            { type: 'daiya', label: 'ダイヤ', strength: 3, color: '#2196F3' },
            { type: 'club', label: 'クラブ', strength: 2, color: '#4CAF50' },
            { type: 'zuppe', label: 'スペード', strength: 1, color: '#424242' }
          ]
        }
      },
      {
        type: 'rule',
        content: {
          title: '上位宣言の条件',
          description: '①ペア数を増やす　②同ペア数で強いスートにする',
          example: 'クラブ7ペア → ハート7ペア（同ペア、強スート）/ クラブ8ペア（多ペア）'
        }
      },
      {
        type: 'interactive-demo',
        content: {
          title: 'ブロー宣言を練習してみよう',
          description: '実際のブロー宣言システムを体験して、上位宣言のルールを理解しましょう。'
        }
      }
    ]
  },
  {
    id: 'jack-system',
    title: 'JOKERとジャックの特殊システム',
    content: [
      {
        type: 'text',
        content: 'JOKERは常に最強のカードです。また、ジャック（J）には特殊な役割があり、トランプスート決定後、特定のジャックが特別な強さを持ちます。'
      },
      {
        type: 'jack-system',
        content: {
          title: 'ジャックシステム詳細'
        }
      },
    ]
  },
  {
    id: 'play-phase',
    title: 'プレイフェーズ',
    content: [
      {
        type: 'text',
        content: 'ブロー宣言終了後、実際にカードをプレイしてフィールド（トリック）を競います。10回のフィールドで何ペア取れるかが勝負です。'
      },
      {
        type: 'rule',
        content: {
          title: 'プレイの基本順序',
          description: 'ディーラー（最高宣言者）から時計回りにカードを出す',
          example: '1枚目：ディーラー → 2枚目：左隣 → 3枚目：正面 → 4枚目：右隣'
        }
      },
      {
        type: 'rule',
        content: {
          title: 'フィールド勝者の決定',
          description: 'カード強度システムに基づいて、最も強いカードを出したプレイヤーが勝利',
          example: 'トランプ（+100） > ベーススート（+50） > その他'
        }
      },
      {
        type: 'rule',
        content: {
          title: 'ベーススート（台札）',
          description: '最初に出されたカードのスートがそのフィールドのベーススート',
          example: '♠5が最初 → ♠がベーススート → ♠のカードに+50ボーナス'
        }
      },
      {
        type: 'rule',
        content: {
          title: 'カード強度計算',
          description: '基本強度 + トランプボーナス(+100) + ベーススートボーナス(+50)',
          example: 'ハートトランプ時：♥K = 13 + 100 = 113, ♠K = 13 + 50 = 63（♠がベース時）'
        }
      }
    ]
  },
  {
    id: 'broken-negri',
    title: 'ブロークン・ネグリシステム',
    content: [
      {
        type: 'text',
        content: '特定の手札状況では「ブロークン」状態となり、特別なルールが適用されます。また、最弱カード（ネグリ）の選択も重要な要素です。'
      },
      {
        type: 'rule',
        content: {
          title: 'ブロークン判定',
          description: '絵札（A,K,Q,J）がない、またはQが1枚だけの場合にブロークン状態',
          example: '手札：5,6,7,8,9,10のみ → ブロークン'
        }
      },
      {
        type: 'rule',
        content: {
          title: '必須ブロークン',
          description: 'ジャック4枚を持っている場合は必須でブロークン宣言',
          example: '♠J, ♥J, ♦J, ♣J すべて所持 → 必須ブロークン'
        }
      },
      {
        type: 'rule',
        content: {
          title: 'ネグリ（不要カード）',
          description: '各プレイヤーが自分の手札で最も不要と考えるカードを選択',
          example: 'プレイ開始前に秘密裏に選択'
        }
      }
    ]
  },
  {
    id: 'scoring',
    title: 'スコアリングシステム',
    content: [
      {
        type: 'text',
        content: '宣言したペア数と実際に獲得したフィールド数に基づいて、スコアが計算されます。'
      },
      {
        type: 'score-calculator',
        content: {
          title: 'スコア計算機',
          description: '宣言ペア数と獲得フィールド数を入力して、実際のスコアを計算してみましょう。'
        }
      },
      {
        type: 'rule',
        content: {
          title: 'スコア計算式',
          description: '宣言ペア数をX、獲得フィールド数をYとする',
          example: 'Y≥X時：0.5×(Y-X)+X-5点 / Y<X時：Y-X点'
        }
      },
      {
        type: 'example',
        content: {
          scenario: '宣言達成の例',
          declaration: '7ペア宣言で8フィールド獲得',
          explanation: 'Y(8)≥X(7)なので：0.5×(8-7)+7-5 = 0.5×1+2 = 2.5点'
        }
      },
      {
        type: 'example',
        content: {
          scenario: '宣言失敗の例',
          declaration: '8ペア宣言で6フィールド獲得',
          explanation: 'Y(6)<X(8)なので：6-8 = -2点（マイナス）'
        }
      }
    ]
  },
  {
    id: 'chombo-violations',
    title: 'Chombo（違反）システム',
    content: [
      {
        type: 'text',
        content: 'ゲーム中の不正行為や規則違反をChombo（チョンボ）と呼び、相手チームが指摘することでペナルティが課せられます。'
      },
      {
        type: 'rule',
        content: {
          title: 'ネグリ忘れ（negri-forget）',
          description: 'ネグリカードの選択を忘れた場合の違反',
          example: 'プレイ開始時にネグリ未選択 → 違反として報告可能'
        }
      },
      {
        type: 'rule',
        content: {
          title: '4J違反（four-jack）',
          description: 'ジャック4枚所持時に必須ブロークン宣言を怠る違反',
          example: '♠J,♥J,♦J,♣J所持でブロークン未宣言 → 違反'
        }
      },
      {
        type: 'rule',
        content: {
          title: '最後タンツェン（last-tanzen）',
          description: '最後の1枚がJOKERの場合の特殊違反',
          example: '手札最後の1枚がJOKER → 特殊違反として処理'
        }
      },
      {
        type: 'rule',
        content: {
          title: '間違ったブロークン宣言',
          description: 'ブロークン状態でないのにブロークン宣言した場合',
          example: '絵札ありでブロークン宣言 → 違反として報告可能'
        }
      },
      {
        type: 'rule',
        content: {
          title: '違反報告システム',
          description: '相手チームのみが違反を指摘可能、同チーム内では不可',
          example: '違反発見 → 相手チームが報告 → ペナルティ適用'
        }
      }
    ]
  },
  {
    id: 'strategy',
    title: '戦略とコツ',
    content: [
      {
        type: 'tip',
        content: {
          title: 'ブロー宣言戦略',
          tips: [
            '手札の強さを見極めて、10フィールドのうち何ペア取れるか予測する',
            '強いトランプは宣言が上がりやすいがリスクも高い',
            '6-7ペア程度の安全な宣言から始める',
            'パートナーの宣言パターンを観察して連携する',
            'ジャック4枚時は必須ブロークン、隠さず正直に宣言'
          ]
        }
      },
      {
        type: 'tip',
        content: {
          title: 'プレイフェーズ戦略',
          tips: [
            'トランプカードは強力だが使いどころを見極める',
            'ベーススートを意識してカードを出す',
            '正J・副Jは最強クラス、温存か早期使用か判断',
            'パートナーの強いカードを活かすプレイを心がける',
            '相手の宣言数を覚えて、取らせるフィールドを調整'
          ]
        }
      },
      {
        type: 'tip',
        content: {
          title: 'チーム連携',
          tips: [
            'パートナーの宣言を支援する動きを取る',
            '相手チームの宣言を妨害する戦略も重要',
            'Chombo違反を見逃さずに指摘する',
            'スコア計算を共有してゲーム状況を把握',
            '長期的な視点で10点到達を目指す'
          ]
        }
      }
    ]
  },
  {
    id: 'quick-reference',
    title: 'クイックリファレンス',
    content: [
      {
        type: 'text',
        content: '### トランプ強さ順\nトラ(5) > ハート(4) > ダイヤ(3) > クラブ(2) > スペード(1)'
      },
      {
        type: 'text',
        content: '### カード強度\nJOKER(150) > A(14) > K(13) > Q(12) > J(11) > 10(10) > 9(9) > 8(8) > 7(7) > 6(6) > 5(5)'
      },
      {
        type: 'text',
        content: '### 強度ボーナス\nトランプスート: +100 / ベーススート: +50'
      },
      {
        type: 'text',
        content: '### ジャックシステム\n正J（トランプスートのJ） / 副J（トランプにより異なる）'
      },
      {
        type: 'text',
        content: '### スコア計算\nY≥X: 0.5×(Y-X)+X-5点 / Y<X: Y-X点\n(X=宣言ペア数, Y=獲得フィールド数)'
      },
      {
        type: 'text',
        content: '### 主要違反\nネグリ忘れ / 4J違反 / 最後タンツェン / 間違ったブロークン / 間違ったオープン'
      },
      {
        type: 'text',
        content: '### ゲームフロー\nDeal → Blow → Play → Waiting（10フィールド完了まで）'
      },
      {
        type: 'text',
        content: '### 基本設定\n4人2チーム / 対面がパートナー / 10点先取勝利 / 最低6ペア宣言'
      }
    ]
  }
]
