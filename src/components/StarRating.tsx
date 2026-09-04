import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TVFocusable } from './TVFocusable';

interface StarRatingProps {
  rating: number | null; // 1 to 10
  onRate: (rating: number) => void;
}

export function StarRating({ rating, onRate }: StarRatingProps) {
  // We'll show 10 stars.
  const stars = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  return (
    <View style={styles.container}>
      {stars.map((star) => (
        <TVFocusable
          key={star}
          onPress={() => onRate(star)}
          style={styles.starWrapper}
          focusedStyle={styles.starFocused}
        >
          <Ionicons
            name={rating && rating >= star ? 'star' : 'star-outline'}
            size={24}
            color={rating && rating >= star ? '#F5C518' : '#888'}
          />
        </TVFocusable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },
  starWrapper: {
    padding: 4,
    borderRadius: 4,
  },
  starFocused: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    transform: [{ scale: 1.2 }],
  },
});
