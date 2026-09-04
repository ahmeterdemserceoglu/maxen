import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WatchPartyRoom, sendWatchPartyChat } from '@/services/watchPartyService';
import { useAuth } from '@/contexts/AuthContext';

interface WatchPartyChatDrawerProps {
  visible: boolean;
  onClose: () => void;
  room: WatchPartyRoom | null;
  onProlongControls?: () => void;
}

export function WatchPartyChatDrawer({
  visible,
  onClose,
  room,
  onProlongControls,
}: WatchPartyChatDrawerProps) {
  const { user, activeProfile } = useAuth();
  const [chatInput, setChatInput] = useState('');
  const chatScrollRef = useRef<ScrollView>(null);

  const profileName =
    activeProfile?.name || user?.displayName || user?.email?.split('@')[0] || 'Kullanıcı';

  useEffect(() => {
    if (visible && room?.chatMessages?.length) {
      setTimeout(() => {
        chatScrollRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [visible, room?.chatMessages?.length]);

  if (!visible || !room || !user) return null;

  const handleSend = () => {
    if (!chatInput.trim()) return;
    sendWatchPartyChat(room.code, user, profileName, chatInput.trim());
    setChatInput('');
    onProlongControls?.();
    setTimeout(() => {
      chatScrollRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.drawerContainer}
    >
      {/* 1. BAŞLIK */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.liveDot} />
          <Ionicons name="chatbubbles-outline" size={18} color="#FFFFFF" />
          <Text style={styles.headerTitle}>Oda Sohbeti</Text>
          <View style={styles.badgePill}>
            <Text style={styles.badgeText}>{room.code}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.closeBtn}
          onPress={onClose}
          activeOpacity={0.7}
        >
          <Ionicons name="close" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* 2. KATILIMCILAR LİSTESİ */}
      <View style={styles.participantSection}>
        <Text style={styles.sectionLabel}>
          KATILIMCILAR ({room.participants.length})
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.participantList}
        >
          {room.participants.map((p) => (
            <View key={p.uid} style={styles.participantItem}>
              <View
                style={[
                  styles.avatar,
                  p.isHost && styles.avatarHost,
                  p.uid === user.uid && styles.avatarMe,
                ]}
              >
                <Text style={styles.avatarText}>
                  {p.name ? p.name.charAt(0).toUpperCase() : 'U'}
                </Text>
                {p.isHost && (
                  <View style={styles.hostStar}>
                    <Ionicons name="star" size={8} color="#FFFFFF" />
                  </View>
                )}
              </View>
              <Text style={styles.participantName} numberOfLines={1}>
                {p.uid === user.uid ? 'Sen' : p.name}
              </Text>
            </View>
          ))}
        </ScrollView>
      </View>

      <View style={styles.divider} />

      {/* 3. SOHBET MESAJLARI AKIŞI */}
      <ScrollView
        ref={chatScrollRef}
        style={styles.messagesScroll}
        contentContainerStyle={styles.messagesContent}
        showsVerticalScrollIndicator={false}
      >
        {!room.chatMessages || room.chatMessages.filter((m) => !m.reaction).length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubble-ellipses-outline" size={32} color="rgba(255,255,255,0.3)" />
            <Text style={styles.emptyText}>Henüz mesaj yok. İlk mesajı sen yaz!</Text>
          </View>
        ) : (
          room.chatMessages
            .filter((m) => !m.reaction)
            .map((m) => {
              const isMe = m.senderId === user.uid;
              const isSys = m.senderId === 'system';

              if (isSys) {
                return (
                  <View key={m.id} style={styles.sysMsg}>
                    <Text style={styles.sysMsgText}>{m.text}</Text>
                  </View>
                );
              }

              return (
                <View
                  key={m.id}
                  style={[styles.msgRow, isMe ? styles.msgRowMe : styles.msgRowOther]}
                >
                  {!isMe && (
                    <Text style={styles.senderLabel}>{m.senderName}</Text>
                  )}
                  <View style={[styles.msgBubble, isMe ? styles.bubbleMe : styles.bubbleOther]}>
                    <Text style={styles.msgText}>{m.text}</Text>
                  </View>
                </View>
              );
            })
        )}
      </ScrollView>

      {/* 4. METİN GİRİŞİ */}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.textInput}
          placeholder="Mesaj yazın..."
          placeholderTextColor="rgba(255,255,255,0.4)"
          value={chatInput}
          onChangeText={setChatInput}
          onSubmitEditing={handleSend}
          returnKeyType="send"
          maxLength={140}
        />
        <TouchableOpacity
          style={[styles.sendBtn, !chatInput.trim() && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!chatInput.trim()}
          activeOpacity={0.8}
        >
          <Ionicons
            name="send"
            size={16}
            color={chatInput.trim() ? '#FFFFFF' : 'rgba(255,255,255,0.3)'}
          />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  drawerContainer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: 320,
    maxWidth: '85%',
    backgroundColor: 'rgba(15, 15, 18, 0.95)',
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255, 255, 255, 0.12)',
    zIndex: 999,
    shadowColor: '#000',
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 20,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#10B981',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  badgePill: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  participantSection: {
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  sectionLabel: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  participantList: {
    gap: 12,
  },
  participantItem: {
    alignItems: 'center',
    width: 44,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#27272a',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  avatarHost: {
    borderColor: 'rgba(255, 255, 255, 0.7)',
  },
  avatarMe: {
    borderColor: '#E50914',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  hostStar: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#E50914',
    borderRadius: 6,
    width: 12,
    height: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  participantName: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 10,
    marginTop: 4,
    textAlign: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginVertical: 10,
  },
  messagesScroll: {
    flex: 1,
    paddingHorizontal: 16,
  },
  messagesContent: {
    gap: 10,
    paddingBottom: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyText: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 12,
    textAlign: 'center',
  },
  sysMsg: {
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    marginVertical: 4,
  },
  sysMsgText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 11,
    fontWeight: '600',
  },
  msgRow: {
    maxWidth: '85%',
  },
  msgRowMe: {
    alignSelf: 'flex-end',
  },
  msgRowOther: {
    alignSelf: 'flex-start',
  },
  senderLabel: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 2,
    marginLeft: 4,
  },
  msgBubble: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
  },
  bubbleMe: {
    backgroundColor: '#E50914',
    borderBottomRightRadius: 2,
  },
  bubbleOther: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderBottomLeftRadius: 2,
  },
  msgText: {
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 18,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 8,
    gap: 8,
  },
  textInput: {
    flex: 1,
    height: 38,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 19,
    paddingHorizontal: 14,
    color: '#FFFFFF',
    fontSize: 13,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#E50914',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
});
