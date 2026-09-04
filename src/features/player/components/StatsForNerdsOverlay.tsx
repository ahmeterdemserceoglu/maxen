import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface StatsForNerdsProps {
  visible: boolean;
  resolution?: string;
  bitrateKbps?: number;
  bufferAheadSeconds?: number;
  droppedFrames?: number;
  provider?: string;
  audioTrack?: string;
  fps?: number;
  onClose?: () => void;
}

export function StatsForNerdsOverlay({
  visible,
  resolution = '1080p (FHD)',
  bitrateKbps = 4850,
  bufferAheadSeconds = 24.5,
  droppedFrames = 0,
  provider = 'Direct HLS (VixSrc / Fast-Fail)',
  audioTrack = 'Orijinal Ses (AAC 2.0)',
  fps = 60,
}: StatsForNerdsProps) {
  if (!visible) return null;

  const bitrateMbps = (bitrateKbps / 1000).toFixed(2);
  const bufferText = `${bufferAheadSeconds.toFixed(1)}s`;

  return (
    <View style={styles.hudContainer} pointerEvents="none">
      <View style={styles.headerRow}>
        <Ionicons name="stats-chart" size={14} color="#E50914" style={{ marginRight: 6 }} />
        <Text style={styles.hudTitle}>MAXEN STREAM TELEMETRY</Text>
      </View>

      <View style={styles.metricsGrid}>
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Çözünürlük:</Text>
          <Text style={[styles.metricValue, { color: '#4ADE80' }]}>{resolution}</Text>
        </View>

        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Bitrate:</Text>
          <Text style={styles.metricValue}>{bitrateMbps} Mbps</Text>
        </View>

        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Tampon (Buffer):</Text>
          <Text style={[styles.metricValue, bufferAheadSeconds < 5 ? { color: '#EF4444' } : { color: '#38BDF8' }]}>
            {bufferText}
          </Text>
        </View>

        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Kare Hızı (FPS):</Text>
          <Text style={styles.metricValue}>{fps} fps</Text>
        </View>

        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Düşen Kare:</Text>
          <Text style={[styles.metricValue, droppedFrames > 0 ? { color: '#F59E0B' } : { color: '#A1A1AA' }]}>
            {droppedFrames}
          </Text>
        </View>

        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Ses İzi:</Text>
          <Text style={styles.metricValue} numberOfLines={1}>{audioTrack}</Text>
        </View>

        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Sağlayıcı:</Text>
          <Text style={[styles.metricValue, { color: '#FBBF24' }]} numberOfLines={1}>{provider}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hudContainer: {
    position: 'absolute',
    top: Platform.isTV ? 40 : 60,
    left: Platform.isTV ? 40 : 20,
    backgroundColor: 'rgba(10, 10, 14, 0.88)',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    zIndex: 9999,
    width: 280,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.7,
    shadowRadius: 10,
    elevation: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    paddingBottom: 6,
  },
  hudTitle: {
    color: '#E50914',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  metricsGrid: {
    gap: 4,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metricLabel: {
    color: '#9CA3AF',
    fontSize: 11,
    fontWeight: '600',
  },
  metricValue: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    maxWidth: 160,
    textAlign: 'right',
  },
});
