import type { Href } from 'expo-router';
import { useParentBack } from '../useParentBack';

/** Keep browser and Android back aligned with a nested admin screen's parent. */
export function useAdminParentBack(parent: Href) {
  return useParentBack(parent);
}
