import { Image } from 'expo-image';
import { View, StyleSheet, type ViewStyle } from 'react-native';

type AppLogoProps = {
  size?: number;
  style?: ViewStyle;
};

/** VSYK logo — consistent fit across admin & member headers. */
export function AppLogo({ size = 36, style }: AppLogoProps) {
  const pad = Math.max(2, Math.round(size * 0.08));
  return (
    <View
      style={[
        styles.wrap,
        {
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.28),
          padding: pad,
        },
        style,
      ]}
    >
      <Image
        source={require('../assets/logo.png')}
        style={styles.image}
        contentFit="contain"
        contentPosition="center"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});