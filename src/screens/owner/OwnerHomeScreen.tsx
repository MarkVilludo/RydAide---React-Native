import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { DrawerActions, useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fetchHelpRequests, type HelpRequest } from '../../api/helpRequests';
import { useAppConfig } from '../../hooks/useAppConfig';
import type { OwnerStackParamList } from '../../navigation/types';
import { pickPrimaryOwnerLiveHelpRequest } from '../../utils/helpRequestStatus';
import { jobStatusLabelOf, vehicleTitle } from '../../utils/helpRequestUi';
import { BrandLogo } from '../../components/BrandLogo';
import { RydAidRefreshControl } from '../../components/RydAidRefreshControl';

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

function FeatureChip({
  icon,
  label,
  variant = 'onDark',
}: {
  icon: string;
  label: string;
  variant?: 'onDark' | 'onLight';
}) {
  return (
    <View
      style={[
        chipStyles.chip,
        variant === 'onLight' ? chipStyles.chipOnLight : chipStyles.chipOnDark,
      ]}
    >
      <Text style={chipStyles.icon}>{icon}</Text>
      <Text style={[chipStyles.label, variant === 'onLight' && chipStyles.labelOnLight]}>{label}</Text>
    </View>
  );
}

const chipStyles = StyleSheet.create({
  chip: {
    flex: 1,
    minWidth: 96,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  chipOnDark: { backgroundColor: 'rgba(15, 23, 42, 0.35)' },
  chipOnLight: { backgroundColor: 'rgba(15, 23, 42, 0.06)' },
  icon: { fontSize: 18, marginBottom: 4 },
  label: { fontSize: 11, fontWeight: '600', color: '#cbd5e1', textAlign: 'center', lineHeight: 14 },
  labelOnLight: { color: '#334155' },
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
  const emergencyOn = config?.features.emergency_assistance ?? false;
  const [activeRequest, setActiveRequest] = useState<HelpRequest | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const resumePrompted = useRef(false);
  const heroOpacity = useRef(new Animated.Value(0)).current;
  const heroY = useRef(new Animated.Value(20)).current;

  const openActiveRequest = useCallback(
    (request: HelpRequest) => {
      navigation.navigate('ActiveHelpRequest', { helpRequestId: request.id });
    },
    [navigation],
  );

  const load = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    try {
      const live = emergencyOn
        ? pickPrimaryOwnerLiveHelpRequest(await fetchHelpRequests())
        : null;
      setActiveRequest(live);
    } catch {
      setActiveRequest(null);
    } finally {
      if (showRefresh) setRefreshing(false);
    }
  }, [emergencyOn]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useEffect(() => {
    if (!emergencyOn || !activeRequest || resumePrompted.current) return;
    resumePrompted.current = true;
    Alert.alert('Help request in progress', 'Open your active request to track your mechanic?', [
      { text: 'Later', style: 'cancel' },
      { text: 'Open', onPress: () => openActiveRequest(activeRequest) },
    ]);
  }, [activeRequest, emergencyOn, openActiveRequest]);

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
        <BrandLogo width={108} />
        <View style={styles.topBarSpacer} />
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        alwaysBounceVertical={Platform.OS === 'ios'}
        refreshControl={
          <RydAidRefreshControl refreshing={refreshing} onRefresh={() => void load(true)} title="Pull to refresh" />
        }
      >
        {emergencyOn && activeRequest ? (
          <Pressable
            style={styles.activeRow}
            onPress={() => openActiveRequest(activeRequest)}
            accessibilityRole="button"
            accessibilityLabel="Open active help request"
          >
            <Text style={styles.activeLabel} numberOfLines={2}>
              Active help · {vehicleTitle(activeRequest)} · {jobStatusLabelOf(activeRequest)}
            </Text>
            <Text style={styles.activeGo}>Open →</Text>
          </Pressable>
        ) : null}

        {!emergencyOn ? (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Find nearby</Text>
              <Text style={styles.sectionSub}>
                Browse verified mechanics and repair shops by location and search radius.
              </Text>
              <View style={styles.actionRow}>
                <ActionCard
                  emoji="🔧"
                  title="Mechanics"
                  subtitle="Mobile & on-call pros around you"
                  accent="#0284c7"
                  delay={120}
                  onPress={() => navigation.navigate('FindMechanic')}
                />
                <ActionCard
                  emoji="🏪"
                  title="Shops"
                  subtitle="Verified garages & service centers"
                  accent="#7c3aed"
                  delay={200}
                  onPress={() => navigation.navigate('FindShop')}
                />
              </View>
            </View>

            {config?.rollout.area_label ? (
              <View style={styles.rolloutBanner}>
                <Text style={styles.rolloutTitle}>Growing in {config.rollout.area_label}</Text>
                <Text style={styles.rolloutBody}>
                  Search any location — results show verified providers within your chosen radius only.
                </Text>
              </View>
            ) : null}
          </>
        ) : (
          <>
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
                Tell us where you are and what happened — we match you with verified mechanics who can respond fast.
              </Text>

              <Pressable
                style={({ pressed }) => [styles.primaryHelpCta, pressed && styles.primaryHelpCtaPressed]}
                onPress={() => navigation.navigate('NeedHelp', { emergency: true })}
                accessibilityRole="button"
                accessibilityLabel="Get help now"
              >
                <Text style={styles.primaryHelpCtaTitle}>Get help now</Text>
                <Text style={styles.primaryHelpCtaSub}>Roadside & emergency dispatch to mechanics near you</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [styles.secondaryHelpCta, pressed && styles.secondaryHelpCtaPressed]}
                onPress={() => navigation.navigate('NeedHelp', { emergency: false })}
                accessibilityRole="button"
                accessibilityLabel="Book a service"
              >
                <Text style={styles.secondaryHelpCtaText}>Book a service</Text>
              </Pressable>

              <View style={styles.heroVisualRow}>
                <PulseRadar />
                <View style={styles.heroBullets}>
                  <Text style={styles.bullet}>• Share your location & vehicle details</Text>
                  <Text style={styles.bullet}>• Match with providers in your search radius</Text>
                  <Text style={styles.bullet}>• Track your request in the app</Text>
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
              <Text style={styles.sectionLabel}>Or browse the directory</Text>
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
          </>
        )}

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
  topBarSpacer: { width: 44 },
  menuBtnPlaceholder: { width: 44 },
  menuIcon: { fontSize: 24, color: '#0f172a' },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingTop: 8, paddingBottom: 32 },
  sectionSub: { fontSize: 14, color: '#64748b', lineHeight: 20, marginBottom: 12, marginTop: -4 },
  primaryHelpCta: {
    marginTop: 16,
    backgroundColor: '#0284c7',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  primaryHelpCtaPressed: { opacity: 0.92 },
  primaryHelpCtaTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  primaryHelpCtaSub: { color: '#e0f2fe', fontSize: 13, marginTop: 6, lineHeight: 18 },
  secondaryHelpCta: {
    marginTop: 10,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.45)',
    alignItems: 'center',
  },
  secondaryHelpCtaPressed: { backgroundColor: 'rgba(255, 255, 255, 0.06)' },
  secondaryHelpCtaText: { color: '#e0f2fe', fontWeight: '700', fontSize: 15 },
  activeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0284c7',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 16,
    gap: 10,
  },
  activeLabel: { flex: 1, color: '#fff', fontWeight: '600', fontSize: 14, lineHeight: 19 },
  activeGo: { color: '#e0f2fe', fontWeight: '800', fontSize: 14 },
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
