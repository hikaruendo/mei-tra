'use client';

import { createContext, useContext } from 'react';
import type { HandSortDirection } from '@meitra/contracts/profile';

// A projection of the profile; preferences are saved only through the profile API.
export const HandSortContext = createContext<HandSortDirection>('strong-right');

export function useHandSortDirection() {
  return useContext(HandSortContext);
}
