import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Platform } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { usePreventRemove } from '@react-navigation/native';

/**
 * Gives a nested screen one deterministic parent on every platform.
 * This prevents a directly opened/refreshed detail route from navigating to
 * login (or leaving the app) when browser or Android Back is pressed.
 */
export function useParentBack(parent: Href) {
  const router = useRouter();
  const [allowRemoval, setAllowRemoval] = useState(false);
  const parentNavigationPending = useRef(false);

  const goToParent = useCallback(() => {
    parentNavigationPending.current = true;
    setAllowRemoval(true);
  }, []);

  // Keep native-stack and JavaScript navigation state in sync. Calling
  // preventDefault directly from beforeRemove can remove the native screen
  // first and was the cause of the iOS "removed natively" red screen.
  usePreventRemove(!allowRemoval, () => {
    goToParent();
  });

  useEffect(() => {
    if (!allowRemoval || !parentNavigationPending.current) return;
    parentNavigationPending.current = false;
    router.replace(parent);
  }, [allowRemoval, parent, router]);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      goToParent();
      return true;
    });

    return () => {
      subscription.remove();
    };
  }, [goToParent]);

  return goToParent;
}
