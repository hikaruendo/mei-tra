import {
  activateKeepAwakeAsync,
  deactivateKeepAwake,
} from 'expo-keep-awake';
import { useEffect } from 'react';

const createKeepAwakeTag = () =>
  `meitra-game-room-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function useGameKeepAwake(): void {
  useEffect(() => {
    const tag = createKeepAwakeTag();
    const activation = activateKeepAwakeAsync(tag);

    // Activation can fail when the platform does not support a wake lock.
    void activation.catch(() => undefined);

    return () => {
      // Wait for an in-flight activation before releasing it. Calling
      // deactivate first can leave a late activation without an owner.
      void activation
        .then(() => deactivateKeepAwake(tag))
        .catch(() => undefined);
    };
  }, []);
}
