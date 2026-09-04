import { Platform } from 'react-native';

// API Configuration
export const API_BASE_URL =
  Platform.OS === 'web' && typeof window !== 'undefined'
    ? window.location.origin
    : (process.env.EXPO_PUBLIC_API_URL || 'https://maxen.sbs');
