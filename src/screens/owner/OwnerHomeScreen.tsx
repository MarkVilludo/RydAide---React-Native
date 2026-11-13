import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { DrawerActions, useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fetchHelpRequests, type HelpRequest } from '../../api/helpRequests';
import { useAppConfig } from '../../hooks/useAppConfig';
import { markLaunchStep } from '../../utils/launchSteps';
import type { OwnerStackParamList } from '../../navigation/types';
import { pickPrimaryOwnerLiveHelpRequest } from '../../utils/helpRequestStatus';
import { jobStatusLabelOf, vehicleTitle } from '../../utils/helpRequestUi';
import { BrandLogo } from '../../components/BrandLogo';

type Props = NativeStackScreenProps<OwnerStackParamList, 'OwnerHome'>;

const HOW_IT_WORKS = [
  {
    key: 'pin',
    icon: '📍',
    title: 'Drop your pin',
    line: 'Share location and vehicle details.',
  },
  {
    key: 'match',
    icon: '🔧',
    title: 'Match nearby',
    line: 'Verified mechanics get notified fast.',
  },
  {
    key: 'track',
    icon: '📡',
    title: 'Track live',
    line: 'Follow the request until help arrives.',
  },
] as const;

const HOW_IT_WORKS_INTERVAL_MS = 3200;

type LayoutTokens = {
  compact: boolean;
  dense: boolean;
  tall: boolean;
  padX: number;
  bodyPadTop: number;
  bodyPadBottom: number;
  logoWidth: number;
  radarSize: number;
  titleSize: number;
  howLineSize: number;
  howPadV: number;
  ctaPadV: number;
  ctaTitleSize: number;
  secondaryPadV: number;
  ctaGap: number;
  sectionGap: number;
  heroPadX: number;
  heroPadTop: number;
  heroPadBottom: number;
  heroRadius: number;
  showRadar: boolean;
};

function useOwnerHomeLayout(): LayoutTokens {
  const { width, height } = useWindowDimensions();
  const usable = Math.max(480, height);

  return useMemo(() => {
    const dense = usable < 680;
    const compact = usable < 760;
    const tall = usable >= 860;
    const padX = Math.max(12, Math.min(18, Math.round(width * 0.04)));

    return {
      compact,
      dense,
      tall,
      padX,
      bodyPadTop: dense ? 4 : 8,
      bodyPadBottom: dense ? 8 : 12,
      logoWidth: dense ? 96 : compact ? 104 : 112,
      radarSize: dense ? 72 : compact ? 88 : tall ? 120 : 100,
      titleSize: dense ? 24 : compact ? 26 : tall ? 32 : 28,
      howLineSize: dense ? 13 : 14,
      howPadV: dense ? 10 : tall ? 14 : 12,
      ctaPadV: dense ? 14 : compact ? 15 : 17,
      ctaTitleSize: dense ? 16 : 17,
      secondaryPadV: dense ? 12 : 14,
      ctaGap: dense ? 10 : 12,
      sectionGap: dense ? 14 : tall ? 22 : 18,
      heroPadX: dense ? 16 : tall ? 24 : 20,
      heroPadTop: dense ? 18 : tall ? 28 : 22,
      heroPadBottom: dense ? 16 : tall ? 22 : 18,
      heroRadius: dense ? 20 : 24,
      showRadar: usable >= 600,
    };
  }, [usable, width]);
}

