import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  incomingOfferUnavailableBody,
  incomingOfferUnavailableTitle,
  type IncomingOfferUnavailable,
} from '../utils/incomingHelpOffer';

type Props = {
  kind: IncomingOfferUnavailable;
  onGoBack: () => void;
};

export function MechanicOfferUnavailableState({ kind, onGoBack }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.emoji}>{kind === 'taken' ? '🤝' : '⏱'}</Text>
      <Text style={styles.title}>{incomingOfferUnavailableTitle(kind)}</Text>
      <Text style={styles.body}>{incomingOfferUnavailableBody(kind)}</Text>
      <Pressable style={styles.btn} onPress={onGoBack}>
        <Text style={styles.btnText}>Back to incoming</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, backgroundColor: '#f8fafc' },
  emoji: { fontSize: 40, marginBottom: 12 },
  title: { fontSize: 20, fontWeight: '800', color: '#0f172a', textAlign: 'center' },
  body: { marginTop: 10, fontSize: 15, lineHeight: 22, color: '#64748b', textAlign: 'center' },
  btn: {
    marginTop: 24,
    backgroundColor: '#0284c7',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
