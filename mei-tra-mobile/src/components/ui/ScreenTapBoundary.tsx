import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef,
  type PropsWithChildren,
} from 'react';
import { Platform, View } from 'react-native';

type TapListener = () => void;
const ScreenTapContext = createContext<{
  subscribe: (listener: TapListener) => () => void;
  protect: () => void;
} | null>(null);

/** Observes screen taps without claiming a responder or interrupting drags. */
export function ScreenTapBoundary({ children }: PropsWithChildren) {
  const listeners = useRef(new Set<TapListener>());
  const pending = useRef<Set<TapListener> | null>(null);
  const observeTap = useCallback(() => {
    const callbacks = new Set(listeners.current);
    pending.current = callbacks;
    // Descendant capture handlers can protect the selected card and explicit
    // actions before dismissal. Their press handlers keep the original state.
    // Browser microtasks may run between native document capture and React's
    // capture handler. Wait for the complete click dispatch on web.
    const afterDispatch = Platform.OS === 'web'
      ? (callback: () => void) => setTimeout(callback, 0)
      : queueMicrotask;
    afterDispatch(() => {
      if (pending.current === callbacks) pending.current = null;
      callbacks.forEach((callback) => {
        if (listeners.current.has(callback)) callback();
      });
    });
  }, []);
  const context = useMemo(() => ({
    subscribe: (listener: TapListener) => {
      listeners.current.add(listener);
      return () => { listeners.current.delete(listener); };
    },
    protect: () => pending.current?.clear(),
  }), []);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    // Includes viewport margins outside the Screen and Pressables that stop
    // click propagation. Native screens observe touch-end capture below.
    document.addEventListener('click', observeTap, true);
    return () => document.removeEventListener('click', observeTap, true);
  }, [observeTap]);

  return (
    <ScreenTapContext.Provider value={context}>
      <View
        onTouchEndCapture={Platform.OS === 'web' ? undefined : observeTap}
        style={{ flex: 1 }}
        testID="screen-tap-boundary"
      >
        {children}
      </View>
    </ScreenTapContext.Provider>
  );
}

export function useScreenTapDismiss(listener: TapListener | null) {
  const context = useContext(ScreenTapContext);
  useEffect(() => {
    if (listener) return context?.subscribe(listener);
  }, [context, listener]);
}

export function useScreenTapProtection() {
  const context = useContext(ScreenTapContext);
  return Platform.OS === 'web'
    ? { onClickCapture: context?.protect }
    : { onTouchEndCapture: context?.protect };
}