function PulseRadar({ size }: { size: number }) {
  const rings = useRef([new Animated.Value(0), new Animated.Value(0), new Animated.Value(0)]).current;
  const breath = useRef(new Animated.Value(0)).current;
  const ringSize = Math.round(size * 0.9);
  const outer = Math.max(14, Math.round(size * 0.2));
  const inner = Math.max(6, Math.round(outer * 0.45));

  useEffect(() => {
    const animations = rings.map((value, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 520),
          Animated.timing(value, {
            toValue: 1,
            duration: 2000,
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

    const breathe = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(breath, {
          toValue: 0,
          duration: 1400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    breathe.start();

    return () => {
      animations.forEach((a) => a.stop());
      breathe.stop();
    };
  }, [breath, rings]);

  const coreScale = breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }} pointerEvents="none">
      {rings.map((value, i) => {
        const scale = value.interpolate({ inputRange: [0, 1], outputRange: [0.28, 1.28] });
        const opacity = value.interpolate({ inputRange: [0, 0.12, 1], outputRange: [0, 0.5, 0] });
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              width: ringSize,
              height: ringSize,
              borderRadius: ringSize / 2,
              borderWidth: 2,
              borderColor: '#38bdf8',
              transform: [{ scale }],
              opacity,
            }}
          />
        );
      })}
      <Animated.View
        style={{
          width: outer,
          height: outer,
          borderRadius: outer / 2,
          backgroundColor: 'rgba(56, 189, 248, 0.32)',
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ scale: coreScale }],
        }}
      >
        <View
          style={{
            width: inner,
            height: inner,
            borderRadius: inner / 2,
            backgroundColor: '#38bdf8',
          }}
        />
      </Animated.View>
    </View>
  );
}

