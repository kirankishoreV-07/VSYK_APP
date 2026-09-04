import { Alert, Platform, type AlertButton, type AlertOptions } from 'react-native';

let installed = false;

/**
 * React Native Web does not render native Alert dialogs. Install one adapter
 * once at the application root so validation and confirmation flows remain usable in the
 * browser while iOS and Android continue to use the native implementation.
 */
export function installWebAlertAdapter(): void {
  if (installed || Platform.OS !== 'web' || typeof window === 'undefined') return;
  installed = true;

  Alert.alert = (
    title: string,
    message?: string,
    buttons?: AlertButton[],
    _options?: AlertOptions,
  ) => {
    const content = [title, message].filter(Boolean).join('\n\n');
    const availableButtons = buttons || [];

    if (availableButtons.length <= 1) {
      window.alert(content);
      availableButtons[0]?.onPress?.();
      return;
    }

    const cancelButton = availableButtons.find((button) => button.style === 'cancel');
    const confirmButton = [...availableButtons]
      .reverse()
      .find((button) => button.style !== 'cancel');
    if (window.confirm(content)) confirmButton?.onPress?.();
    else cancelButton?.onPress?.();
  };
}
