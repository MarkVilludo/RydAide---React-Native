import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { DrawerActions } from '@react-navigation/native';
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppConfig } from '../../hooks/useAppConfig';
import type { OwnerStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<OwnerStackParamList, 'OwnerHome'>;

function PulseRadar() {
  const rings = useRef([new Animated.Value(0), new Animated.Value(0), new Animated.Value(0)]).current;

  useEffect(() => {
    const animations = rings.map((value, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 700),
          Animated.timing(value, {
            toValue: 1,
            duration: 2400,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      ),
    );
    animations.forEach((a) => a.start());
    return () => animations.forEach((a) => a.stop());
  }, [rings]);

  return (
    <View style={radarStyles.wrap} pointerEvents="none">
      {rings.map((value, i) => {
        const scale = value.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1.35] });
        const opacity = value.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.55, 0] });
        return (
          <Animated.View
            key={i}
            style={[radarStyles.ring, { transform: [{ scale }], opacity }]}
          />
        );
      })}
      <View style={radarStyles.dotOuter}>
        <View style={radarStyles.dotInner} />
      </View>
    </View>
  );
}

const radarStyles = StyleSheet.create({
  wrap: { width: 120, height: 120, alignItems: 'center', justifyContent: 'center', marginVertical: 8 },
  ring: {
    position: 'absolute',
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 2,
    borderColor: '#38bdf8',
  },
  dotOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(56, 189, 248, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#38bdf8' },
});

function FeatureChip({ icon, label }: { icon: string; label: string }) {
  return (
    <View style={chipStyles.chip}>
      <Text style={chipStyles.icon}>{icon}</Text>
      <Text style={chipStyles.label}>{label}</Text>
    </View>
  );
}

const chipStyles = StyleSheet.create({
  chip: {
    flex: 1,
    minWidth: 96,
    backgroundColor: 'rgba(15, 23, 42, 0.06)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  icon: { fontSize: 18, marginBottom: 4 },
  label: { fontSize: 11, fontWeight: '600', color: '#334155', textAlign: 'center', lineHeight: 14 },
});

function ActionCard({
  title,
  subtitle,
  emoji,
  accent,
  onPress,
  delay,
}: {
  title: string;
  subtitle: string;
  emoji: string;
  accent: string;
  onPress: () => void;
  delay: number;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 450,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 450,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [delay, opacity, translateY]);

  return (
    <Animated.View style={{ flex: 1, opacity, transform: [{ translateY }] }}>
      <Pressable
        style={({ pressed }) => [actionStyles.card, { borderLeftColor: accent }, pressed && actionStyles.cardPressed]}
        onPress={onPress}
      >
        <Text style={actionStyles.emoji}>{emoji}</Text>
        <Text style={actionStyles.title}>{title}</Text>
        <Text style={actionStyles.subtitle}>{subtitle}</Text>
      </Pressable>
    </Animated.View>
  );
}

const actionStyles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderLeftWidth: 4,
    minHeight: 118,
  },
  cardPressed: { opacity: 0.92, transform: [{ scale: 0.98 }] },
  emoji: { fontSize: 28, marginBottom: 8 },
  title: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#64748b', lineHeight: 18 },
});

export function OwnerHomeScreen({ navigation }: Props) {
  const { config } = useAppConfig();
  const heroOpacity = useRef(new Animated.Value(0)).current;
  const heroY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    heroOpacity.setValue(0);
    heroY.setValue(20);
    Animated.parallel([
      Animated.timing(heroOpacity, {
        toValue: 1,
        duration: 550,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(heroY, {
        toValue: 0,
        duration: 550,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [heroOpacity, heroY]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <Pressable
          style={styles.menuBtn}
          onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
          accessibilityRole="button"
          accessibilityLabel="Open menu"
        >
          <Text style={styles.menuIcon}>☰</Text>
        </Pressable>
        <Text style={styles.topTitle}>RydAid</Text>
        <View style={styles.menuBtnPlaceholder} />
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={[styles.hero, { opacity: heroOpacity, transform: [{ translateY: heroY }] }]}
        >
          <View style={styles.heroTopRow}>
            <View style={styles.badge}>
              <View style={styles.badgeDot} />
              <Text style={styles.badgeText}>Roadside & emergency ready</Text>
            </View>
          </View>

          <Text style={styles.heroTitle}>Help when you're stuck</Text>
          <Text style={styles.heroSub}>
            RydAid connects you to verified mechanics and repair shops near your location — for emergencies or when
            you just need someone trusted nearby.
          </Text>

          <View style={styles.heroVisualRow}>
            <PulseRadar />
            <View style={styles.heroBullets}>
              <Text style={styles.bullet}>• Share your location & vehicle details</Text>
              <Text style={styles.bullet}>• Match with providers in your search radius</Text>
              <Text style={styles.bullet}>• Or browse the directory anytime</Text>
            </View>
          </View>

          <View style={styles.chipRow}>
            <FeatureChip icon="📍" label="Near you" />
            <FeatureChip icon="✓" label="Verified" />
            <FeatureChip icon="⚡" label="Fast dispatch" />
          </View>
        </Animated.View>

        {config?.rollout.area_label ? (
          <View style={styles.rolloutBanner}>
            <Text style={styles.rolloutTitle}>Growing in {config.rollout.area_label}</Text>
            <Text style={styles.rolloutBody}>
              Search any location — results show verified providers within your chosen radius only.
            </Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Find nearby</Text>
          <View style={styles.actionRow}>
            <ActionCard
              emoji="🔧"
              title="Mechanics"
              subtitle="Mobile & on-call pros around you"
              accent="#0284c7"
              delay={280}
              onPress={() => navigation.navigate('FindMechanic')}
            />
            <ActionCard
              emoji="🏪"
              title="Shops"
              subtitle="Verified garages & service centers"
              accent="#7c3aed"
              delay={380}
              onPress={() => navigation.navigate('FindShop')}
            />
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f1f5f9' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 4,
  },
  menuBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  menuBtnPlaceholder: { width: 44 },
  menuIcon: { fontSize: 24, color: '#0f172a' },
  topTitle: { fontSize: 17, fontWeight: '700', color: '#0f172a' },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingTop: 8, paddingBottom: 32 },
  hero: {
    backgroundColor: '#0f172a',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    overflow: 'hidden',
  },
  heroTopRow: { flexDirection: 'row', marginBottom: 12 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    gap: 6,
  },
  badgeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22c55e' },
  badgeText: { color: '#e0f2fe', fontSize: 12, fontWeight: '600' },
  heroTitle: { color: '#f8fafc', fontSize: 26, fontWeight: '800', letterSpacing: -0.5, marginBottom: 8 },
  heroSub: { color: '#94a3b8', fontSize: 14, lineHeight: 21, marginBottom: 4 },
  heroVisualRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  heroBullets: { flex: 1, paddingRight: 4 },
  bullet: { color: '#cbd5e1', fontSize: 12, lineHeight: 18, marginBottom: 4 },
  chipRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  rolloutBanner: {
    backgroundColor: '#e0f2fe',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  rolloutTitle: { fontWeight: '700', color: '#0369a1', marginBottom: 4 },
  rolloutBody: { color: '#0c4a6e', fontSize: 13, lineHeight: 19 },
  section: { marginBottom: 20 },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  actionRow: { flexDirection: 'row', gap: 10 },
});