function HowItWorksCarousel({
  lineSize,
  padV,
  dense,
}: {
  lineSize: number;
  padV: number;
  dense: boolean;
}) {
  const [index, setIndex] = useState(0);
  const [autoToken, setAutoToken] = useState(0);
  const opacity = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const iconScale = useRef(new Animated.Value(1)).current;
  const iconPulse = useRef(new Animated.Value(0)).current;
  const progress = useRef(new Animated.Value(0)).current;
  const transitioning = useRef(false);
  const active = HOW_IT_WORKS[index] ?? HOW_IT_WORKS[0]!;
  const iconSize = dense ? 36 : 44;

  const bumpIcon = useCallback(() => {
    iconScale.setValue(0.82);
    Animated.spring(iconScale, {
      toValue: 1,
      friction: 5,
      tension: 140,
      useNativeDriver: true,
    }).start();
  }, [iconScale]);

  const goTo = useCallback(
    (nextIndex: number, direction: 1 | -1 = 1) => {
      if (transitioning.current) return;
      const normalized = ((nextIndex % HOW_IT_WORKS.length) + HOW_IT_WORKS.length) % HOW_IT_WORKS.length;
      if (normalized === index) return;

      transitioning.current = true;
      progress.stopAnimation();
      progress.setValue(0);

      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 140, useNativeDriver: true }),
        Animated.timing(translateX, {
          toValue: direction > 0 ? -18 : 18,
          duration: 140,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (!finished) {
          transitioning.current = false;
          return;
        }
        setIndex(normalized);
        translateX.setValue(direction > 0 ? 18 : -18);
        bumpIcon();
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 1,
            duration: 260,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(translateX, {
            toValue: 0,
            duration: 260,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]).start(() => {
          transitioning.current = false;
        });
      });
    },
    [bumpIcon, index, opacity, progress, translateX],
  );

  const manualGo = useCallback(
    (nextIndex: number, direction: 1 | -1 = 1) => {
      setAutoToken((t) => t + 1);
      goTo(nextIndex, direction);
    },
    [goTo],
  );

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(iconPulse, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(iconPulse, {
          toValue: 0,
          duration: 1100,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [iconPulse]);

  useEffect(() => {
    progress.setValue(0);
    const fill = Animated.timing(progress, {
      toValue: 1,
      duration: HOW_IT_WORKS_INTERVAL_MS,
      easing: Easing.linear,
      useNativeDriver: false,
    });
    fill.start(({ finished }) => {
      if (finished) goTo(index + 1, 1);
    });
    return () => fill.stop();
  }, [autoToken, goTo, index, progress]);

  const ringScale = iconPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] });
  const ringOpacity = iconPulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] });
  const progressWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View
      style={[
        howStyles.box,
        {
          paddingTop: padV,
          paddingBottom: dense ? 8 : 10,
          paddingHorizontal: dense ? 10 : 12,
        },
      ]}
    >
      <View style={[howStyles.header, { marginBottom: dense ? 8 : 10 }]}>
        <Text style={howStyles.heading}>How it works</Text>
        <Text style={howStyles.count}>
          {index + 1}/{HOW_IT_WORKS.length}
        </Text>
      </View>

      <View style={[howStyles.stepper, { marginBottom: dense ? 8 : 12 }]}>
        {HOW_IT_WORKS.map((slide, i) => {
          const activeStep = i === index;
          const done = i < index;
          return (
            <React.Fragment key={slide.key}>
              {i > 0 ? (
                <View style={[howStyles.connector, (done || activeStep) && howStyles.connectorOn]} />
              ) : null}
              <Pressable
                onPress={() => manualGo(i, i > index ? 1 : -1)}
                style={[
                  howStyles.stepOrb,
                  dense && howStyles.stepOrbDense,
                  activeStep && howStyles.stepOrbActive,
                  done && howStyles.stepOrbDone,
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Step ${i + 1}: ${slide.title}`}
                hitSlop={6}
              >
                <Text style={[howStyles.stepOrbIcon, dense && { fontSize: 12 }]}>{slide.icon}</Text>
              </Pressable>
            </React.Fragment>
          );
        })}
      </View>

      <View style={howStyles.slideRow}>
        <Pressable
          onPress={() => manualGo(index - 1, -1)}
          style={({ pressed }) => [howStyles.navBtn, pressed && howStyles.navBtnPressed]}
          accessibilityRole="button"
          accessibilityLabel="Previous step"
          hitSlop={8}
        >
          <Text style={howStyles.navIcon}>‹</Text>
        </Pressable>

        <Animated.View
          style={[
            howStyles.slide,
            {
              minHeight: dense ? 56 : 68,
              opacity,
              transform: [{ translateX }],
            },
          ]}
        >
          <View style={{ width: iconSize, height: iconSize, alignItems: 'center', justifyContent: 'center' }}>
            <Animated.View
              pointerEvents="none"
              style={[
                howStyles.iconRing,
                {
                  width: iconSize + 10,
                  height: iconSize + 10,
                  borderRadius: (iconSize + 10) / 2,
                  opacity: ringOpacity,
                  transform: [{ scale: ringScale }],
                },
              ]}
            />
            <Animated.View
              style={[
                howStyles.iconOrb,
                {
                  width: iconSize,
                  height: iconSize,
                  borderRadius: iconSize / 2,
                  transform: [{ scale: iconScale }],
                },
              ]}
            >
              <Text style={{ fontSize: dense ? 18 : 22 }}>{active.icon}</Text>
            </Animated.View>
          </View>

          <View style={howStyles.copy}>
            <Text style={[howStyles.title, dense && { fontSize: 14 }]} numberOfLines={1}>
              {active.title}
            </Text>
            <Text
              style={[howStyles.line, { fontSize: lineSize, lineHeight: lineSize + 4 }]}
              numberOfLines={2}
            >
              {active.line}
            </Text>
          </View>
        </Animated.View>

        <Pressable
          onPress={() => manualGo(index + 1, 1)}
          style={({ pressed }) => [howStyles.navBtn, pressed && howStyles.navBtnPressed]}
          accessibilityRole="button"
          accessibilityLabel="Next step"
          hitSlop={8}
        >
          <Text style={howStyles.navIcon}>›</Text>
        </Pressable>
      </View>

      <View style={howStyles.progressTrack}>
        <Animated.View style={[howStyles.progressFill, { width: progressWidth }]} />
      </View>
    </View>
  );
}

const howStyles = StyleSheet.create({
  box: {
    width: '100%',
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.22)',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heading: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  count: { color: '#64748b', fontSize: 11, fontWeight: '600' },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  connector: {
    width: 22,
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(148, 163, 184, 0.25)',
    marginHorizontal: 4,
  },
  connectorOn: { backgroundColor: 'rgba(56, 189, 248, 0.55)' },
  stepOrb: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(148, 163, 184, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepOrbDense: { width: 26, height: 26, borderRadius: 13 },
  stepOrbActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.22)',
    borderColor: '#38bdf8',
  },
  stepOrbDone: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderColor: 'rgba(56, 189, 248, 0.45)',
  },
  stepOrbIcon: { fontSize: 13 },
  slideRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  navBtn: {
    width: 28,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  navBtnPressed: { backgroundColor: 'rgba(255, 255, 255, 0.06)' },
  navIcon: { color: '#94a3b8', fontSize: 26, fontWeight: '600', lineHeight: 28 },
  slide: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconRing: {
    position: 'absolute',
    backgroundColor: '#38bdf8',
  },
  iconOrb: {
    backgroundColor: 'rgba(56, 189, 248, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1, minWidth: 0 },
  title: { color: '#f8fafc', fontSize: 15, fontWeight: '800', marginBottom: 2 },
  line: { color: '#cbd5e1', fontWeight: '500' },
  progressTrack: {
    marginTop: 10,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(148, 163, 184, 0.18)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: '#38bdf8',
  },
});

function FadeIn({
  children,
  delay = 0,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  style?: object;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(14)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 420,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 420,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [delay, opacity, translateY]);

  return (
    <Animated.View style={[{ opacity, transform: [{ translateY }] }, style]}>
      {children}
    </Animated.View>
  );
}

export function OwnerHomeScreen({ navigation }: Props) {
  const { config } = useAppConfig();
  const emergencyOn = config?.features?.emergency_assistance ?? false;
  const [activeRequest, setActiveRequest] = useState<HelpRequest | null>(null);
  const resumePrompted = useRef(false);
  const ctaPulse = useRef(new Animated.Value(1)).current;
  const hasActiveBanner = Boolean(emergencyOn && activeRequest);
  const layout = useOwnerHomeLayout();

  const openActiveRequest = useCallback(
    (request: HelpRequest) => {
      navigation.navigate('ActiveHelpRequest', { helpRequestId: request.id });
    },
    [navigation],
  );

  const promptActiveRequestBlocksNewBooking = useCallback(
    (request: HelpRequest) => {
      Alert.alert(
        'Active request in progress',
        'You already have an active help request. Finish or cancel it before booking another service.',
        [
          { text: 'OK', style: 'cancel' },
          { text: 'Open request', onPress: () => openActiveRequest(request) },
        ],
      );
    },
    [openActiveRequest],
  );

  const startNeedHelp = useCallback(
    (emergency: boolean) => {
      if (activeRequest) {
        promptActiveRequestBlocksNewBooking(activeRequest);
        return;
      }
      navigation.navigate('NeedHelp', { emergency });
    },
    [activeRequest, navigation, promptActiveRequestBlocksNewBooking],
  );

  const load = useCallback(async () => {
    try {
      const live = emergencyOn
        ? pickPrimaryOwnerLiveHelpRequest(await fetchHelpRequests())
        : null;
      setActiveRequest(live);
    } catch {
      setActiveRequest(null);
    } finally {
      markLaunchStep('dashboard');
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
    // The launch recovery may already have opened the request — don't stack a prompt on top of it.
    if (!navigation.isFocused()) return;
    Alert.alert('Help request in progress', 'Open your active request to track your mechanic?', [
      { text: 'Later', style: 'cancel' },
      { text: 'Open', onPress: () => openActiveRequest(activeRequest) },
    ]);
  }, [activeRequest, emergencyOn, navigation, openActiveRequest]);

  useEffect(() => {
    if (!emergencyOn || hasActiveBanner) {
      ctaPulse.setValue(1);
      return;
    }
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(ctaPulse, {
          toValue: 1.025,
          duration: 1100,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(ctaPulse, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [ctaPulse, emergencyOn, hasActiveBanner]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={[styles.topBar, { paddingHorizontal: layout.padX }]}>
        <Pressable
          style={styles.menuBtn}
          onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
          accessibilityRole="button"
          accessibilityLabel="Open menu"
        >
          <Text style={styles.menuIcon}>☰</Text>
        </Pressable>
        <BrandLogo width={layout.logoWidth} />
        <View style={styles.topBarSpacer} />
      </View>

      <View
        style={[
          styles.body,
          {
            paddingHorizontal: layout.padX,
            paddingBottom: layout.bodyPadBottom,
            paddingTop: layout.bodyPadTop,
          },
        ]}
      >
        {emergencyOn ? (
          <FadeIn delay={80} style={styles.heroGrow}>
            <View
              style={[
                styles.hero,
                {
                  paddingHorizontal: layout.heroPadX,
                  paddingTop: layout.heroPadTop,
                  paddingBottom: layout.heroPadBottom,
                  borderRadius: layout.heroRadius,
                },
              ]}
            >
              <View style={[styles.heroTop, { gap: layout.dense ? 8 : 12 }]}>
                {layout.showRadar ? <PulseRadar size={layout.radarSize} /> : null}
                <Text style={[styles.heroTitle, { fontSize: layout.titleSize }]}>
                  {hasActiveBanner ? 'Help in progress' : 'Need help?'}
                </Text>
              </View>

              <View style={[styles.heroMid, { marginVertical: layout.sectionGap }]}>
                {hasActiveBanner && activeRequest ? (
                  <Pressable
                    style={[styles.activeCard, { paddingVertical: layout.howPadV + 4 }]}
                    onPress={() => openActiveRequest(activeRequest)}
                    accessibilityRole="button"
                    accessibilityLabel="Open active help request"
                  >
                    <View style={styles.activeCardHeader}>
                      <View style={styles.activeLiveDot} />
                      <Text style={styles.activeCardEyebrow}>Active request</Text>
                    </View>
                    <Text style={styles.activeCardVehicle} numberOfLines={1}>
                      {vehicleTitle(activeRequest)}
                    </Text>
                    <Text style={styles.activeCardStatus} numberOfLines={1}>
                      {jobStatusLabelOf(activeRequest)}
                    </Text>
                  </Pressable>
                ) : (
                  <HowItWorksCarousel
                    lineSize={layout.howLineSize}
                    padV={layout.howPadV}
                    dense={layout.dense}
                  />
                )}
              </View>

              <View style={[styles.ctaBlock, { gap: layout.ctaGap }]}>
                {!hasActiveBanner && config?.rollout.area_label && !layout.dense ? (
                  <Text style={styles.rolloutLineOnDark}>Live in {config.rollout.area_label}</Text>
                ) : null}

                {hasActiveBanner && activeRequest ? (
                  <Pressable
                    style={({ pressed }) => [
                      styles.primaryHelpCta,
                      styles.continueCta,
                      { paddingVertical: layout.ctaPadV },
                      pressed && styles.primaryHelpCtaPressed,
                    ]}
                    onPress={() => openActiveRequest(activeRequest)}
                    accessibilityRole="button"
                    accessibilityLabel="Continue active help request"
                  >
                    <Text style={[styles.primaryHelpCtaTitle, { fontSize: layout.ctaTitleSize }]}>
                      Continue request
                    </Text>
                  </Pressable>
                ) : (
                  <Animated.View style={{ transform: [{ scale: ctaPulse }] }}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.primaryHelpCta,
                        { paddingVertical: layout.ctaPadV },
                        pressed && styles.primaryHelpCtaPressed,
                      ]}
                      onPress={() => startNeedHelp(true)}
                      accessibilityRole="button"
                      accessibilityLabel="Get help now"
                    >
                      <Text style={[styles.primaryHelpCtaTitle, { fontSize: layout.ctaTitleSize }]}>
                        Get help now
                      </Text>
                    </Pressable>
                  </Animated.View>
                )}

                <Pressable
                  style={({ pressed }) => [
                    styles.secondaryHelpCta,
                    { paddingVertical: layout.secondaryPadV },
                    pressed && styles.secondaryHelpCtaPressed,
                  ]}
                  onPress={() => {
                    if (activeRequest) {
                      promptActiveRequestBlocksNewBooking(activeRequest);
                      return;
                    }
                    startNeedHelp(false);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Book a service"
                >
                  <Text style={styles.secondaryHelpCtaText}>Book a service</Text>
                </Pressable>
              </View>
            </View>
          </FadeIn>
        ) : (
          <FadeIn delay={80} style={styles.heroQuiet}>
            <View style={styles.quietInner}>
              <Text style={[styles.quietTitle, { fontSize: layout.titleSize + 2 }]}>Find nearby</Text>
              {config?.rollout.area_label ? (
                <Text style={styles.quietArea}>{config.rollout.area_label}</Text>
              ) : null}
              <View style={[styles.quietActions, { marginTop: layout.sectionGap + 8 }]}>
                <Pressable
                  style={({ pressed }) => [
                    styles.quietBtn,
                    styles.quietBtnPrimary,
                    { paddingVertical: layout.ctaPadV },
                    pressed && styles.quietBtnPressed,
                  ]}
                  onPress={() => navigation.navigate('FindMechanic')}
                  accessibilityRole="button"
                  accessibilityLabel="Find mechanics"
                >
                  <Text style={styles.quietBtnEmoji}>🔧</Text>
                  <Text style={[styles.quietBtnText, styles.quietBtnTextOnDark]}>Mechanics</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.quietBtn,
                    styles.quietBtnSecondary,
                    { paddingVertical: layout.secondaryPadV },
                    pressed && styles.quietBtnPressed,
                  ]}
                  onPress={() => navigation.navigate('FindShop')}
                  accessibilityRole="button"
                  accessibilityLabel="Find shops"
                >
                  <Text style={styles.quietBtnEmoji}>🏪</Text>
                  <Text style={styles.quietBtnText}>Shops</Text>
                </Pressable>
              </View>
            </View>
          </FadeIn>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 4,
  },
  menuBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  topBarSpacer: { width: 44 },
  menuIcon: { fontSize: 24, color: '#0f172a' },
  body: {
    flex: 1,
    minHeight: 0,
  },
  activeCard: {
    width: '100%',
    backgroundColor: 'rgba(2, 132, 199, 0.18)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.35)',
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  activeCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  activeLiveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4ade80',
  },
  activeCardEyebrow: {
    color: '#7dd3fc',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  activeCardVehicle: {
    color: '#f8fafc',
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 4,
  },
  activeCardStatus: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  heroGrow: { flex: 1, minHeight: 0 },
  hero: {
    flex: 1,
    backgroundColor: '#0f172a',
    overflow: 'hidden',
    minHeight: 0,
  },
  heroTop: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    flexShrink: 0,
    width: '100%',
  },
  heroMid: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    justifyContent: 'center',
  },
  heroQuiet: {
    flex: 1,
    minHeight: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quietInner: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  quietTitle: {
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.6,
    textAlign: 'center',
  },
  quietArea: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
    textAlign: 'center',
  },
  quietActions: {
    width: '100%',
    maxWidth: 400,
    gap: 12,
  },
  quietBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 14,
    paddingHorizontal: 18,
  },
  quietBtnPrimary: { backgroundColor: '#0284c7' },
  quietBtnSecondary: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0' },
  quietBtnPressed: { opacity: 0.9 },
  quietBtnEmoji: { fontSize: 20 },
  quietBtnText: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  quietBtnTextOnDark: { color: '#fff' },
  heroTitle: {
    color: '#f8fafc',
    fontWeight: '800',
    letterSpacing: -0.6,
    textAlign: 'center',
  },
  ctaBlock: { width: '100%', flexShrink: 0 },
  rolloutLineOnDark: {
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
    letterSpacing: 0.2,
    marginBottom: 4,
  },
  primaryHelpCta: {
    backgroundColor: '#0284c7',
    borderRadius: 14,
    paddingHorizontal: 18,
    alignItems: 'center',
  },
  continueCta: { backgroundColor: '#0ea5e9' },
  primaryHelpCtaPressed: { opacity: 0.9 },
  primaryHelpCtaTitle: { color: '#fff', fontWeight: '800' },
  secondaryHelpCta: {
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.4)',
    alignItems: 'center',
  },
  secondaryHelpCtaPressed: { backgroundColor: 'rgba(255, 255, 255, 0.06)' },
  secondaryHelpCtaText: { color: '#e0f2fe', fontWeight: '700', fontSize: 15 },
});
