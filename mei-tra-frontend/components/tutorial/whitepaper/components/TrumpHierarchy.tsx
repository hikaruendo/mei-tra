'use client';

import styles from './TrumpHierarchy.module.scss';

interface TrumpHierarchyProps {
  data: {
    title: string;
    trumps: Array<{
      type: string;
      label: string;
      strength: number;
      color: string;
    }>;
  };
}

export function TrumpHierarchy({ data }: TrumpHierarchyProps) {
  const getSuitIcon = (type: string) => {
    switch (type) {
      case 'tra': return '🃏';
      case 'herz': return '♥';
      case 'daiya': return '♦';
      case 'club': return '♣';
      case 'zuppe': return '♠';
      default: return '';
    }
  };

  return (
    <div className={styles.trumpHierarchy}>
      <h3 className={styles.title}>{data.title}</h3>

      <div className={styles.simpleList}>
        {data.trumps.map((trump, index) => (
          <div key={trump.type} className={styles.trumpRow}>
            <span className={styles.strength}>{trump.strength}</span>
            <div
              className={styles.trumpName}
              style={{ color: trump.color }}
            >
              <span className={styles.suit}>{getSuitIcon(trump.type)}</span>
              <span>{trump.label}</span>
            </div>
            {index < data.trumps.length - 1 && (
              <span className={styles.separator}>&gt;</span>
            )}
          </div>
        ))}
      </div>

      <p className={styles.note}>
        同じペア数では、より強いトランプの宣言が上位となります
      </p>
    </div>
  );
}