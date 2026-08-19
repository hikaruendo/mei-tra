import type { ChatMessage } from '@meitra/contracts/social';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useSocial } from '@/context/SocialContext';
import { colors } from '@/theme/colors';
import { t } from '@/i18n';

interface ChatPanelProps {
  roomId: string;
}

const MAX_LENGTH = 500;

function MessageItem({ item }: { item: ChatMessage }) {
  const time = new Date(item.createdAt).toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
  });

  if (item.contentType === 'system') {
    return (
      <View style={styles.systemMessage}>
        <Text style={styles.systemText}>{item.content}</Text>
      </View>
    );
  }

  const initial = item.sender.displayName.charAt(0).toUpperCase();

  return (
    <View style={styles.messageRow}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initial}</Text>
      </View>
      <View style={styles.messageBubble}>
        <View style={styles.messageHeader}>
          <Text numberOfLines={1} style={styles.senderName}>
            {item.sender.displayName}
          </Text>
          <Text style={styles.messageTime}>{time}</Text>
        </View>
        <Text style={styles.messageContent}>{item.content}</Text>
      </View>
    </View>
  );
}

export function ChatPanel({ roomId }: ChatPanelProps) {
  const {
    connected,
    messages,
    typingUserIds,
    joinRoom,
    leaveRoom,
    sendMessage,
    sendTyping,
  } = useSocial();
  const [text, setText] = useState('');
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const typingThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    joinRoom(roomId);
    return () => leaveRoom(roomId);
  }, [roomId, joinRoom, leaveRoom]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        listRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  const handleChangeText = useCallback(
    (value: string) => {
      setText(value);
      if (!typingThrottleRef.current) {
        sendTyping(roomId);
        typingThrottleRef.current = setTimeout(() => {
          typingThrottleRef.current = null;
        }, 2000);
      }
    },
    [roomId, sendTyping],
  );

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || !connected) return;
    sendMessage(roomId, trimmed);
    setText('');
  }, [text, connected, roomId, sendMessage]);

  const renderItem = useCallback(
    ({ item }: { item: ChatMessage }) => <MessageItem item={item} />,
    [],
  );

  const keyExtractor = useCallback((item: ChatMessage) => item.id, []);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={100}
      style={styles.container}
    >
      <FlatList
        ref={listRef}
        contentContainerStyle={styles.messageList}
        data={messages}
        keyExtractor={keyExtractor}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
              {t('chat.empty')}
            </Text>
          </View>
        }
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
      />

      {typingUserIds.length > 0 ? (
        <Text style={styles.typingIndicator}>
          {typingUserIds.length === 1
            ? t('chat.typingOne')
            : t('chat.typingMany', { count: typingUserIds.length })}
        </Text>
      ) : null}

      <View style={styles.composer}>
        <TextInput
          editable={connected}
          maxLength={MAX_LENGTH}
          multiline
          onChangeText={handleChangeText}
          placeholder={
            connected ? t('chat.inputPlaceholder') : t('chat.connecting')
          }
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          value={text}
        />
        <View style={styles.composerRight}>
          <Text style={styles.charCount}>
            {text.length}/{MAX_LENGTH}
          </Text>
          <Pressable
            disabled={!text.trim() || !connected}
            onPress={handleSend}
            style={[
              styles.sendButton,
              (!text.trim() || !connected) && styles.sendButtonDisabled,
            ]}
          >
            <Text style={styles.sendText}>{t('chat.send')}</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  messageList: {
    gap: 4,
    padding: 12,
    paddingBottom: 8,
  },
  emptyState: {
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
  },
  systemMessage: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  systemText: {
    color: colors.textMuted,
    fontSize: 12,
    fontStyle: 'italic',
  },
  messageRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  avatar: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: colors.panelStrong,
  },
  avatarText: {
    color: colors.gold,
    fontSize: 14,
    fontWeight: '800',
  },
  messageBubble: {
    flex: 1,
    gap: 2,
  },
  messageHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  senderName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  messageTime: {
    color: colors.textMuted,
    fontSize: 10,
    fontVariant: ['tabular-nums'],
  },
  messageContent: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  typingIndicator: {
    color: colors.textMuted,
    paddingHorizontal: 14,
    paddingBottom: 4,
    fontSize: 12,
    fontStyle: 'italic',
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.panel,
  },
  input: {
    flex: 1,
    maxHeight: 80,
    padding: 10,
    borderRadius: 12,
    backgroundColor: colors.backgroundElevated,
    color: colors.text,
    fontSize: 14,
  },
  composerRight: {
    alignItems: 'center',
    gap: 4,
  },
  charCount: {
    color: colors.textMuted,
    fontSize: 10,
    fontVariant: ['tabular-nums'],
  },
  sendButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.gold,
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
  sendText: {
    color: colors.background,
    fontSize: 14,
    fontWeight: '700',
  },
});
