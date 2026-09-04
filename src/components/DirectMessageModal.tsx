import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TVFocusable } from '@/components/TVFocusable';
import {
  DirectMessage,
  getConversationId,
  sendDirectMessage,
  subscribeToDirectMessages,
} from '@/services/directMessageService';

export interface DirectMessageModalProps {
  visible: boolean;
  onClose: () => void;
  currentUser: {
    uid: string;
    displayName?: string;
    username?: string;
  };
  friend: {
    uid: string;
    displayName?: string;
    username?: string;
  } | null;
  onSelectMedia?: (media: any) => void;
  onJoinWatchParty?: (code: string) => void;
  activeMedia?: any; // Media to quickly share
}

export function DirectMessageModal({
  visible,
  onClose,
  currentUser,
  friend,
  onSelectMedia,
  onJoinWatchParty,
  activeMedia,
}: DirectMessageModalProps) {
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!visible || !currentUser?.uid || !friend?.uid) {
      setMessages([]);
      return;
    }

    const convId = getConversationId(currentUser.uid, friend.uid);
    const unsubscribe = subscribeToDirectMessages(convId, (msgs) => {
      setMessages(msgs);
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    });

    return () => unsubscribe();
  }, [visible, currentUser?.uid, friend?.uid]);

  const handleSendText = async () => {
    if (!inputText.trim() || !friend || sending) return;
    const text = inputText.trim();
    setInputText('');
    setSending(true);

    try {
      await sendDirectMessage(
        {
          uid: currentUser.uid,
          displayName: currentUser.displayName || currentUser.username || 'Kullanıcı',
          username: currentUser.username || 'user',
        },
        {
          uid: friend.uid,
          displayName: friend.displayName || friend.username || 'Arkadaş',
          username: friend.username || 'friend',
        },
        {
          type: 'text',
          text,
        }
      );
    } catch (e) {
      console.warn('Failed to send DM:', e);
    } finally {
      setSending(false);
    }
  };

  const handleShareMedia = async (mediaItem: any) => {
    if (!mediaItem || !friend || sending) return;
    setSending(true);

    try {
      await sendDirectMessage(
        {
          uid: currentUser.uid,
          displayName: currentUser.displayName || currentUser.username || 'Kullanıcı',
          username: currentUser.username || 'user',
        },
        {
          uid: friend.uid,
          displayName: friend.displayName || friend.username || 'Arkadaş',
          username: friend.username || 'friend',
        },
        {
          type: 'media_card',
          media: {
            tmdbId: String(mediaItem.tmdbId || mediaItem.id),
            title: mediaItem.title || mediaItem.name || 'Film/Dizi',
            type: mediaItem.type || 'movie',
            posterUrl: mediaItem.posterUrl || (mediaItem.poster_path ? `https://image.tmdb.org/t/p/w300${mediaItem.poster_path}` : null),
            rating: String(mediaItem.rating || mediaItem.vote_average || '7.5'),
            year: String(mediaItem.year || ''),
          },
        }
      );
    } catch (e) {
      console.warn('Failed to share media card:', e);
    } finally {
      setSending(false);
    }
  };

  if (!visible || !friend) return null;

  const friendInitial = (friend.displayName || friend.username || 'F')[0].toUpperCase();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      statusBarTranslucent={true}
      onRequestClose={onClose}
    >
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{friendInitial}</Text>
            </View>
            <View>
              <Text style={styles.friendName}>{friend.displayName || friend.username}</Text>
              <Text style={styles.friendTag}>@{friend.username || 'user'}</Text>
            </View>
          </View>

          <TVFocusable
            style={styles.closeButton}
            focusedStyle={{ backgroundColor: 'rgba(255,255,255,0.2)' }}
            onPress={onClose}
          >
            <Ionicons name="close" size={24} color="#fff" />
          </TVFocusable>
        </View>

        {/* Message Thread */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.messageScroll}
          contentContainerStyle={styles.messageContent}
        >
          {messages.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubbles-outline" size={48} color="#4B5563" />
              <Text style={styles.emptyTitle}>Henüz mesaj yok</Text>
              <Text style={styles.emptySubtitle}>
                @{friend.username} ile ilk mesajı başlatın veya bir film önerin!
              </Text>
            </View>
          ) : (
            messages.map((msg) => {
              const isMe = msg.senderUid === currentUser.uid;

              if (msg.type === 'media_card' && msg.media) {
                return (
                  <View
                    key={msg.id}
                    style={[styles.mediaCardWrapper, isMe ? styles.alignRight : styles.alignLeft]}
                  >
                    <View style={styles.mediaCard}>
                      {msg.media.posterUrl && (
                        <Image
                          source={{ uri: msg.media.posterUrl }}
                          style={styles.mediaPoster}
                          contentFit="cover"
                        />
                      )}
                      <View style={styles.mediaInfo}>
                        <View style={styles.mediaTagBadge}>
                          <Text style={styles.mediaTagText}>🎬 FİLM / DİZİ ÖNERİSİ</Text>
                        </View>
                        <Text style={styles.mediaTitle} numberOfLines={1}>
                          {msg.media.title}
                        </Text>
                        <View style={styles.mediaMetaRow}>
                          <Ionicons name="star" size={12} color="#FBBF24" />
                          <Text style={styles.mediaRating}>{msg.media.rating}</Text>
                          {msg.media.year ? (
                            <Text style={styles.mediaYear}>• {msg.media.year}</Text>
                          ) : null}
                        </View>

                        <TVFocusable
                          style={styles.mediaPlayBtn}
                          focusedStyle={{ backgroundColor: '#B91C1C' }}
                          onPress={() => {
                            if (onSelectMedia) {
                              onSelectMedia(msg.media);
                              onClose();
                            }
                          }}
                        >
                          <Ionicons name="play" size={14} color="#fff" />
                          <Text style={styles.mediaPlayBtnText}>Hemen İncele</Text>
                        </TVFocusable>
                      </View>
                    </View>
                  </View>
                );
              }

              if (msg.type === 'party_invite') {
                return (
                  <View
                    key={msg.id}
                    style={[styles.inviteCardWrapper, isMe ? styles.alignRight : styles.alignLeft]}
                  >
                    <View style={styles.inviteCard}>
                      <Ionicons name="people" size={24} color="#E50914" />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.inviteTitle}>Birlikte İzleme Daveti</Text>
                        <Text style={styles.inviteSubtitle}>Oda Kodu: {msg.partyCode}</Text>
                      </View>
                      <TVFocusable
                        style={styles.inviteJoinBtn}
                        focusedStyle={{ backgroundColor: '#059669' }}
                        onPress={() => {
                          if (msg.partyCode && onJoinWatchParty) {
                            onJoinWatchParty(msg.partyCode);
                            onClose();
                          }
                        }}
                      >
                        <Text style={styles.inviteJoinText}>Katıl</Text>
                      </TVFocusable>
                    </View>
                  </View>
                );
              }

              return (
                <View
                  key={msg.id}
                  style={[
                    styles.messageBubble,
                    isMe ? styles.myBubble : styles.friendBubble,
                  ]}
                >
                  <Text style={styles.messageText}>{msg.text}</Text>
                </View>
              );
            })
          )}
        </ScrollView>

        {/* Input Bar */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
        >
          {activeMedia && (
            <View style={styles.activeMediaShareBanner}>
              <Text style={styles.activeMediaShareText} numberOfLines={1}>
                Şu anki içerik: <Text style={{ fontWeight: '700', color: '#fff' }}>{activeMedia.title || activeMedia.name}</Text>
              </Text>
              <TouchableOpacity
                style={styles.activeMediaShareBtn}
                onPress={() => handleShareMedia(activeMedia)}
              >
                <Ionicons name="share-social" size={14} color="#fff" />
                <Text style={styles.activeMediaShareBtnText}>Arkadaşa Öner</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder={`@${friend.username} kullanıcısına mesaj yaz...`}
              placeholderTextColor="#6B7280"
              value={inputText}
              onChangeText={setInputText}
              onSubmitEditing={handleSendText}
              returnKeyType="send"
            />

            <TVFocusable
              style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
              focusedStyle={{ backgroundColor: '#B91C1C' }}
              onPress={handleSendText}
              disabled={!inputText.trim() || sending}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="send" size={18} color="#fff" />
              )}
            </TVFocusable>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090B',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#121216',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E50914',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  friendName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  friendTag: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageScroll: {
    flex: 1,
  },
  messageContent: {
    padding: 16,
    gap: 10,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    gap: 8,
  },
  emptyTitle: {
    color: '#9CA3AF',
    fontSize: 16,
    fontWeight: '700',
  },
  emptySubtitle: {
    color: '#6B7280',
    fontSize: 13,
    textAlign: 'center',
    maxWidth: 240,
  },
  messageBubble: {
    maxWidth: '78%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },
  myBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#E50914',
    borderBottomRightRadius: 4,
  },
  friendBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#1F2937',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 20,
  },
  alignRight: {
    alignSelf: 'flex-end',
  },
  alignLeft: {
    alignSelf: 'flex-start',
  },
  mediaCardWrapper: {
    maxWidth: '82%',
  },
  mediaCard: {
    flexDirection: 'row',
    backgroundColor: '#18181B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
    width: 270,
  },
  mediaPoster: {
    width: 80,
    height: 120,
  },
  mediaInfo: {
    flex: 1,
    padding: 10,
    justifyContent: 'space-between',
  },
  mediaTagBadge: {
    backgroundColor: 'rgba(229, 9, 20, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  mediaTagText: {
    color: '#F87171',
    fontSize: 9,
    fontWeight: '800',
  },
  mediaTitle: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  mediaMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  mediaRating: {
    color: '#FBBF24',
    fontSize: 11,
    fontWeight: '700',
  },
  mediaYear: {
    color: '#9CA3AF',
    fontSize: 11,
  },
  mediaPlayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E50914',
    paddingVertical: 5,
    borderRadius: 6,
    gap: 4,
    marginTop: 4,
  },
  mediaPlayBtnText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  inviteCardWrapper: {
    maxWidth: '82%',
  },
  inviteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E24',
    borderRadius: 12,
    padding: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(229,9,20,0.3)',
    width: 270,
  },
  inviteTitle: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  inviteSubtitle: {
    color: '#9CA3AF',
    fontSize: 10,
  },
  inviteJoinBtn: {
    backgroundColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  inviteJoinText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  activeMediaShareBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#18181B',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  activeMediaShareText: {
    color: '#9CA3AF',
    fontSize: 12,
    flex: 1,
  },
  activeMediaShareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E50914',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  activeMediaShareBtnText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#121216',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: '#1F2937',
    color: '#fff',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#E50914',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
});
