import { Platform } from 'react-native';
import { api } from './client';

export async function registerPushToken(token: string, deviceLabel?: string): Promise<void> {
  await api.post('/push-tokens', {
    token,
    provider: 'expo',
    platform: Platform.OS === 'ios' ? 'ios' : 'android',
    device_label: deviceLabel,
  });
}

export async function unregisterPushToken(token: string): Promise<void> {
  await api.delete('/push-tokens', { data: { token } });
}
