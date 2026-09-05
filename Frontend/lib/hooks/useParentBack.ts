import { useCallback, useEffect, useRef } from 'react';
import { BackHandler, Platform } from 'react-native';
import { useNavigation, useRouter, type Href } from 'expo-router';

/**
 * Gives a nested screen one deterministic parent on every platform.
 * This prevents a directly opened/refreshed detail route from navigating to
 * login (or leaving the app) when browser or Android Back is pressed.
 */
export function useParentBack(parent: Href) {
  const router = useRouter();
  const navigation = useNavigation();
  const allowParentNavigation = useRef(false);

  const goToParent = useCallback(() => {
    allowParentNavigation.current = true;
    router.replace(parent);
  }, [parent, router]);

  useEffect(() => {
    const unsubscribeNavigation = navigation.addListener('beforeRemove', (event: any) => {
      if (allowParentNavigation.current) return;
      event.preventDefault();
      goToParent();
    });

    if (Platform.OS === 'web') return unsubscribeNavigation;

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      goToParent();
      return true;
    });

    return () => {
      unsubscribeNavigation();
      subscription.remove();
    };
  }, [goToParent, navigation]);

  return goToParent;
}
