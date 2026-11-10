import { Alert, Linking } from 'react-native';

export function mapsDirectionsUrl(latitude: number, longitude: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
}

export function openDirections(latitude: number, longitude: number): void {
  Linking.openURL(mapsDirectionsUrl(latitude, longitude)).catch(() => {
    Alert.alert('Maps', 'Could not open directions.');
  });
}

export function openPhoneCall(phone: string): void {
  const dial = phone.replace(/[^\d+]/g, '');
  if (!dial) {
    Alert.alert('Call', 'No phone number available.');
    return;
  }
  Linking.openURL(`tel:${dial}`).catch(() => {
    Alert.alert('Call', 'Could not start a call from this device.');
  });
}
