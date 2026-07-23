import { useRouter } from 'expo-router';
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { NotificationResponse } from 'expo-notifications';

import { useAuth } from '@/context/AuthContext';
import {
  getNotificationRoomId,
  registerForPushNotifications,
  setupNotificationHandling,
  type NotificationRegistrationStatus,
} from '@/lib/notifications';

interface NotificationContextValue {
  status: NotificationRegistrationStatus | 'idle' | 'registering';
  retryRegistration: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: PropsWithChildren) {
  const router = useRouter();
  const { user, session, getAccessToken } = useAuth();
  const [status, setStatus] = useState<NotificationContextValue['status']>('idle');
  const pendingRoomIdRef = useRef<string | null>(null);
  const handledResponseIdsRef = useRef(new Set<string>());
  const registeredUserIdRef = useRef<string | null>(null);

  const routeToRoom = useCallback(
    (roomId: string) => {
      if (!user) {
        pendingRoomIdRef.current = roomId;
        return;
      }

      pendingRoomIdRef.current = null;
      router.push({ pathname: '/room/[roomId]', params: { roomId } });
    },
    [router, user],
  );

  const handleResponse = useCallback(
    (response: NotificationResponse) => {
      const responseId = response.notification.request.identifier;
      if (handledResponseIdsRef.current.has(responseId)) return;
      handledResponseIdsRef.current.add(responseId);
      if (handledResponseIdsRef.current.size > 20) {
        const oldest = handledResponseIdsRef.current.values().next().value;
        if (typeof oldest === 'string') handledResponseIdsRef.current.delete(oldest);
      }

      const roomId = getNotificationRoomId(response);
      if (roomId) routeToRoom(roomId);
    },
    [routeToRoom],
  );

  const retryRegistration = useCallback(async () => {
    if (!user || !session) return;
    setStatus('registering');
    const result = await registerForPushNotifications(await getAccessToken());
    setStatus(result.status);
  }, [getAccessToken, session, user]);

  useEffect(() => {
    return setupNotificationHandling(handleResponse);
  }, [handleResponse]);

  useEffect(() => {
    const pendingRoomId = pendingRoomIdRef.current;
    if (user && pendingRoomId) routeToRoom(pendingRoomId);
  }, [routeToRoom, user]);

  useEffect(() => {
    if (!user || !session) {
      registeredUserIdRef.current = null;
      setStatus('idle');
      return;
    }
    if (registeredUserIdRef.current === user.id) return;

    registeredUserIdRef.current = user.id;
    void retryRegistration();
  }, [retryRegistration, session, user]);

  const value = useMemo(
    () => ({ status, retryRegistration }),
    [retryRegistration, status],
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const value = useContext(NotificationContext);
  if (!value) {
    throw new Error('useNotifications must be used inside NotificationProvider');
  }

  return value;
}
