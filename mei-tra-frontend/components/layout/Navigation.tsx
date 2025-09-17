'use client';

import Link from 'next/link';
import { UserProfile } from '../profile/UserProfile';
import styles from './Navigation.module.scss';

export function Navigation() {
  return (
    <nav className={styles.navigation}>
      <div className={styles.container}>
        <div className={styles.content}>
          <div className={styles.brand}>
            <Link
              href="/"
              className={styles.brandLink}
            >
              明専トランプ
            </Link>
          </div>

          <div className={styles.menu}>
            <Link
              href="/rooms"
              className={styles.navLink}
            >
              ルーム一覧
            </Link>
            <UserProfile />
          </div>
        </div>
      </div>
    </nav>
  );
}