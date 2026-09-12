import React from 'react';
import { Platform, StyleSheet, TouchableOpacity, type TouchableOpacityProps } from 'react-native';
import { TVFocusable } from './TVFocusable';

/** Keep the phone control unchanged while giving TV remotes a visible focus target. */
export const TVTouchable = React.forwardRef<any, TouchableOpacityProps>((props, ref) => {
  if (!Platform.isTV) return <TouchableOpacity ref={ref} {...props} />;
  const { flex, flexGrow, flexShrink, alignSelf, position, top, bottom, left, right,
    margin, marginTop, marginBottom, marginLeft, marginRight, marginHorizontal, marginVertical,
    ...controlStyle } = StyleSheet.flatten(props.style) || {};
  return (
    <TVFocusable
      ref={ref}
      onPress={props.onPress}
      onFocus={props.onFocus}
      onBlur={props.onBlur}
      disabled={!!props.disabled}
      hasTVPreferredFocus={props.hasTVPreferredFocus}
      nextFocusUp={props.nextFocusUp}
      nextFocusDown={props.nextFocusDown}
      nextFocusLeft={props.nextFocusLeft}
      nextFocusRight={props.nextFocusRight}
      containerStyle={{ flex, flexGrow, flexShrink, alignSelf, position, top, bottom, left, right,
        margin, marginTop, marginBottom, marginLeft, marginRight, marginHorizontal, marginVertical }}
      style={[{ minHeight: 44 }, controlStyle]}
      accessibilityLabel={props.accessibilityLabel}
      accessibilityRole={props.accessibilityRole}
      testID={props.testID}
    >{props.children}</TVFocusable>
  );
});
TVTouchable.displayName = 'TVTouchable';
