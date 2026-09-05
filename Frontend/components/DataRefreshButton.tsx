import { ActivityIndicator, StyleSheet, TouchableOpacity } from 'react-native';
import Svg, { Path } from 'react-native-svg';

interface DataRefreshButtonProps {
  refreshing?: boolean;
  onPress: () => void;
  color?: string;
  accessibilityLabel?: string;
}

/** Compact explicit refresh action for data views whose inner component owns
 * scrolling and therefore cannot safely host a parent RefreshControl. */
export function DataRefreshButton({
  refreshing = false,
  onPress,
  color = '#005E7D',
  accessibilityLabel = 'Refresh page data',
}: DataRefreshButtonProps) {
  return (
    <TouchableOpacity
      style={styles.button}
      onPress={onPress}
      disabled={refreshing}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      {refreshing ? (
        <ActivityIndicator size="small" color={color} />
      ) : (
        <Svg width={21} height={21} viewBox="0 0 24 24" fill={color}>
          <Path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.09 0-7.19 3.72-6.39 7.69L3.56 9.64A8 8 0 1 1 4 15h2.09A6 6 0 1 0 12 6c-1.66 0-3.14.69-4.22 1.78L11 11H3V3l3.35 3.35A7.94 7.94 0 0 1 12 4c2.21 0 4.21.9 5.65 2.35z" />
        </Svg>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F9FF',
  },
});
