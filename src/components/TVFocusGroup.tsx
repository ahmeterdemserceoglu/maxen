import React from 'react';
import { Platform, TVFocusGuideView, View, type ViewProps } from 'react-native';

type Props = ViewProps & {
  trapFocusUp?: boolean;
  trapFocusDown?: boolean;
  trapFocusLeft?: boolean;
  trapFocusRight?: boolean;
};

/** Native TV navigation remembers the last child; phones/web keep a plain View. */
export function TVFocusGroup({ children, trapFocusUp, trapFocusDown, trapFocusLeft, trapFocusRight, ...props }: Props) {
  if (!Platform.isTV) return <View {...props}>{children}</View>;
  return (
    <TVFocusGuideView {...props} autoFocus
      trapFocusUp={trapFocusUp} trapFocusDown={trapFocusDown}
      trapFocusLeft={trapFocusLeft} trapFocusRight={trapFocusRight}>
      {children}
    </TVFocusGuideView>
  );
}
