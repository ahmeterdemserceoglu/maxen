import React from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Image } from 'expo-image';
import { ThemedText } from '@/components/themed-text';
import { TVFocusable } from '@/components/TVFocusable';
import { CollectionData, RecommendationItem } from './useDetailState';

export interface RecommendationsGridProps {
  collectionData: CollectionData | null;
  recommendations: RecommendationItem[];
  isTV: boolean;
  styles: any;
  theme: any;
  onSelectMedia?: (media: any) => void;
  onPlayMedia: (media: any) => void;
}

export function RecommendationsGrid({
  collectionData,
  recommendations,
  isTV,
  styles,
  theme,
  onSelectMedia,
  onPlayMedia,
}: RecommendationsGridProps) {
  const handleItemPress = (item: RecommendationItem) => {
    if (onSelectMedia) {
      onSelectMedia(item);
    } else {
      onPlayMedia(item);
    }
  };

  const hasCollection = collectionData && collectionData.parts?.length > 0;
  const hasRecommendations = recommendations && recommendations.length > 0;

  if (!hasCollection && !hasRecommendations) return null;

  /*
   * ============================================================
   * TV RECOMMENDATIONS & COLLECTION
   * ============================================================
   */
  if (isTV) {
    return (
      <View>
        {/* TV KOLEKSİYON (BOXSET) */}
        {hasCollection && (
          <View style={{ marginTop: 24 }}>
            <ThemedText style={styles.tvSectionLabel}>
              {collectionData.name.toUpperCase()}
            </ThemedText>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              directionalLockEnabled
            >
              {collectionData.parts.map((item, index) => (
                <TVFocusable
                  key={`col-${item.id}-${index}`}
                  onPress={() => handleItemPress(item)}
                  style={styles.tvRecCard}
                  focusedStyle={styles.tvRecCardFocused}
                >
                  {({ focused }) => (
                    <>
                      <Image
                        source={{
                          uri:
                            item.posterUrl ||
                            'https://placehold.co/300x450/222/555?text=MAXEN',
                        }}
                        style={styles.tvRecPoster}
                        contentFit="cover"
                      />
                      <ThemedText
                        style={[
                          styles.tvRecTitle,
                          focused && { color: theme.primary },
                        ]}
                        numberOfLines={1}
                      >
                        {item.title}
                      </ThemedText>
                    </>
                  )}
                </TVFocusable>
              ))}
            </ScrollView>
          </View>
        )}

        {/* TV BENZER İÇERİKLER */}
        {hasRecommendations && (
          <View style={{ marginTop: 24, marginBottom: 30 }}>
            <ThemedText style={styles.tvSectionLabel}>
              BUNU SEVENLER BUNLARI DA İZLEDİ
            </ThemedText>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              directionalLockEnabled
            >
              {recommendations.map((item, index) => (
                <TVFocusable
                  key={`rec-${item.id}-${index}`}
                  onPress={() => handleItemPress(item)}
                  style={styles.tvRecCard}
                  focusedStyle={styles.tvRecCardFocused}
                >
                  {({ focused }) => (
                    <>
                      <Image
                        source={{
                          uri:
                            item.posterUrl ||
                            'https://placehold.co/300x450/222/555?text=MAXEN',
                        }}
                        style={styles.tvRecPoster}
                        contentFit="cover"
                      />
                      <ThemedText
                        style={[
                          styles.tvRecTitle,
                          focused && { color: theme.primary },
                        ]}
                        numberOfLines={1}
                      >
                        {item.title}
                      </ThemedText>
                    </>
                  )}
                </TVFocusable>
              ))}
            </ScrollView>
          </View>
        )}
      </View>
    );
  }

  /*
   * ============================================================
   * MOBILE RECOMMENDATIONS & COLLECTION
   * ============================================================
   */
  return (
    <View>
      {/* MOBİL KOLEKSİYON (BOXSET) */}
      {hasCollection && (
        <View style={styles.recSection}>
          <ThemedText style={styles.recTitle}>
            {collectionData.name}
          </ThemedText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {collectionData.parts.map((item, index) => (
              <TouchableOpacity
                key={`mob-col-${item.id}-${index}`}
                style={styles.recCard}
                activeOpacity={0.8}
                onPress={() => handleItemPress(item)}
              >
                <Image
                  source={{
                    uri:
                      item.posterUrl ||
                      'https://placehold.co/300x450/222/555?text=MAXEN',
                  }}
                  style={styles.recPoster}
                  contentFit="cover"
                />
                <ThemedText style={styles.recMovieTitle} numberOfLines={1}>
                  {item.title}
                </ThemedText>
                <ThemedText style={styles.recRating}>★ {item.rating}</ThemedText>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* MOBİL BENZER İÇERİKLER */}
      {hasRecommendations && (
        <View style={styles.recSection}>
          <ThemedText style={styles.recTitle}>
            Bunu Sevenler Bunları da İzledi
          </ThemedText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {recommendations.map((item, index) => (
              <TouchableOpacity
                key={`mob-rec-${item.id}-${index}`}
                style={styles.recCard}
                activeOpacity={0.8}
                onPress={() => handleItemPress(item)}
              >
                <Image
                  source={{
                    uri:
                      item.posterUrl ||
                      'https://placehold.co/300x450/222/555?text=MAXEN',
                  }}
                  style={styles.recPoster}
                  contentFit="cover"
                />
                <ThemedText style={styles.recMovieTitle} numberOfLines={1}>
                  {item.title}
                </ThemedText>
                <ThemedText style={styles.recRating}>★ {item.rating}</ThemedText>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}
