import React from 'react';
import {
  View,
  ScrollView,
} from 'react-native';
import { getTVNodeHandle } from '@/utils/tvNodeHandle';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { TVFocusable } from '@/components/TVFocusable';
import { CastMember } from './useDetailState';

export interface CastMemberListProps {
  cast: CastMember[];
  isTV: boolean;
  styles: any;
  actorRefs?: any;
  playButtonRef?: any;
  genres?: string;
  onFirstFocusableResolved?: (nodeId: number) => void;
  onSelectActor: (actor: any) => void;
}

export function CastMemberList({
  cast,
  isTV,
  styles,
  actorRefs,
  playButtonRef,
  genres,
  onFirstFocusableResolved,
  onSelectActor,
}: CastMemberListProps) {
  if (!cast || cast.length === 0) return null;

  /*
   * ============================================================
   * TV CAST LIST
   * ============================================================
   */
  if (isTV) {
    return (
      <View style={styles.tvSection}>
        <ThemedText style={styles.tvSectionTitle}>Oyuncular & Ekip</ThemedText>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tvCastRow}
        >
          {cast.slice(0, 15).map((actor, index) => (
            <TVFocusable
              key={`tv-actor-${actor.tmdbId ?? actor.name ?? index}`}
              ref={(el) => {
                if (actorRefs?.current) {
                  actorRefs.current[index] = el;
                }
                if (index === 0) {
                  const nodeId = getTVNodeHandle(el);
                  if (nodeId) onFirstFocusableResolved?.(nodeId);
                }
              }}
              onPress={() => onSelectActor(actor)}
              style={styles.tvActorCard}
              focusedStyle={styles.tvActorFocused}
              nextFocusUp={getTVNodeHandle(playButtonRef)}
              nextFocusLeft={index > 0 ? getTVNodeHandle(actorRefs?.current?.[index - 1]) : undefined}
              nextFocusRight={index < cast.length - 1 ? getTVNodeHandle(actorRefs?.current?.[index + 1]) : undefined}
            >
              {({ focused }) => (
                <>
                  <View
                    style={[
                      styles.tvActorImageWrapper,
                      focused && styles.tvActorImageFocused,
                    ]}
                  >
                    {actor.profileUrl ? (
                      <Image
                        source={{ uri: actor.profileUrl }}
                        style={styles.tvActorImage}
                        contentFit="cover"
                      />
                    ) : (
                      <View
                        style={[
                          styles.tvActorImage,
                          styles.tvActorPlaceholder,
                        ]}
                      >
                        <Ionicons name="person" size={26} color="#777" />
                      </View>
                    )}
                  </View>

                  <ThemedText
                    style={[
                      styles.tvActorName,
                      focused && styles.tvActorNameFocused,
                    ]}
                    numberOfLines={1}
                  >
                    {actor.name}
                  </ThemedText>
                </>
              )}
            </TVFocusable>
          ))}
        </ScrollView>
      </View>
    );
  }

  /*
   * ============================================================
   * MOBILE CAST LIST
   * ============================================================
   */
  return (
    <View style={styles.infoBlock}>
      <View style={styles.castContainer}>
        <ThemedText style={styles.infoLabel}>Başrol: </ThemedText>

        <View style={styles.castList}>
          {cast.map((actor, index) => (
            <TVFocusable
              key={index}
              onPress={() => onSelectActor(actor)}
              style={styles.actorButton}
              focusedStyle={{
                backgroundColor: 'rgba(255,255,255,0.15)',
                borderRadius: 4,
                paddingHorizontal: 4,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                }}
              >
                {actor.profileUrl && (
                  <Image
                    source={{ uri: actor.profileUrl }}
                    style={styles.actorThumb}
                  />
                )}

                <ThemedText style={styles.actorLink}>
                  {actor.name}
                  {index < cast.length - 1 ? ', ' : ''}
                </ThemedText>
              </View>
            </TVFocusable>
          ))}
        </View>
      </View>

      {genres ? (
        <ThemedText style={styles.infoLine} numberOfLines={1}>
          <ThemedText style={styles.infoLabel}>Türler: </ThemedText>
          {genres}
        </ThemedText>
      ) : null}
    </View>
  );
}
