import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Platform,
  useWindowDimensions,
  BackHandler,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { TVFocusable } from '@/components/TVFocusable';
import { useTheme } from '@/hooks/use-theme';

const isTV = Platform.isTV;

export interface RatingModalProps {
  visible: boolean;
  onClose: () => void;
  currentRating: number | null;
  onRate: (rating: number | null) => void;
  mediaTitle?: string;
}

export function RatingModal({
  visible,
  onClose,
  currentRating,
  onRate,
  mediaTitle,
}: RatingModalProps) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const isTablet = width > 600;

  const [hoverRating, setHoverRating] = useState<number | null>(null);

  useEffect(() => {
    if (visible) {
      setHoverRating(currentRating);
    }
  }, [visible, currentRating]);

  // TV / Android Back tuşu
  useEffect(() => {
    if (!visible) return;
    const onBack = () => {
      onClose();
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => sub.remove();
  }, [visible, onClose]);

  if (!visible) return null;

  const stars = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const activeRating = hoverRating !== null ? hoverRating : currentRating || 0;

  const handleSelect = (score: number) => {
    onRate(score);
    onClose();
  };

  const handleClear = () => {
    onRate(null);
    onClose();
  };

  return (
    <View style={styles.modalOverlay} pointerEvents="box-none">
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <View style={[styles.card, isTablet && styles.cardTablet, isTV && styles.cardTV]}>
              {/* Header */}
              <View style={styles.header}>
                <View style={styles.headerTitleRow}>
                  <Ionicons name="star" size={isTV ? 28 : 24} color="#F5C518" />
                  <ThemedText style={[styles.title, isTV && styles.titleTV]}>
                    {mediaTitle ? `${mediaTitle}` : 'Puan Ver'}
                  </ThemedText>
                </View>

                <TVFocusable
                  onPress={onClose}
                  style={styles.closeBtn}
                  focusedStyle={styles.closeBtnFocused}
                  accessibilityLabel="Kapat"
                >
                  <Ionicons name="close" size={isTV ? 24 : 20} color="#FFFFFF" />
                </TVFocusable>
              </View>

              <ThemedText style={[styles.subtitle, isTV && styles.subtitleTV]}>
                Bu yapıma 1 ile 10 arasında bir puan verin:
              </ThemedText>

              {/* Rating Display */}
              <View style={[styles.scoreBadge, isTV && styles.scoreBadgeTV]}>
                <ThemedText style={[styles.scoreText, isTV && styles.scoreTextTV]}>
                  {activeRating > 0 ? `${activeRating} / 10` : 'Henüz puanlanmadı'}
                </ThemedText>
              </View>

              {/* Quick Score Chips */}
              <View style={styles.scoreChipsRow}>
                {stars.map((score) => {
                  const isCurrent = currentRating === score;
                  return (
                    <TVFocusable
                      key={`chip-${score}`}
                      hasTVPreferredFocus={isCurrent || (currentRating === null && score === 7)}
                      onPress={() => handleSelect(score)}
                      style={[
                        styles.chip,
                        isTV && styles.chipTV,
                        isCurrent && styles.chipActive,
                      ]}
                      focusedStyle={styles.chipFocused}
                      accessibilityLabel={`Puan ${score}`}
                    >
                      <ThemedText
                        style={[
                          styles.chipText,
                          isTV && styles.chipTextTV,
                          isCurrent && styles.chipTextActive,
                        ]}
                      >
                        {score}
                      </ThemedText>
                    </TVFocusable>
                  );
                })}
              </View>

              {/* Actions */}
              <View style={styles.actionRow}>
                {currentRating !== null && (
                  <TVFocusable
                    onPress={handleClear}
                    style={styles.clearBtn}
                    focusedStyle={styles.clearBtnFocused}
                  >
                    <Ionicons name="trash-outline" size={18} color="#E50914" />
                    <ThemedText style={styles.clearBtnText}>Puanı Kaldır</ThemedText>
                  </TVFocusable>
                )}

                <TVFocusable
                  onPress={onClose}
                  style={styles.doneBtn}
                  focusedStyle={styles.doneBtnFocused}
                >
                  <ThemedText style={styles.doneBtnText}>Vazgeç / Kapat</ThemedText>
                </TVFocusable>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </View>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 99999,
    elevation: 99999,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: '#18181b',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 20,
  },
  cardTablet: {
    maxWidth: 540,
    padding: 28,
  },
  cardTV: {
    maxWidth: 680,
    padding: 36,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    flex: 1,
  },
  titleTV: {
    fontSize: 26,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnFocused: {
    borderColor: '#FFFFFF',
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderWidth: 2,
    transform: [{ scale: 1.1 }],
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    marginBottom: 16,
  },
  subtitleTV: {
    fontSize: 16,
    marginBottom: 20,
  },
  scoreBadge: {
    alignSelf: 'center',
    backgroundColor: 'rgba(245, 197, 24, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245, 197, 24, 0.3)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginBottom: 18,
  },
  scoreBadgeTV: {
    paddingHorizontal: 22,
    paddingVertical: 8,
    borderRadius: 24,
    marginBottom: 24,
  },
  scoreText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#F5C518',
  },
  scoreTextTV: {
    fontSize: 22,
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    marginBottom: 20,
  },
  starTouch: {
    padding: 4,
    borderRadius: 6,
  },
  starFocused: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    transform: [{ scale: 1.25 }],
  },
  scoreChipsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 24,
  },
  chip: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipTV: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  chipActive: {
    backgroundColor: '#F5C518',
    borderColor: '#F5C518',
  },
  chipFocused: {
    borderColor: '#fff',
    transform: [{ scale: 1.15 }],
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  chipText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#aaa',
  },
  chipTextTV: {
    fontSize: 18,
  },
  chipTextActive: {
    color: '#000',
    fontWeight: '900',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 12,
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(229, 9, 20, 0.1)',
  },
  clearBtnFocused: {
    backgroundColor: 'rgba(229, 9, 20, 0.3)',
  },
  clearBtnText: {
    color: '#E50914',
    fontSize: 14,
    fontWeight: '700',
  },
  doneBtn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  doneBtnFocused: {
    backgroundColor: '#E50914',
  },
  doneBtnText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '800',
  },
});
