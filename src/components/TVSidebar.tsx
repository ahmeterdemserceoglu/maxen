import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  Platform,
  findNodeHandle,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { TVFocusable } from '@/components/TVFocusable';
import { type Profile } from '@/types/profile';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUiStore } from '@/store/uiStore';

export type TabKey = 'home' | 'media' | 'social' | 'search' | 'settings' | 'movies' | 'tv';

export type TVTabConfig = {
  key: TabKey;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon: keyof typeof Ionicons.glyphMap;
};

export const TV_NAV_ITEMS: TVTabConfig[] = [
  { key: 'search', label: 'Ara & Keşfet', icon: 'search-outline', activeIcon: 'search' },
  { key: 'home', label: 'Ana Sayfa', icon: 'home-outline', activeIcon: 'home' },
  { key: 'movies', label: 'Filmler', icon: 'film-outline', activeIcon: 'film' },
  { key: 'tv', label: 'Diziler', icon: 'tv-outline', activeIcon: 'tv' },
  { key: 'settings', label: 'Ayarlar', icon: 'settings-outline', activeIcon: 'settings' },
];

export interface TVSidebarProps {
  activeTab: TabKey;
  onTabSelect: (tab: TabKey) => void;
  activeProfile?: Profile | null;
  onChangeProfile?: () => void;
}

const COLLAPSED_WIDTH = 60;
const EXPANDED_WIDTH = 218;
const BACKDROP_OFFSET = -(EXPANDED_WIDTH - COLLAPSED_WIDTH); // -158

