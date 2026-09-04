import { Text, type TextProps, StyleSheet } from 'react-native';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?: 'default' | 'title' | 'subtitle' | 'details' | 'bold' | 'primary';
};

export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = 'default',
  ...rest
}: ThemedTextProps) {
  const theme = useTheme();

  let textColor = theme.text;
  if (type === 'details') {
    textColor = theme.textMuted;
  } else if (type === 'primary') {
    textColor = theme.primary;
  }

  return (
    <Text
      style={[
        { color: textColor },
        type === 'default' && styles.default,
        type === 'title' && styles.title,
        type === 'subtitle' && styles.subtitle,
        type === 'details' && styles.details,
        type === 'bold' && styles.bold,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  default: {
    fontSize: 16,
    lineHeight: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    lineHeight: 32,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: 'bold',
    lineHeight: 28,
  },
  details: {
    fontSize: 14,
    lineHeight: 20,
  },
  bold: {
    fontSize: 16,
    fontWeight: 'bold',
    lineHeight: 24,
  },
});
