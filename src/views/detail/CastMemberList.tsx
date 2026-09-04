import React from 'react';
import {
  View,
  ScrollView,
  findNodeHandle,
} from 'react-native';
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
  onSelectActor: (actor: any) => void;
}

export function CastMemberList({
  cast,
  isTV,
  styles,
  actorRefs,
  playButtonRef,
  genres,
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
      <View style={styles.tvCastSection}>
        <ThemedText style={styles.tvSectionLabel}>OYUNCULAR</ThemedText>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          directionalLockEnabled
        >
          {cast.map((actor, index) => (
            <TVFocusable
              key={index}
              ref={(ref) => {
                if (actorRefs?.current) {
                  actorRefs.current[index] = ref;
                }
              }}
              onPress={() => onSelectActor(actor)}
              style={styles.tvActorCard}
              focusedStyle={styles.tvActorFocused}
              nextFocusUp={
                playButtonRef?.current
                  ? findNodeHandle(playButtonRef.current) || undefined
                  : undefined
              }
              nextFocusLeft={
                index > 0 && actorRefs?.current?.[index - 1]
                  ? findNodeHandle(actorRefs.current[index - 1]) || undefined
                  : undefined
              }
              nextFocusRight={
                index < cast.length - 1 && actorRefs?.current?.[index + 1]
                  ? findNodeHandle(actorRefs.current[index + 1]) || undefined
                  : undefined
              }
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
