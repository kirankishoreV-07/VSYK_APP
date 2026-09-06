import type { ComponentProps } from 'react';
import { StyleSheet, Text as NativeText } from 'react-native';
import { useTranslation } from 'react-i18next';

type NativeTextProps = ComponentProps<typeof NativeText>;

function tamilFontFor(style: NativeTextProps['style']): string {
  const flattened = StyleSheet.flatten(style);
  const family = flattened?.fontFamily ?? '';
  const weight = String(flattened?.fontWeight ?? '');

  if (family.includes('700') || family.includes('Bold') || weight === '700' || weight === 'bold') {
    return 'HindMadurai_700Bold';
  }
  if (family.includes('600') || family.includes('SemiBold') || weight === '600') {
    return 'HindMadurai_600SemiBold';
  }
  if (family.includes('500') || family.includes('Medium') || weight === '500') {
    return 'HindMadurai_500Medium';
  }
  return 'HindMadurai_400Regular';
}

/** Customer-facing text that uses the bundled Tamil typeface when Tamil is active. */
export function LocalizedText({ style, ...props }: NativeTextProps) {
  const { i18n } = useTranslation();
  const isTamil = i18n.resolvedLanguage === 'ta' || i18n.language.startsWith('ta');

  return (
    <NativeText
      {...props}
      style={isTamil ? [style, { fontFamily: tamilFontFor(style) }] : style}
    />
  );
}
