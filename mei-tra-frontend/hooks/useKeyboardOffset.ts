'use client';

import { useState, useEffect } from 'react';

/**
 * Returns the pixel offset caused by the mobile virtual keyboard.
 * Uses the Visual Viewport API to detect when the keyboard pushes
 * the visible area up, so fixed-position elements can adjust.
 */
export function useKeyboardOffset(): number {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      // When the keyboard is open, visualViewport.height < window.innerHeight.
      // The difference is the keyboard height (approximately).
      const keyboardHeight = window.innerHeight - vv.height;
      setOffset(keyboardHeight > 0 ? keyboardHeight : 0);
    };

    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);

  return offset;
}
