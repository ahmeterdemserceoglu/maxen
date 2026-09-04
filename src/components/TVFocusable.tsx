import React, { useState, useEffect, useRef } from 'react';
import {
  Platform,
  Pressable,
  Animated,
  Easing,
  StyleSheet,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import { reportUserActivity } from '@/utils/userActivity';

export type TVFocusableProps = {
  children: React.ReactNode | ((state: { focused: boolean; pressed: boolean }) => React.ReactNode);
  onPress?: (event?: GestureResponderEvent | any) => void;
  onFocus?: (event?: any) => void;
  onBlur?: (event?: any) => void;
  style?: StyleProp<ViewStyle> | ((state: { focused: boolean; pressed?: boolean }) => StyleProp<ViewStyle>);
  focusedStyle?: ViewStyle;
  disabled?: boolean;
  hasTVPreferredFocus?: boolean;
  nextFocusDown?: number;
  nextFocusUp?: number;
  nextFocusLeft?: number;
  nextFocusRight?: number;
  accessibilityLabel?: string;
  accessibilityRole?: any;
  accessibilityHint?: string;
  testID?: string;
};

export const TVFocusable = React.forwardRef<any, TVFocusableProps>(({
  children,
  onPress,
  onFocus,
  onBlur,
  style,
  focusedStyle,
  disabled = false,
  hasTVPreferredFocus,
  nextFocusDown,
  nextFocusUp,
  nextFocusLeft,
  nextFocusRight,
  accessibilityLabel,
  accessibilityRole = 'button',
  accessibilityHint,
  testID,
}: TVFocusableProps, ref: any) => {
  const [isFocused, setIsFocused] = useState(false);
  const theme = useTheme();

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const activeFocused = !disabled && isFocused;

  // TV 60fps Native Driver hardware-accelerated smooth zoom transition
  useEffect(() => {
    if (!Platform.isTV) return;
    Animated.timing(scaleAnim, {
      toValue: activeFocused ? 1.06 : 1.0,
      duration: activeFocused ? 120 : 90,
      easing: activeFocused ? Easing.out(Easing.cubic) : Easing.inOut(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [activeFocused, scaleAnim]);

  // Reset focus state if component becomes disabled
  useEffect(() => {
    if (disabled && isFocused) {
      setIsFocused(false);
    }
  }, [disabled, isFocused]);

  const handleFocus = (e?: any) => {
    if (disabled) return;
    if (e && typeof e.stopPropagation === 'function') {
      e.stopPropagation();
    }
    reportUserActivity();
    setIsFocused(true);
    if (onFocus) onFocus(e);
  };

  const handleBlur = (e?: any) => {
    if (e && typeof e.stopPropagation === 'function') {
      e.stopPropagation();
    }
    setIsFocused(false);
    if (onBlur) onBlur(e);
  };

  const handlePress = (e?: any) => {
    if (disabled) return;
    // Prevent focus bubbling / event propagation to parent Pressables or overlay backdrops
    if (e && typeof e.stopPropagation === 'function') {
      e.stopPropagation();
    }
    reportUserActivity();
    if (onPress) {
      onPress(e);
    }
  };

  // TV için çok daha belirgin focus ring & scale — telefondan ve TV mesafesinden (3m) net görünür
  const defaultFocusedStyle = Platform.isTV
    ? ({
        borderColor: '#FFFFFF',
        borderWidth: 3,
        shadowColor: '#FFFFFF',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 10,
        elevation: 12,
        zIndex: 10,
      } as ViewStyle)
    : ({
        borderColor: theme.primary,
        borderWidth: 2,
        transform: [{ scale: 1.04 }],
        shadowColor: theme.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 6,
        elevation: 6,
        zIndex: 10,
      } as ViewStyle);

  const rawFocusedStyle = focusedStyle || defaultFocusedStyle;
  // On TV, animated transform is driven by the outer Animated.View at 60fps, so strip static transform
  const resolvedFocusedStyle = Platform.isTV && rawFocusedStyle
    ? { ...rawFocusedStyle, transform: undefined }
    : rawFocusedStyle;

  // Cast properties to any to support platform-specific TV props smoothly without type issues
  const pressableProps: any = {
    ref,
    onPress: handlePress,
    onFocus: handleFocus,
    onBlur: handleBlur,
    disabled,
    focusable: !disabled,
    hasTVPreferredFocus: !disabled && hasTVPreferredFocus,
    nextFocusDown,
    nextFocusUp,
    nextFocusLeft,
    nextFocusRight,
    accessible: true,
    accessibilityRole,
    accessibilityLabel,
    accessibilityHint,
    accessibilityState: {
      disabled: !!disabled,
      selected: activeFocused,
    },
    testID,
  };

  const pressableElement = (
    <Pressable
      {...pressableProps}
      style={(pressableState: any) => {
        const isPressed = !disabled && pressableState?.pressed;
        const baseStyle =
          typeof style === 'function'
            ? style({ focused: activeFocused, pressed: isPressed })
            : style;

        return [
          styles.container,
          baseStyle,
          activeFocused && resolvedFocusedStyle,
          isPressed && styles.pressed,
          disabled && styles.disabled,
        ];
      }}
    >
      {(state: any) => {
        const isPressed = !disabled && state?.pressed;
        return typeof children === 'function'
          ? children({ focused: activeFocused, pressed: isPressed })
          : children;
      }}
    </Pressable>
  );

  if (Platform.isTV) {
    return (
      <Animated.View
        style={[
          { transform: [{ scale: scaleAnim }] },
          activeFocused && { zIndex: 20 },
        ]}
        pointerEvents="box-none"
      >
        {pressableElement}
      </Animated.View>
    );
  }

  return pressableElement;
});

TVFocusable.displayName = 'TVFocusable';

const styles = StyleSheet.create({
  container: {
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
    overflow: 'hidden',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  pressed: {
    opacity: 0.75,
  },
  disabled: {
    opacity: 0.5,
    ...(Platform.OS === 'web' ? ({ cursor: 'not-allowed' } as any) : {}),
  },
});

