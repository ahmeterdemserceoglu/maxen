import React, { useEffect } from 'react';
import {
  View,
  ScrollView,
  TextInput,
  Platform,
  BackHandler,
  TouchableWithoutFeedback,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { TVFocusable } from '@/components/TVFocusable';
import { ALL_GENRES, SORT_OPTIONS, AppliedFilters } from './useSearchEngine';

export interface SearchFilterBarProps {
  mediaType: 'all' | 'movie' | 'tv';
  setMediaType: (type: 'all' | 'movie' | 'tv') => void;
  setAppliedFilters: React.Dispatch<React.SetStateAction<AppliedFilters>>;
  filterModalVisible: boolean;
  setFilterModalVisible: (visible: boolean) => void;
  sortBy: string;
  setSortBy: (sort: string) => void;
  activeGenreIds: number[];
  setActiveGenreIds: React.Dispatch<React.SetStateAction<number[]>>;
  toggleGenre: (id: number) => void;
  yearMin: string;
  setYearMin: (min: string) => void;
  yearMax: string;
  setYearMax: (max: string) => void;
  focusMinYear: boolean;
  setFocusMinYear: (focus: boolean) => void;
  focusMaxYear: boolean;
  setFocusMaxYear: (focus: boolean) => void;
  applyFilters: () => void;
  styles: any;
  theme: any;
}

export const SearchFilterBar: React.FC<SearchFilterBarProps> = ({
  mediaType,
  setMediaType,
  setAppliedFilters,
  filterModalVisible,
  setFilterModalVisible,
  sortBy,
  setSortBy,
  activeGenreIds,
  setActiveGenreIds,
  toggleGenre,
  yearMin,
  setYearMin,
  yearMax,
  setYearMax,
  focusMinYear,
  setFocusMinYear,
  focusMaxYear,
  setFocusMaxYear,
  applyFilters,
  styles,
  theme,
}) => {
  useEffect(() => {
    if (!filterModalVisible) return;
    const onBack = () => {
      setFilterModalVisible(false);
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => sub.remove();
  }, [filterModalVisible, setFilterModalVisible]);

  if (Platform.isTV) {
    return (
      <>
        {/* Quick Filters for TV */}
        <View style={styles.tvMediaTypeRow}>
          {(['all', 'movie', 'tv'] as const).map((type) => (
            <TVFocusable
              key={type}
              onPress={() => {
                setMediaType(type);
                setAppliedFilters((prev) => ({ ...prev, mediaType: type }));
              }}
              style={[styles.tvFilterChip, mediaType === type && styles.filterChipActive]}
              focusedStyle={{ backgroundColor: '#E50914', borderRadius: 10 }}
            >
              <ThemedText
                style={[
                  styles.filterChipText,
                  mediaType === type && styles.filterChipTextActive,
                ]}
              >
                {type === 'all' ? 'Hepsi' : type === 'movie' ? 'Filmler' : 'Diziler'}
              </ThemedText>
            </TVFocusable>
          ))}
        </View>

        <TVFocusable
          onPress={() => setFilterModalVisible(true)}
          style={[styles.tvFilterBtn, { backgroundColor: '#E50914', marginTop: 12 }]}
          focusedStyle={{ transform: [{ scale: 1.05 }], opacity: 0.9 }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="options-outline" size={18} color="#fff" style={{ marginRight: 6 }} />
            <ThemedText style={{ color: '#fff', fontWeight: '600' }}>Detaylı Filtrele</ThemedText>
          </View>
        </TVFocusable>

        {/* Modal for TV */}
        {renderFilterModal()}
      </>
    );
  }

  // Mobile / Tablet Filter Bar
  return (
    <>
      <View style={styles.filterRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingRight: 16 }}
        >
          {(['all', 'movie', 'tv'] as const).map((type) => (
            <TVFocusable
              key={type}
              onPress={() => {
                setMediaType(type);
                setAppliedFilters((prev) => ({ ...prev, mediaType: type }));
              }}
              style={[styles.filterChip, mediaType === type && styles.filterChipActive]}
              focusedStyle={{
                borderColor: '#FFFFFF',
                borderWidth: 1.5,
                transform: [{ scale: 1.05 }],
              }}
            >
              <ThemedText
                style={[
                  styles.filterChipText,
                  mediaType === type && styles.filterChipTextActive,
                ]}
              >
                {type === 'all' ? 'Hepsi' : type === 'movie' ? 'Filmler' : 'Diziler'}
              </ThemedText>
            </TVFocusable>
          ))}
          <TVFocusable
            onPress={() => setFilterModalVisible(true)}
            style={[styles.filterChip, { backgroundColor: '#E50914' }]}
            focusedStyle={{
              borderColor: '#FFFFFF',
              borderWidth: 1.5,
              transform: [{ scale: 1.05 }],
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="options-outline" size={16} color="#fff" style={{ marginRight: 4 }} />
              <ThemedText style={{ color: '#fff', fontWeight: '600' }}>Filtrele</ThemedText>
            </View>
          </TVFocusable>
        </ScrollView>
      </View>

      {/* Modal */}
      {renderFilterModal()}
    </>
  );

  function renderFilterModal() {
    if (!filterModalVisible) return null;

    return (
      <View style={styles.modalOverlay} pointerEvents="box-none">
        <TouchableWithoutFeedback onPress={() => setFilterModalVisible(false)}>
          <View style={styles.modalBackdrop}>
            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalContent}>
                {/* Modal Header */}
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 20,
                  }}
                >
                  <ThemedText style={{ color: '#fff', fontSize: 20, fontWeight: '800' }}>
                    Gelişmiş Filtreler
                  </ThemedText>
                  <TVFocusable
                    onPress={() => setFilterModalVisible(false)}
                    focusedStyle={{
                      backgroundColor: 'rgba(255,255,255,0.15)',
                      borderRadius: 12,
                    }}
                    accessibilityLabel="Kapat"
                  >
                    <Ionicons name="close" size={24} color="#fff" />
                  </TVFocusable>
                </View>

                {/* Modal Body */}
                <ScrollView
                  style={{ flex: 1 }}
                  contentContainerStyle={{ paddingBottom: 12 }}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >
                  <ThemedText style={styles.modalLabel}>Sıralama</ThemedText>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                    {SORT_OPTIONS.map((opt, index) => (
                      <TVFocusable
                        key={opt.key}
                        hasTVPreferredFocus={index === 0}
                        onPress={() => setSortBy(opt.key)}
                        style={[styles.filterChip, sortBy === opt.key && styles.filterChipActive]}
                        focusedStyle={{
                          borderColor: '#FFFFFF',
                          borderWidth: 1.5,
                          transform: [{ scale: 1.05 }],
                        }}
                      >
                        <ThemedText
                          style={[
                            styles.filterChipText,
                            sortBy === opt.key && styles.filterChipTextActive,
                          ]}
                        >
                          {opt.label}
                        </ThemedText>
                      </TVFocusable>
                    ))}
                  </View>

                  <View style={styles.modalSection}>
                    <View style={styles.sectionHeader}>
                      <ThemedText style={styles.modalLabel}>Kategoriler</ThemedText>
                      {activeGenreIds.length > 0 && (
                        <TVFocusable
                          onPress={() => setActiveGenreIds([])}
                          style={styles.clearGenreBtn}
                          focusedStyle={{ borderColor: '#E50914', borderWidth: 1 }}
                        >
                          <ThemedText style={styles.clearGenreText}>
                            {activeGenreIds.length} seçili ✕
                          </ThemedText>
                        </TVFocusable>
                      )}
                    </View>
                    <View style={styles.genreGrid}>
                      {ALL_GENRES.map((genre) => {
                        const isSelected = activeGenreIds.includes(genre.id);
                        return (
                          <TVFocusable
                            key={genre.id}
                            onPress={() => toggleGenre(genre.id)}
                            style={[
                              styles.genreCard,
                              { backgroundColor: genre.bg, borderColor: genre.color + '40' },
                              isSelected && {
                                backgroundColor: genre.color,
                                borderColor: genre.color,
                                borderWidth: 2,
                              },
                            ]}
                            focusedStyle={{
                              borderColor: '#FFFFFF',
                              borderWidth: 2,
                              transform: [{ scale: 1.03 }],
                            }}
                          >
                            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                              <Ionicons
                                name={genre.icon as any}
                                size={18}
                                color={isSelected ? '#fff' : genre.color}
                                style={{ marginBottom: 4 }}
                              />
                              <ThemedText
                                style={[
                                  styles.genreCardText,
                                  { color: isSelected ? '#fff' : genre.color },
                                ]}
                                numberOfLines={1}
                              >
                                {genre.name}
                              </ThemedText>
                              {isSelected && (
                                <View style={styles.checkmarkBadge}>
                                  <Ionicons name="checkmark-circle" size={16} color="#fff" />
                                </View>
                              )}
                            </View>
                          </TVFocusable>
                        );
                      })}
                    </View>
                  </View>

                  <ThemedText style={styles.modalLabel}>Yıl Aralığı</ThemedText>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <TextInput
                      style={[
                        styles.yearInput,
                        {
                          borderColor: focusMinYear ? theme.primary : 'transparent',
                          borderWidth: focusMinYear ? 2 : 0,
                        },
                      ]}
                      placeholder="Min"
                      placeholderTextColor="#666"
                      keyboardType="numeric"
                      value={yearMin}
                      onChangeText={setYearMin}
                      maxLength={4}
                      onFocus={() => setFocusMinYear(true)}
                      onBlur={() => setFocusMinYear(false)}
                    />
                    <ThemedText style={{ color: '#666' }}>-</ThemedText>
                    <TextInput
                      style={[
                        styles.yearInput,
                        {
                          borderColor: focusMaxYear ? theme.primary : 'transparent',
                          borderWidth: focusMaxYear ? 2 : 0,
                        },
                      ]}
                      placeholder="Max"
                      placeholderTextColor="#666"
                      keyboardType="numeric"
                      value={yearMax}
                      onChangeText={setYearMax}
                      maxLength={4}
                      onFocus={() => setFocusMaxYear(true)}
                      onBlur={() => setFocusMaxYear(false)}
                    />
                  </View>
                </ScrollView>

                {/* Modal Footer */}
                <TVFocusable
                  onPress={applyFilters}
                  style={[filterStyles.applyFilterButton, { marginTop: 16 }]}
                  focusedStyle={{
                    borderColor: '#FFFFFF',
                    borderWidth: 2.5,
                    transform: [{ scale: 1.02 }],
                    backgroundColor: '#f40612',
                  }}
                >
                  <ThemedText style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>
                    Uygula
                  </ThemedText>
                </TVFocusable>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </View>
    );
  }
};

const filterStyles = StyleSheet.create({
  applyFilterButton: {
    backgroundColor: '#E50914',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
});
