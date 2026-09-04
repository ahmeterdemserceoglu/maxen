import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { TVFocusable } from '@/components/TVFocusable';
import { WatchPartyRoom } from '@/services/watchPartyService';

const isTV = Platform.isTV;

interface PlayerTopBarProps {
  title: string;
  isMovie: boolean;
  seasonNum: number;
  episodeNum: number;
  onClose: () => void;
  onOpenSettings: () => void;
  onOpenPlayOnTv?: () => void;
  onMinimize?: () => void;
  onToggleLockScreen?: () => void;
  prolongControls: () => void;
  watchPartyRoom?: WatchPartyRoom | null;
  isChatOpen?: boolean;
  onToggleWatchPartyChat?: () => void;
  onLeaveWatchParty?: () => void;
}

export function PlayerTopBar({
  title,
  isMovie,
  seasonNum,
  episodeNum,
  onClose,
  onOpenSettings,
  onOpenPlayOnTv,
  onMinimize,
  onToggleLockScreen,
  prolongControls,
  watchPartyRoom,
  isChatOpen,
  onToggleWatchPartyChat,
  onLeaveWatchParty,
}: PlayerTopBarProps) {
  const displayTitle = isMovie ? title : title + (isTV ? '' : '  S' + seasonNum + ':E' + episodeNum);

  const containerStyle = [styles.topBar, isTV && styles.topBarTV];

  const content = (
    <>
      {/* Back Button */}
      <View style={styles.leftSection}>
        <TVFocusable
          style={[styles.backBtn, isTV && styles.iconBtnTV]}
          focusedStyle={isTV ? styles.iconFocusedTV : styles.iconFocused}
          onFocus={prolongControls}
          onPress={() => {
            prolongControls();
            onClose();
          }}
          accessibilityLabel="Geri"
        >
          <Ionicons
            name="arrow-back"
            size={isTV ? 32 : 24}
            color="#fff"
          />
        </TVFocusable>
      </View>

      {/* Title */}
      <View style={[styles.titleSection, isTV && styles.titleSectionTV]}>
        <Text
          style={[styles.titleTxt, isTV && styles.titleTxtTV]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {displayTitle}
        </Text>
        {isTV && !isMovie && (
          <Text style={styles.subtitleTxtTV}>
            S{seasonNum}:E{episodeNum}
          </Text>
        )}
      </View>

      {/* Right Section */}
      <View style={styles.topRight}>
        {/* Watch Party */}
        {watchPartyRoom && (
          <View style={styles.partyContainer}>
            <View style={styles.partyPill}>
              <View style={styles.partyDot} />
              <Ionicons name="people-outline" size={14} color="#FFFFFF" />
              <Text style={styles.partyCodeText}>{watchPartyRoom.code}</Text>
              <View style={styles.partyDivider} />
              <Text style={styles.partyCountText}>
                {watchPartyRoom.participants?.length || 1}
              </Text>
            </View>

            {onToggleWatchPartyChat && (
              <TVFocusable
                style={[styles.topIcon, isTV && styles.iconBtnTV, isChatOpen && styles.topIconActive]}
                focusedStyle={isTV ? styles.iconFocusedTV : styles.iconFocused}
                onFocus={prolongControls}
                onPress={() => {
                  prolongControls();
                  onToggleWatchPartyChat();
                }}
                accessibilityLabel="Watch Party Sohbeti"
              >
                <Ionicons
                  name={isChatOpen ? 'chatbubbles' : 'chatbubbles-outline'}
                  size={isTV ? 28 : 20}
                  color={isChatOpen ? '#E50914' : '#fff'}
                />
              </TVFocusable>
            )}

            {onLeaveWatchParty && (
              <TVFocusable
                style={[styles.topIcon, isTV && styles.iconBtnTV]}
                focusedStyle={isTV ? styles.iconFocusedTV : styles.iconFocused}
                onFocus={prolongControls}
                onPress={() => {
                  prolongControls();
                  onLeaveWatchParty();
                }}
                accessibilityLabel="Partiden Ayril"
              >
                <Ionicons name="log-out-outline" size={isTV ? 28 : 20} color="#FF6B6B" />
              </TVFocusable>
            )}
          </View>
        )}

        {/* TV'de Oynat - Mobil */}
        {onOpenPlayOnTv && !isTV && (
          <TVFocusable
            style={styles.topIcon}
            focusedStyle={styles.iconFocused}
            onFocus={prolongControls}
            onPress={() => {
              prolongControls();
              onOpenPlayOnTv();
            }}
            accessibilityLabel="TV'de Oynat"
          >
            <Ionicons name="tv-outline" size={22} color="#fff" />
          </TVFocusable>
        )}

        {/* Ekran Kilidi - Mobil */}
        {onToggleLockScreen && !isTV && (
          <TVFocusable
            style={styles.topIcon}
            focusedStyle={styles.iconFocused}
            onFocus={prolongControls}
            onPress={() => {
              prolongControls();
              onToggleLockScreen();
            }}
            accessibilityLabel="Ekrani kilitle"
          >
            <Ionicons name="lock-open-outline" size={22} color="#fff" />
          </TVFocusable>
        )}

        {/* Ayarlar */}
        <TVFocusable
          style={[styles.topIcon, isTV && styles.iconBtnTV]}
          focusedStyle={isTV ? styles.iconFocusedTV : styles.iconFocused}
          onFocus={prolongControls}
          onPress={() => {
            prolongControls();
            onOpenSettings();
          }}
          accessibilityLabel="Oynatici Ayarlari"
        >
          <Ionicons name="settings-outline" size={isTV ? 28 : 22} color="#fff" />
        </TVFocusable>

        {/* Minimize */}
        {onMinimize && (
          <TVFocusable
            style={[styles.topIcon, isTV && styles.iconBtnTV]}
            focusedStyle={isTV ? styles.iconFocusedTV : styles.iconFocused}
            onFocus={prolongControls}
            onPress={() => {
              prolongControls();
              onMinimize();
            }}
            accessibilityLabel="Küçük Ekran (PiP)"
          >
            <MaterialIcons name="picture-in-picture-alt" size={isTV ? 28 : 22} color="#fff" />
          </TVFocusable>
        )}
      </View>
    </>
  );

  if (isTV) {
    return (
      <LinearGradient
        colors={['rgba(0,0,0,0.9)', 'rgba(0,0,0,0)']}
        style={containerStyle}
      >
        {content}
      </LinearGradient>
    );
  }

  return <View style={containerStyle}>{content}</View>;
}

const styles = StyleSheet.create({
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 12,
    zIndex: 10,
  },
  topBarTV: {
    height: 140,
    paddingHorizontal: 40,
    paddingTop: 40,
    alignItems: 'flex-start',
  },
  leftSection: {
    flex: isTV ? 1 : 0,
    alignItems: 'flex-start',
  },
  titleSection: {
    flex: isTV ? 2 : 1,
  },
  titleSectionTV: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    borderRadius: 18,
  },
  iconBtnTV: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  titleTxt: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.65)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  titleTxtTV: {
    fontSize: 26,
    fontWeight: 'bold',
  },
  subtitleTxtTV: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.7,
    marginTop: 4,
    fontWeight: '500',
  },
  topRight: {
    flex: isTV ? 1 : 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 12,
    marginLeft: 16,
  },
  topIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  iconFocused: {
    backgroundColor: 'rgba(255,255,255,0.20)',
    borderRadius: 20,
  },
  iconFocusedTV: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderWidth: 2,
    borderColor: '#fff',
    borderRadius: 28,
  },
  topIconActive: {
    backgroundColor: 'rgba(255,255,255,0.20)',
    borderRadius: 18,
  },
  partyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  partyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.10)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    gap: 6,
  },
  partyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  partyCodeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  partyDivider: {
    width: 1,
    height: 10,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  partyCountText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 11,
    fontWeight: '700',
  },
});
