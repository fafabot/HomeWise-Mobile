import { Alert, Platform, type AlertButton } from 'react-native';

// React Native's Alert has no web implementation. Keep confirmation actions available there.
export function showAlert(title: string, message: string, buttons?: AlertButton[]) {
  if (Platform.OS !== 'web') {
    Alert.alert(title, message, buttons);
    return;
  }

  window.alert(`${title}\n\n${message}`);
  buttons?.find(button => button.style !== 'cancel')?.onPress?.();
}
