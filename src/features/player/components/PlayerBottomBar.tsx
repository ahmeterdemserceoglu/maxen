import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { TVFocusable } from '@/components/TVFocusable';
import { ProgressBar } from '@/features/player/components/ProgressBar';

const isTV = Platform.isTV;

interface PlayerBottomBarProps {
  bottomPadding: number;
  currentTime: number;
  duration: number;
  panHandlers: any;
  onLayout?: (e: any) => void;
  onProgressLayout?: (e: any) => void;
  formatTime: (sec: number) => string;
  isSeeking: boolean;
  seekPreviewTime?: number;
  previewThumbnail?: any;
  isMovie: boolean;
  media: any;
  onPlayNextMedia?: (media: any) => void;
  controlsVisible: boolean;
  isPlaying: boolean;
  onPlayPause: () => void;
  onRewind: () => void;
  onForward: () => void;
  endTime: string;
  playbackRate: number;
  onCycleSpeed: () => void;
  onOpenAudioMenu: () => void;
  onOpenSubtitleMenu: () => void;
  selectedQuality?: string;
  onOpenQualityMenu?: () => void;
  onToggleContentFit: () => void;
  onOpenEpisodesMenu?: () => void;
  prolongControls: () => void;
}

export function PlayerBottomBar({
  bottomPadding,
  currentTime,
  duration,
  panHandlers,
  onLayout,
  onProgressLayout,
  formatTime,
  isSeeking,
  seekPreviewTime,
  previewThumbnail,
  isMovie,
  media,
  onPlayNextMedia,
  controlsVisible,
  isPlaying,
  onPlayPause,
  onRewind,
  onForward,
  endTime,
  playbackRate,
  onCycleSpeed,
  onOpenAudioMenu,
  onOpenSubtitleMenu,
  selectedQuality = 'auto',
  onOpenQualityMenu,
  onToggleContentFit,
  onOpenEpisodesMenu,
  prolongControls,
}: PlayerBottomBarProps) {
  const isTV = Platform.isTV;

  const renderMobileControls = () => (
    <View style={styles.controlRow}>
      <View style={styles.leftControls}>
        <View style={styles.mBtn}>
          <Text style={styles.mBtnTxt}>M</Text>
        </View>
        <TVFocusable
          style={styles.ctrlBtn}
          focusedStyle={{ transform: [{ scale: 1.15 }], backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20 }}
          onFocus={prolongControls}
          onPress={onRewind}
        >
          <Ionicons name="play-back" size={20} color="#fff" />
        </TVFocusable>
        <TVFocusable
          hasTVPreferredFocus={controlsVisible}
          style={styles.ctrlBtn}
          focusedStyle={{ transform: [{ scale: 1.15 }], backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20 }}
          onFocus={prolongControls}
          onPress={onPlayPause}
          accessibilityLabel={isPlaying ? 'Duraklat' : 'Oynat'}
        >
          <Ionicons name={isPlaying ? 'pause' : 'play'} size={24} color="#fff" />
        </TVFocusable>
        <TVFocusable
          style={styles.ctrlBtn}
          focusedStyle={{ transform: [{ scale: 1.15 }], backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20 }}
          onFocus={prolongControls}
          onPress={onForward}
        >
          <Ionicons name="play-forward" size={20} color="#fff" />
        </TVFocusable>
      </View>
      <View style={styles.centerControls}>
        <Text style={styles.endTimeTxt}>Bitiş: {endTime}</Text>
      </View>
      <View style={styles.rightControls}>
        <TVFocusable
          style={styles.speedBtn}
          focusedStyle={{ transform: [{ scale: 1.15 }], backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 16 }}
          onFocus={prolongControls}
          onPress={onCycleSpeed}
        >
          <Text style={styles.speedBtnTxt}>{playbackRate}x</Text>
        </TVFocusable>
        {onOpenQualityMenu && (
          <TVFocusable
            style={styles.qualityBtn}
            focusedStyle={{ transform: [{ scale: 1.15 }], backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 8 }}
            onFocus={prolongControls}
            onPress={onOpenQualityMenu}
            accessibilityLabel="Görüntü Kalitesi"
          >
            <View style={styles.qualityBadge}>
              <Text style={styles.qualityBadgeTxt}>
                {selectedQuality === 'auto' || !selectedQuality
                  ? 'AUTO'
                  : selectedQuality === '1080p'
                  ? '1080P'
                  : selectedQuality === '720p'
                  ? '720P'
                  : selectedQuality === '480p'
                  ? '480P'
                  : selectedQuality === '360p'
                  ? '360P'
                  : selectedQuality.toUpperCase()}
              </Text>
            </View>
          </TVFocusable>
        )}
        <TVFocusable
          style={styles.ctrlBtn}
          focusedStyle={{ transform: [{ scale: 1.15 }], backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20 }}
          onFocus={prolongControls}
          onPress={onOpenAudioMenu}
        >
          <Ionicons name="musical-notes-outline" size={24} color="#fff" />
        </TVFocusable>
        <TVFocusable
          style={styles.ctrlBtn}
          focusedStyle={{ transform: [{ scale: 1.15 }], backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20 }}
          onFocus={prolongControls}
          onPress={onOpenSubtitleMenu}
          accessibilityLabel="Altyazı Dili"
        >
          <Ionicons name="language-outline" size={24} color="#fff" />
        </TVFocusable>
        {!isMovie && onOpenEpisodesMenu && (
          <TVFocusable
            style={styles.ctrlBtn}
            focusedStyle={{ transform: [{ scale: 1.15 }], backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20 }}
            onFocus={prolongControls}
            onPress={onOpenEpisodesMenu}
            accessibilityLabel="Bölümler"
          >
            <Ionicons name="albums-outline" size={22} color="#fff" />
          </TVFocusable>
        )}
        <TVFocusable
          style={styles.ctrlBtn}
          focusedStyle={{ transform: [{ scale: 1.15 }], backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20 }}
          onFocus={prolongControls}
          onPress={onToggleContentFit}
        >
          <Ionicons name="expand-outline" size={24} color="#fff" />
        </TVFocusable>
      </View>
    </View>
  );

  const renderTVControls = () => (
    <View style={styles.tvControlsContainer}>
      <View style={styles.tvActionRow}>
        <TVFocusable
          style={styles.tvCtrlBtn}
          focusedStyle={styles.tvCtrlBtnFocused}
          onFocus={prolongControls}
          onPress={onRewind}
        >
          <Ionicons name="play-back" size={20} color="#fff" />
          <Text style={styles.tvCtrlBtnTxt}>-10s</Text>
        </TVFocusable>

        <TVFocusable
          hasTVPreferredFocus={controlsVisible}
          style={styles.tvPlayBtn}
          accessibilityLabel={isPlaying ? 'Duraklat' : 'Oynat'}
          focusedStyle={styles.tvPlayBtnFocused}
          onFocus={prolongControls}
          onPress={onPlayPause}
        >
          {({ focused }) => (
            <Ionicons name={isPlaying ? 'pause' : 'play'} size={32} color="#fff" />
          )}
        </TVFocusable>

        <TVFocusable
          style={styles.tvCtrlBtn}
          focusedStyle={styles.tvCtrlBtnFocused}
          onFocus={prolongControls}
          onPress={onForward}
        >
          <Text style={styles.tvCtrlBtnTxt}>+10s</Text>
          <Ionicons name="play-forward" size={20} color="#fff" />
        </TVFocusable>

        {!isMovie && onOpenEpisodesMenu && (
          <TVFocusable style={styles.tvSettingBtn} focusedStyle={styles.tvSettingBtnFocused} onFocus={prolongControls} onPress={onOpenEpisodesMenu}>
            <Ionicons name="list-outline" size={20} color="#fff" style={styles.tvSettingIcon} />
            <Text style={styles.tvSettingTxt}>Bölümler</Text>
          </TVFocusable>
        )}

        <TVFocusable style={styles.tvSettingBtn} focusedStyle={styles.tvSettingBtnFocused} onFocus={prolongControls} onPress={onOpenAudioMenu}>
          <Ionicons name="volume-high-outline" size={20} color="#fff" style={styles.tvSettingIcon} />
          <Text style={styles.tvSettingTxt}>Ses ve Dil</Text>
        </TVFocusable>

        <TVFocusable style={styles.tvSettingBtn} focusedStyle={styles.tvSettingBtnFocused} onFocus={prolongControls} onPress={onOpenSubtitleMenu}>
          <Ionicons name="chatbubbles-outline" size={20} color="#fff" style={styles.tvSettingIcon} />
          <Text style={styles.tvSettingTxt}>Altyazı</Text>
        </TVFocusable>

        {onOpenQualityMenu && (
          <TVFocusable style={styles.tvSettingBtn} focusedStyle={styles.tvSettingBtnFocused} onFocus={prolongControls} onPress={onOpenQualityMenu}>
            <Ionicons name="options-outline" size={20} color="#fff" style={styles.tvSettingIcon} />
            <Text style={styles.tvSettingTxt}>{selectedQuality === 'auto' || !selectedQuality ? 'Kalite' : selectedQuality.toUpperCase()}</Text>
          </TVFocusable>
        )}

        <TVFocusable style={styles.tvIconBtn} focusedStyle={styles.tvSettingBtnFocused} onFocus={prolongControls} onPress={onCycleSpeed} accessibilityLabel="Oynatma hızı">
          <Text style={styles.tvSpeedTxt}>{playbackRate}x</Text>
        </TVFocusable>

        <TVFocusable style={styles.tvIconBtn} focusedStyle={styles.tvSettingBtnFocused} onFocus={prolongControls} onPress={onToggleContentFit} accessibilityLabel="Ekrana sığdır">
          <Ionicons name="expand-outline" size={22} color="#fff" />
        </TVFocusable>
      </View>
      <Text style={styles.tvEndTimeTxt}>Bitiş: {endTime}</Text>
    </View>
  );

  const content = (
    <>
      <ProgressBar
        currentTime={currentTime}
        duration={duration}
        panHandlers={panHandlers}
        onLayout={onProgressLayout || onLayout}
        formatTime={formatTime}
        isSeeking={isSeeking}
        seekPreviewTime={seekPreviewTime}
        previewThumbnail={previewThumbnail}
      />
      {isTV ? renderTVControls() : renderMobileControls()}
    </>
  );

  if (isTV) {
    return (
      <LinearGradient
        colors={['transparent', 'rgba(11, 11, 15, 0.45)', 'rgba(11, 11, 15, 0.88)', '#0B0B0F']}
        style={[styles.bottomSection, styles.bottomSectionTV, { paddingBottom: bottomPadding }]}
        pointerEvents="box-none"
      >
        {content}
      </LinearGradient>
    );
  }

  return (
    <View style={[styles.bottomSection, { paddingBottom: bottomPadding }]} pointerEvents="box-none">
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  bottomSection: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 24,
    paddingHorizontal: 24,
    zIndex: 10,
    minHeight: 110,
  },
  bottomSectionTV: {
    minHeight: 220,
    paddingBottom: 36,
    paddingHorizontal: 48,
    justifyContent: 'flex-end',
  },
  /* Mobile Styles */
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  centerControls: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  rightControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  mBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#e50914',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mBtnTxt: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  ctrlBtn: {
    padding: 6,
  },
  speedBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  speedBtnTxt: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  qualityBtn: {
    padding: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qualityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 7,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  qualityBadgeTxt: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  endTimeTxt: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '500',
  },
  /* TV Styles */
  tvControlsContainer: {
    marginTop: 10,
    alignItems: 'center',
    width: '100%',
  },
  tvActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    width: '100%',
  },
  tvCtrlBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.12)',
    gap: 6,
  },
  tvCtrlBtnFocused: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderWidth: 2,
    borderColor: '#E50914',
    transform: [{ scale: 1.08 }],
  },
  tvCtrlBtnTxt: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  tvPlayBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#E50914',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#E50914',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  tvPlayBtnFocused: {
    backgroundColor: '#ff1f2d',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    transform: [{ scale: 1.12 }],
    elevation: 14,
  },
  tvSettingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    paddingHorizontal: 16,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  tvIconBtn: {
    minWidth: 52,
    height: 52,
    paddingHorizontal: 10,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tvSettingBtnFocused: {
    backgroundColor: 'rgba(229, 9, 20, 0.25)',
    borderWidth: 2,
    borderColor: '#E50914',
    transform: [{ scale: 1.06 }],
  },
  tvSettingIcon: {
    marginRight: 6,
  },
  tvSettingTxt: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  tvSpeedTxt: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  tvEndTimeTxt: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 12,
  },
});
