import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Location from 'expo-location';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { getApiErrorMessage } from '../../api/client';
import { searchShops, type Shop } from '../../api/shops';
import type { OwnerStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<OwnerStackParamList, 'FindShop'>;

export function FindShopScreen(_props: Props) {
  const [loading, setLoading] = useState(false);
  const [shops, setShops] = useState<Shop[]>([]);

  const search = async () => {
    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location required');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({});
      setShops(await searchShops({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }));
    } catch (e) {
      Alert.alert('Search failed', getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.intro}>Physical shops (CMS-managed). Different from independent mobile mechanics.</Text>
      <Pressable style={styles.btn} onPress={search}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Find shops near me</Text>}
      </Pressable>
      <FlatList
        data={shops}
        keyExtractor={(s) => String(s.id)}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.meta}>
              {item.distance_km != null ? `${item.distance_km} km · ` : ''}★ {item.rating_average}
            </Text>
            <Text style={styles.meta}>{item.address}</Text>
            {item.phone && <Text style={styles.phone}>{item.phone}</Text>}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#f8fafc' },
  intro: { color: '#64748b', marginBottom: 12 },
  btn: { backgroundColor: '#0284c7', padding: 14, borderRadius: 10, alignItems: 'center', marginBottom: 16 },
  btnText: { color: '#fff', fontWeight: '600' },
  card: { backgroundColor: '#fff', padding: 14, borderRadius: 10, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  name: { fontWeight: '600', fontSize: 16 },
  meta: { color: '#64748b', marginTop: 4 },
  phone: { color: '#0284c7', marginTop: 6 },
});