export function TVSidebar({
  activeTab,
  onTabSelect,
  activeProfile,
  onChangeProfile,
}: TVSidebarProps) {
  const insets = useSafeAreaInsets();
  const setShowJoinPartyModal = useUiStore((state) => state.setShowJoinPartyModal);
  const pendingFriendRequestsCount = useUiStore((state) => state.pendingFriendRequestsCount);
  const heroPlayBtnNodeId = useUiStore((state) => state.heroPlayBtnNodeId);
  const setSidebarActiveNodeId = useUiStore((state) => state.setSidebarActiveNodeId);

  const [isExpanded, setIsExpanded] = useState(false);
  const [focusedKey, setFocusedKey] = useState<string | null>(null);

  const collapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tabRefs = useRef<Record<string, any>>({});

  // 100% Native Driver Animations (ZERO JS-thread layout calculations, silky 60fps)
  const backdropTranslateXAnim = useRef(new Animated.Value(BACKDROP_OFFSET)).current;
  const labelOpacityAnim = useRef(new Animated.Value(0)).current;
  const labelTranslateXAnim = useRef(new Animated.Value(-8)).current;
  const logoTextOpacityAnim = useRef(new Animated.Value(0)).current;

  // Register active tab node handle for deterministic D-pad Left navigation from content
  useEffect(() => {
    const activeEl = tabRefs.current[activeTab];
    if (activeEl) {
      try {
        const id = findNodeHandle(activeEl);
        if (id) {
          setSidebarActiveNodeId(id);
        }
      } catch (e) {}
    }
  }, [activeTab, setSidebarActiveNodeId]);

  const handleItemFocus = useCallback((key: string) => {
    if (collapseTimerRef.current) {
      clearTimeout(collapseTimerRef.current);
      collapseTimerRef.current = null;
    }
    setFocusedKey(key);
    setIsExpanded(true);
  }, []);

  const handleItemBlur = useCallback((_key: string) => {
    if (collapseTimerRef.current) {
      clearTimeout(collapseTimerRef.current);
    }
    collapseTimerRef.current = setTimeout(() => {
      setFocusedKey(null);
      setIsExpanded(false);
    }, 160);
  }, []);

  useEffect(() => {
    if (isExpanded) {
      Animated.parallel([
        Animated.timing(backdropTranslateXAnim, {
          toValue: 0,
          duration: 200,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(labelOpacityAnim, {
          toValue: 1,
          duration: 160,
          delay: 30,
          useNativeDriver: true,
        }),
        Animated.timing(labelTranslateXAnim, {
          toValue: 0,
          duration: 180,
          delay: 30,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(logoTextOpacityAnim, {
          toValue: 1,
          duration: 180,
          delay: 20,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(backdropTranslateXAnim, {
          toValue: BACKDROP_OFFSET,
          duration: 180,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(labelOpacityAnim, {
          toValue: 0,
          duration: 90,
          useNativeDriver: true,
        }),
        Animated.timing(labelTranslateXAnim, {
          toValue: -8,
          duration: 90,
          useNativeDriver: true,
        }),
        Animated.timing(logoTextOpacityAnim, {
          toValue: 0,
          duration: 90,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isExpanded, backdropTranslateXAnim, labelOpacityAnim, labelTranslateXAnim, logoTextOpacityAnim]);

  useEffect(() => {
    return () => {
      if (collapseTimerRef.current) {
        clearTimeout(collapseTimerRef.current);
      }
    };
  }, []);

  const topInset = Math.max(insets.top, 24);
  const bottomInset = Math.max(insets.bottom, 20);

  return (
    <View
      style={[
        styles.outerContainer,
        {
          width: isExpanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH,
          paddingTop: topInset,
          paddingBottom: bottomInset,
        },
      ]}
      pointerEvents="box-none"
      {...(Platform.OS === 'web'
        ? ({
            onMouseEnter: () => setIsExpanded(true),
            onMouseLeave: () => setIsExpanded(false),
          } as any)
        : {})}
    >
      {/* GPU Accelerated Sliding Dark Glass Backdrop */}
      <Animated.View
        style={[
          styles.drawerBackdrop,
          {
            transform: [{ translateX: backdropTranslateXAnim }],
          },
        ]}
        pointerEvents="none"
      >
        <LinearGradient
          colors={['#101015', '#08080C']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={styles.rightBorder} />
      </Animated.View>

      {/* TOP: Brand Logo Header */}
      <View style={styles.logoHeader}>
        <View style={styles.logoBadge}>
          <LinearGradient
            colors={['#FF2634', '#B8000C']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.logoBadgeGradient}
          >
            <Text style={styles.logoBadgeText}>M</Text>
          </LinearGradient>
        </View>

        <Animated.View
          style={[
            styles.logoTextWrapper,
            {
              opacity: logoTextOpacityAnim,
              transform: [{ translateX: labelTranslateXAnim }],
            },
          ]}
          pointerEvents="none"
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.logoText}>MAXEN</Text>
            <View style={styles.primeBadge}>
              <Text style={styles.primeBadgeText}>TV</Text>
            </View>
          </View>
        </Animated.View>
      </View>

      {/* TOP/MIDDLE: Profile Avatar Item */}
      {activeProfile && (
        <View style={styles.profileSection}>
          <TVFocusable
            onFocus={() => handleItemFocus('profile')}
            onBlur={() => handleItemBlur('profile')}
            onPress={() => {
              if (onChangeProfile) {
                onChangeProfile();
              }
            }}
            nextFocusRight={heroPlayBtnNodeId || undefined}
            style={styles.profileButton}
            focusedStyle={styles.profileButtonFocused}
            accessibilityLabel={`Profil: ${activeProfile.name}`}
          >
            {({ focused }) => (
              <View style={styles.profileButtonInner}>
                <View
                  style={[
                    styles.profileAvatar,
                    { backgroundColor: activeProfile.color || '#E50914' },
                    focused && styles.profileAvatarFocused,
                  ]}
                >
                  {activeProfile.avatarUrl ? (
                    <Image
                      source={{ uri: activeProfile.avatarUrl }}
                      style={styles.profileAvatarImage}
                      contentFit="cover"
                    />
                  ) : (
                    <Text style={styles.profileLetter}>
                      {activeProfile.letter || (activeProfile.name ? activeProfile.name[0].toUpperCase() : 'U')}
                    </Text>
                  )}
                </View>

                <Animated.View
                  style={[
                    styles.profileDetails,
                    {
                      opacity: labelOpacityAnim,
                      transform: [{ translateX: labelTranslateXAnim }],
                    },
                  ]}
                  pointerEvents="none"
                >
                  <Text
                    style={[
                      styles.profileName,
                      focused && styles.textFocused,
                    ]}
                    numberOfLines={1}
                  >
                    {activeProfile.name}
                  </Text>
                  <Text style={styles.profileSubtitle} numberOfLines={1}>
                    Profili Değiştir
                  </Text>
                </Animated.View>
              </View>
            )}
          </TVFocusable>
        </View>
      )}

      {/* DIVIDER */}
      <View style={styles.divider} />

      {/* MIDDLE: Navigation Tabs List */}
      <View style={styles.navList}>
        {TV_NAV_ITEMS.map((tab) => {
          const isActive = activeTab === tab.key;
          const isItemFocused = focusedKey === tab.key;

          return (
            <TVFocusable
              key={tab.key}
              ref={(el: any) => {
                tabRefs.current[tab.key] = el;
              }}
              onFocus={() => handleItemFocus(tab.key)}
              onBlur={() => handleItemBlur(tab.key)}
              onPress={() => onTabSelect(tab.key)}
              nextFocusRight={heroPlayBtnNodeId || undefined}
              style={[
                styles.navItem,
                isActive && !isItemFocused && isExpanded && styles.navItemActive,
              ]}
              focusedStyle={styles.navItemFocused}
              accessibilityLabel={tab.label}
              accessibilityRole="tab"
            >
              {({ focused }) => {
                const iconColor = focused
                  ? '#FFFFFF'
                  : isActive
                  ? '#E50914'
                  : '#8E8E93';

                return (
                  <View style={styles.navItemInner}>
                    {/* Active Left Indicator Pill */}
                    {isActive && (
                      <View
                        style={[
                          styles.activeIndicator,
                          focused && styles.activeIndicatorFocused,
                        ]}
                      />
                    )}

                    {/* Icon Container (fixed width to prevent layout shift) */}
                    <View style={styles.iconContainer}>
                      <Ionicons
                        name={isActive ? tab.activeIcon : tab.icon}
                        size={24}
                        color={iconColor}
                      />
                      {tab.key === 'social' && pendingFriendRequestsCount > 0 && (
                        <View style={styles.sidebarBadge}>
                          <Text style={styles.sidebarBadgeText}>
                            {pendingFriendRequestsCount > 99 ? '99+' : pendingFriendRequestsCount}
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Animated Text Label */}
                    <Animated.View
                      style={[
                        styles.labelContainer,
                        {
                          opacity: labelOpacityAnim,
                          transform: [{ translateX: labelTranslateXAnim }],
                        },
                      ]}
                      pointerEvents="none"
                    >
                      <Text
                        style={[
                          styles.navLabel,
                          isActive && styles.navLabelActive,
                          focused && styles.textFocused,
                        ]}
                        numberOfLines={1}
                      >
                        {tab.label}
                      </Text>
                    </Animated.View>
                  </View>
                );
              }}
            </TVFocusable>
          );
        })}

        {/* Watch Party / Birlikte İzle Katıl Butonu */}
        <TVFocusable
          onFocus={() => handleItemFocus('watchparty')}
          onBlur={() => handleItemBlur('watchparty')}
          onPress={() => setShowJoinPartyModal(true)}
          nextFocusRight={heroPlayBtnNodeId || undefined}
          style={styles.navItem}
          focusedStyle={styles.navItemFocused}
          accessibilityLabel="Birlikte İzle"
        >
          {({ focused }) => (
            <View style={styles.navItemInner}>
              <View style={styles.iconContainer}>
                <Ionicons
                  name={focused ? 'people' : 'people-outline'}
                  size={24}
                  color={focused ? '#FFFFFF' : '#E50914'}
                />
              </View>

              <Animated.View
                style={[
                  styles.labelContainer,
                  {
                    opacity: labelOpacityAnim,
                    transform: [{ translateX: labelTranslateXAnim }],
                  },
                ]}
                pointerEvents="none"
              >
                <Text
                  style={[
                    styles.navLabel,
                    { color: focused ? '#FFFFFF' : '#E50914' },
                    focused && styles.textFocused,
                  ]}
                  numberOfLines={1}
                >
                  Birlikte İzle
                </Text>
              </Animated.View>
            </View>
          )}
        </TVFocusable>
      </View>

      {/* BOTTOM FOOTER: Hint info when expanded */}
      <Animated.View
        style={[
          styles.footerHint,
          {
            opacity: labelOpacityAnim,
            transform: [{ translateX: labelTranslateXAnim }],
          },
        ]}
        pointerEvents="none"
      >
        <Text style={styles.footerHintText}>Maxen TV</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    zIndex: 1000,
    elevation: 20,
    paddingHorizontal: 8,
    justifyContent: 'flex-start',
    overflow: 'hidden',
  },
  drawerBackdrop: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: EXPANDED_WIDTH,
    overflow: 'hidden',
  },
  rightBorder: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  logoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    paddingHorizontal: 6,
    marginBottom: 12,
  },
  logoBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
    elevation: 4,
  },
  logoBadgeGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoBadgeText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1,
  },
  logoTextWrapper: {
    marginLeft: 10,
    justifyContent: 'center',
  },
  logoText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 2,
  },
  primeBadge: {
    backgroundColor: 'rgba(229, 9, 20, 0.22)',
    borderWidth: 1,
    borderColor: '#E50914',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  primeBadgeText: {
    color: '#E50914',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  profileSection: {
    marginBottom: 4,
  },
  profileButton: {
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  profileButtonFocused: {
    backgroundColor: 'rgba(229, 9, 20, 0.18)',
    borderColor: '#E50914',
    borderWidth: 2,
    transform: [{ scale: 1.04 }],
    elevation: 8,
  },
  profileButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    flexShrink: 0,
  },
  profileAvatarFocused: {
    borderColor: '#E50914',
    borderWidth: 2,
  },
  profileAvatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
  },
  profileLetter: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  profileDetails: {
    marginLeft: 10,
    flex: 1,
  },
  profileName: {
    color: '#F4F4F5',
    fontSize: 13,
    fontWeight: '700',
  },
  profileSubtitle: {
    color: '#71717A',
    fontSize: 10,
    fontWeight: '500',
    marginTop: 1,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginVertical: 8,
    marginHorizontal: 4,
  },
  navList: {
    flex: 1,
    gap: 8,
  },
  navItem: {
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: 'transparent',
    overflow: 'hidden',
    position: 'relative',
  },
  navItemActive: {
    backgroundColor: 'rgba(229, 9, 20, 0.12)',
  },
  navItemFocused: {
    backgroundColor: 'rgba(229, 9, 20, 0.22)',
    borderColor: '#E50914',
    borderWidth: 2,
    transform: [{ scale: 1.03 }],
    elevation: 8,
  },
  navItemInner: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
    height: 32,
  },
  activeIndicator: {
    position: 'absolute',
    left: -4,
    top: 5,
    bottom: 5,
    width: 3.5,
    borderRadius: 2,
    backgroundColor: '#E50914',
  },
  activeIndicatorFocused: {
    backgroundColor: '#FFFFFF',
  },
  iconContainer: {
    width: 36,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
    position: 'relative',
    overflow: 'visible',
  },
  sidebarBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#E50914',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#08080C',
    zIndex: 999,
  },
  sidebarBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },
  labelContainer: {
    marginLeft: 10,
    flex: 1,
    justifyContent: 'center',
  },
  navLabel: {
    color: '#8E8E93',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  navLabelActive: {
    color: '#E50914',
    fontWeight: '700',
  },
  textFocused: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  footerHint: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  footerHintText: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
