import React, { useState } from 'react';
import { Platform, TextInput, Switch, Text, type TextInputProps, type SwitchProps, StyleSheet } from 'react-native';
import { TVFocusable } from './TVFocusable';

export const TVTextInput = React.forwardRef<TextInput, TextInputProps>((props, ref) => {
  const [focused, setFocused] = useState(false);
  if (!Platform.isTV) return <TextInput ref={ref} {...props} />;
  return <TextInput {...props} ref={ref} autoFocus={false}
    style={[props.style, { minHeight: 48, fontSize: 18, borderWidth: 2, borderColor: focused ? '#FFFFFF' : '#555555' }]}
    onFocus={event => { setFocused(true); props.onFocus?.(event); }}
    onBlur={event => { setFocused(false); props.onBlur?.(event); }} />;
});
TVTextInput.displayName = 'TVTextInput';

export function TVSwitch(props: SwitchProps) {
  if (!Platform.isTV) return <Switch {...props} />;
  return <TVFocusable style={s.toggle} disabled={props.disabled} accessibilityLabel={props.accessibilityLabel || 'Aç / kapat'} onPress={() => props.onValueChange?.(!props.value)}>
    <Text style={s.text}>{props.value ? 'Açık ✓' : 'Kapalı'}</Text>
  </TVFocusable>;
}
const s = StyleSheet.create({ toggle: { minHeight: 48, paddingHorizontal: 16, justifyContent: 'center', backgroundColor: '#262626' }, text: { color: '#fff', fontSize: 17 } });
