'use client';

import styles from './JackSystem.module.scss';

interface JackSystemProps {
  data: {
    title: string;
  };
}

const trumpTypes = [
  { type: 'herz', label: 'ハート', suit: '♥', subSuit: '♦' },
  { type: 'daiya', label: 'ダイヤ', suit: '♦', subSuit: '♥' },
  { type: 'club', label: 'クラブ', suit: '♣', subSuit: '♠' },
  { type: 'zuppe', label: 'スペード', suit: '♠', subSuit: '♣' },
];

export function JackSystem({ data }: JackSystemProps) {
  return (
    <div className={styles.jackSystem}>
      <h3 className={styles.title}>{data.title}</h3>

      <div className={styles.explanation}>
        <p>カードの強さには特別なルールがあります：</p>
        <ul>
          <li><strong>JOKER</strong>：いかなる状況でも最強のカード（強度150）</li>
          <li><strong>正J（プライマリジャック）</strong>：トランプスートのJ（強度19）</li>
          <li><strong>副J（セカンダリジャック）</strong>：トランプスートと同色のJ（強度18）</li>
        </ul>
      </div>

      <div className={styles.trumpExamples}>
        {trumpTypes.map((trump) => (
          <div key={trump.type} className={styles.trumpExample}>
            <div className={styles.trumpHeader}>
              <span className={styles.trumpIcon}>{trump.suit}</span>
              <span className={styles.trumpLabel}>{trump.label}トランプ</span>
            </div>

            <div className={styles.strengthOrder}>
              <span>強さ順：</span>
              <span className={styles.orderText}>
                JOKER &gt; J{trump.suit} &gt; J{trump.subSuit} &gt; その他の{trump.label} &gt; 他のカード
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className={styles.traException}>
        <div className={styles.exceptionHeader}>
          <span className={styles.exceptionIcon}>⚠️</span>
          <span className={styles.exceptionTitle}>トラ宣言時の例外</span>
        </div>
        <p>
          トラ宣言では正J・副Jシステムは適用されません。<br/>
          すべてのジャックは通常の強度として扱われます。
        </p>
      </div>
    </div>
  );
}