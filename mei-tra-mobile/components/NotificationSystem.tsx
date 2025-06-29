import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import * as Haptics from 'expo-haptics';

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  duration?: number;
  action?: {
    label: string;
    onPress: () => void;
  };
}

interface NotificationSystemProps {
  notifications: Notification[];
  onDismiss: (id: string) => void;
}

export const NotificationSystem: React.FC<NotificationSystemProps> = ({
  notifications,
  onDismiss,
}) => {
  const [animatedValues] = useState(
    () => new Map<string, Animated.Value>()
  );

  useEffect(() => {
    notifications.forEach((notification) => {
      if (!animatedValues.has(notification.id)) {
        const animatedValue = new Animated.Value(0);
        animatedValues.set(notification.id, animatedValue);

        // Slide in animation
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();

        // Haptic feedback based on notification type
        switch (notification.type) {
          case 'success':
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            break;
          case 'warning':
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            break;
          case 'error':
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            break;
          default:
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }

        // Auto dismiss after duration
        const duration = notification.duration || 5000;
        setTimeout(() => {
          handleDismiss(notification.id);
        }, duration);
      }
    });
  }, [notifications]);

  const handleDismiss = (id: string) => {
    const animatedValue = animatedValues.get(id);
    if (animatedValue) {
      Animated.timing(animatedValue, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        animatedValues.delete(id);
        onDismiss(id);
      });
    }
  };

  const getNotificationStyle = (type: Notification['type']) => {
    switch (type) {
      case 'success':
        return styles.successNotification;
      case 'warning':
        return styles.warningNotification;
      case 'error':
        return styles.errorNotification;
      default:
        return styles.infoNotification;
    }
  };

  const getIconForType = (type: Notification['type']) => {
    switch (type) {
      case 'success':
        return '✅';
      case 'warning':
        return '⚠️';
      case 'error':
        return '❌';
      default:
        return 'ℹ️';
    }
  };

  return (
    <View style={styles.container}>
      {notifications.map((notification) => {
        const animatedValue = animatedValues.get(notification.id);
        if (!animatedValue) return null;

        return (
          <Animated.View
            key={notification.id}
            style={[
              styles.notification,
              getNotificationStyle(notification.type),
              {
                transform: [
                  {
                    translateY: animatedValue.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-100, 0],
                    }),
                  },
                ],
                opacity: animatedValue,
              },
            ]}
          >
            <TouchableOpacity
              style={styles.notificationContent}
              onPress={() => handleDismiss(notification.id)}
              activeOpacity={0.8}
            >
              <View style={styles.iconContainer}>
                <Text style={styles.icon}>
                  {getIconForType(notification.type)}
                </Text>
              </View>
              
              <View style={styles.textContainer}>
                <Text style={styles.title}>{notification.title}</Text>
                <Text style={styles.message}>{notification.message}</Text>
              </View>

              {notification.action && (
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => {
                    notification.action!.onPress();
                    handleDismiss(notification.id);
                  }}
                >
                  <Text style={styles.actionText}>
                    {notification.action.label}
                  </Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          </Animated.View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    left: 15,
    right: 15,
    zIndex: 1000,
  },
  notification: {
    borderRadius: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  notificationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
  },
  iconContainer: {
    marginRight: 12,
  },
  icon: {
    fontSize: 24,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 2,
  },
  message: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
  },
  actionButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginLeft: 10,
  },
  actionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  infoNotification: {
    backgroundColor: '#2196F3',
  },
  successNotification: {
    backgroundColor: '#4CAF50',
  },
  warningNotification: {
    backgroundColor: '#FF9800',
  },
  errorNotification: {
    backgroundColor: '#F44336',
  },
});