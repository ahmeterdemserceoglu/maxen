import React from 'react';
import {
  View,
  TextInput,
  Keyboard,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { TVFocusable } from '@/components/TVFocusable';

export interface SearchHeaderProps {
  query: string;
  setQuery: (text: string) => void;
  inputRef?: React.RefObject<TextInput | null>;
  isInputFocused: boolean;
  setIsInputFocused: (focused: boolean) => void;
  isListening: boolean;
  handleVoiceSearch: () => void;
  performSearch: (text: string, pageNum: number, append: boolean) => void;
  suggestions: any[];
  showSuggestions: boolean;
  setShowSuggestions: (show: boolean) => void;
  onSelectSuggestion: (item: any) => void;
  fetchSuggestions: (text: string) => void;
  placeholder?: string;
  styles: any;
  theme: any;
}

export const SearchHeader: React.FC<SearchHeaderProps> = ({
  query,
  setQuery,
  inputRef,
  isInputFocused,
  setIsInputFocused,
  isListening,
  handleVoiceSearch,
  performSearch,
  suggestions,
  showSuggestions,
  onSelectSuggestion,
  fetchSuggestions,
  placeholder = 'Film, dizi veya tür ara...',
  styles,
  theme,
}) => {
  const renderSuggestionItem = (item: any) => (
    <TVFocusable
      key={`sug-${item.id}-${item.type}`}
      onPress={() => onSelectSuggestion(item)}
      style={styles.suggestionRow}
      focusedStyle={{ backgroundColor: 'rgba(229,9,20,0.12)', borderRadius: 8 }}
    >
      <Image
        source={{ uri: item.posterUrl || 'https://placehold.co/40x60/222/444?text=??' }}
        style={[styles.suggestionPoster, item.type === 'person' && styles.suggestionAvatar]}
      />
      <View style={{ flex: 1, marginLeft: 10 }}>
        <ThemedText style={styles.suggestionTitle} numberOfLines={1}>
          {item.title}
        </ThemedText>
        <ThemedText style={styles.suggestionMeta} numberOfLines={1}>
          {item.type === 'person'
            ? `Oyuncu${item.knownFor ? ` · ${item.knownFor}` : ''}`
            : `${item.type === 'movie' ? 'Film' : 'Dizi'}${item.year ? ` · ${item.year}` : ''}`}
        </ThemedText>
      </View>
    </TVFocusable>
  );

  return (
    <>
      <View
        style={[
          styles.searchBar,
          {
            backgroundColor: '#171717',
            borderColor: isInputFocused ? theme.primary : 'transparent',
            borderWidth: 2,
          },
        ]}
      >
        <Ionicons name="search-outline" size={20} color="#737373" style={styles.searchIcon} />
        <TextInput
          ref={inputRef as any}
          value={query}
          onChangeText={setQuery}
          placeholder={placeholder}
          placeholderTextColor="#525252"
          style={[styles.searchInput, { color: theme.text }]}
          showSoftInputOnFocus={true}
          onFocus={() => {
            setIsInputFocused(true);
            fetchSuggestions(query);
            if (Platform.isTV && inputRef?.current) {
              setTimeout(() => inputRef.current?.focus(), 150);
            }
          }}
          onBlur={() => setIsInputFocused(false)}
          blurOnSubmit={true}
          onSubmitEditing={() => {
            performSearch(query, 1, false);
            Keyboard.dismiss();
            inputRef?.current?.blur();
          }}
        />
        {query.length > 0 && (
          <TVFocusable
            onPress={() => setQuery('')}
            style={styles.clearBtn}
            focusedStyle={{ transform: [{ scale: 1.1 }] }}
          >
            <Ionicons name="close-circle" size={18} color="#737373" />
          </TVFocusable>
        )}
        <TVFocusable
          onPress={handleVoiceSearch}
          style={[styles.micBtn, { backgroundColor: '#E50914' }]}
          focusedStyle={{ transform: [{ scale: 1.1 }] }}
        >
          <Ionicons name={isListening ? 'hourglass-outline' : 'mic'} size={18} color="#fff" />
        </TVFocusable>
      </View>

      {/* Öneri Listesi */}
      {showSuggestions && suggestions.length > 0 && query.length > 0 && (
        <View style={styles.suggestionsContainer}>
          {suggestions.map((item) => renderSuggestionItem(item))}
        </View>
      )}
    </>
  );
};
