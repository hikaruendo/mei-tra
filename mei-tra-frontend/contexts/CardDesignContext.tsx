'use client';

import { createContext, useContext } from 'react';
import type { CardDesign } from '@meitra/contracts/profile';

// A projection of the signed-in profile, with no independent storage or writer.
export const CardDesignContext = createContext<CardDesign>('standard');

export function useCardDesign() {
  return useContext(CardDesignContext);
}
