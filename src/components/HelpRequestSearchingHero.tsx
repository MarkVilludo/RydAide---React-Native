import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import type { HelpRequest } from '../api/helpRequests';
import { formatElapsedSeconds } from '../utils/formatElapsed';

type Props = {
  startedAt: string;
  expiresAt?: string | null;
  isExtended?: boolean;
  progress?: NonNullable<HelpRequest['search_progress']> | null;
};

function formatDecisionWindow(seconds: number): string {
  const s = Math.max(1, Math.round(seconds));
  if (s < 60) return `${s} sec`;
  const minutes = Math.round(s / 60);
  return minutes === 1 ? '1 minute' : `${minutes} minutes`;
}

function PulseRings() {
  const rings = useRef([new Animated.Value(0), new Animated.Value(0), new Animated.Value(0)]).current;

  useEffect(() => {
    const animations = rings.map((value, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 450),
          Animated.timing(value, {
            toValue: 1,
            duration: 1800,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(value, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      ),
    );
    animations.forEach((a) => a.start());
    return () => animations.forEach((a) => a.stop());
  }, [rings]);

  return (
    <View style={ringStyles.wrap} pointerEvents="none">
      {rings.map((value, i) => {
        const scale = value.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1.3] });
        const opacity = value.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0, 0.5, 0] });
        return (
          <Animated.View key={i} style={[ringStyles.ring, { transform: [{ scale }], opacity }]} />
        );
      })}
      <View style={ringStyles.dotOuter}>
        <View style={ringStyles.dotInner} />
      </View>
    </View>
  );
}

const ringStyles = StyleSheet.create({
  wrap: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  ring: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#0284c7',
  },
  dotOuter: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(2, 132, 199, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotInner: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#0284c7' },
});

type ExplainSlide = {
  key: string;
  eyebrow: string;
  line: string;
};

/** Compact single-viewport searching panel with rotating animated explanation. */
export function HelpRequestSearchingHero({ startedAt, expiresAt, isExtended, progress }: Props) {
  const [elapsed, setElapsed] = useState(0);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [slideIndex, setSlideIndex] = useState(0);
  const fade = useRef(new Animated.Value(0)).current;
  const slideOpacity = useRef(new Animated.Value(1)).current;
  const slideY = useRef(new Animated.Value(0)).current;

  const decisionSeconds = progress?.accept_timeout_seconds ?? 300;
  const decisionWindow = formatDecisionWindow(decisionSeconds);

  const slides = useMemo<ExplainSlide[]>(
    () => [
      {
        key: 'notify',
        eyebrow: 'Step 1',
        line: 'We notify verified mechanics near your pin.',
      },
      {
        key: 'decide',
        eyebrow: 'Mechanic reply window',
        line: `Each notified mechanic has ${decisionWindow} to accept or decline.`,
      },
      {
        key: 'widen',
        eyebrow: 'Step 3',
        line: 'If nobody accepts, we automatically widen the search.',
      },
      {
        key: 'owner',
        eyebrow: isExtended ? 'Extended cutoff' : 'Your request timer',
        line: isExtended
          ? 'Extra time added — still waiting for a mechanic to accept.'
          : 'The big countdown is how long we keep searching overall.',
      },
    ],
    [decisionWindow, isExtended],
  );

  const active = slides[slideIndex] ?? slides[0]!;
  const transitioning = useRef(false);
  const [autoToken, setAutoToken] = useState(0);

  const goToSlide = useCallback(
    (nextIndex: number, direction: 1 | -1 = 1) => {
      if (transitioning.current || slides.length === 0) return;
      const normalized = ((nextIndex % slides.length) + slides.length) % slides.length;
      if (normalized === slideIndex) return;

      transitioning.current = true;
      Animated.parallel([
        Animated.timing(slideOpacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(slideY, {
          toValue: direction > 0 ? -8 : 8,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (!finished) {
          transitioning.current = false;
          return;
        }
        setSlideIndex(normalized);
        slideY.setValue(direction > 0 ? 10 : -10);
        Animated.parallel([
          Animated.timing(slideOpacity, {
            toValue: 1,
            duration: 240,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(slideY, {
            toValue: 0,
            duration: 240,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]).start(() => {
          transitioning.current = false;
        });
      });
    },
    [slideIndex, slideOpacity, slideY, slides.length],
  );

  const goPrev = useCallback(() => {
    setAutoToken((t) => t + 1);
    goToSlide(slideIndex - 1, -1);
  }, [goToSlide, slideIndex]);

  const goNext = useCallback(() => {
    setAutoToken((t) => t + 1);
    goToSlide(slideIndex + 1, 1);
  }, [goToSlide, slideIndex]);

  useEffect(() => {
    Animated.timing(fade, {
      toValue: 1,
      duration: 350,
      useNativeDriver: true,
    }).start();
  }, [fade]);

  useEffect(() => {
    setElapsed(0);
    setRemaining(null);
    const startMs = new Date(startedAt).getTime();
    const expiresMs = expiresAt ? new Date(expiresAt).getTime() : NaN;
    const tick = () => {
      if (Number.isNaN(startMs)) setElapsed(0);
      else setElapsed(Math.floor((Date.now() - startMs) / 1000));
      if (!Number.isNaN(expiresMs)) {
        setRemaining(Math.max(0, Math.floor((expiresMs - Date.now()) / 1000)));
      } else {
        setRemaining(null);
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt, expiresAt]);

  useEffect(() => {
    const id = setInterval(() => {
      goToSlide(slideIndex + 1, 1);
    }, 3000);
    return () => clearInterval(id);
  }, [autoToken, goToSlide, slideIndex]);

  const notified = progress?.mechanics_notified_total ?? 0;
  const awaiting = progress?.mechanics_awaiting_response ?? 0;
  const radiusKm = progress?.search_radius_km_max;

  return (
    <Animated.View style={[styles.card, { opacity: fade }]}>
      <View style={styles.topRow}>
        <PulseRings />
        <View style={styles.timerCol}>
          <Text style={styles.title}>{isExtended ? 'Extended search' : 'Finding help'}</Text>
          <Text style={styles.timerLabel}>
            {remaining != null ? 'Request open for' : 'Searching for'}
          </Text>
          <Text style={styles.timer}>
            {formatElapsedSeconds(remaining != null ? remaining : elapsed)}
          </Text>
        </View>
        <View style={styles.replyChip}>
          <Text style={styles.replyChipLabel}>They decide in</Text>
          <Text style={styles.replyChipValue}>{decisionWindow}</Text>
        </View>
      </View>

      <Text style={styles.statusLine} numberOfLines={1}>
        {progress
          ? `${radiusKm != null ? `Up to ${radiusKm} km` : 'Searching'}${notified > 0 ? ` · ${notified} notified` : ''}${awaiting > 0 ? ` · ${awaiting} deciding` : ''}`
          : 'Contacting mechanics near you…'}
      </Text>

      {progress ? (
        <View style={styles.track}>
          <View
            style={[
              styles.fill,
              {
                width: `${Math.min(
                  100,
                  Math.max(0, Number(progress.progress_percent) || 0),
                )}%`,
              },
            ]}
          />
        </View>
      ) : null}

      <View style={styles.explainBox}>
        <View style={styles.explainHeader}>
          <Text style={styles.explainHeading}>How it works</Text>
          <Text style={styles.explainCount}>
            {slideIndex + 1}/{slides.length}
          </Text>
        </View>

        <View style={styles.explainRow}>
          <Pressable
            onPress={goPrev}
            style={({ pressed }) => [styles.navBtn, pressed && styles.navBtnPressed]}
            accessibilityRole="button"
            accessibilityLabel="Previous tip"
            hitSlop={8}
          >
            <Text style={styles.navIcon}>‹</Text>
          </Pressable>

          <Animated.View
            style={[
              styles.explainSlide,
              { opacity: slideOpacity, transform: [{ translateY: slideY }] },
            ]}
          >
            <Text style={styles.explainEyebrow}>{active.eyebrow}</Text>
            <Text style={styles.explainLine} numberOfLines={2}>
              {active.line}
            </Text>
          </Animated.View>

          <Pressable
            onPress={goNext}
            style={({ pressed }) => [styles.navBtn, pressed && styles.navBtnPressed]}
            accessibilityRole="button"
            accessibilityLabel="Next tip"
            hitSlop={8}
          >
            <Text style={styles.navIcon}>›</Text>
          </Pressable>
        </View>

        <View style={styles.dots}>
          {slides.map((slide, index) => (
            <Pressable
              key={slide.key}
              onPress={() => {
                setAutoToken((t) => t + 1);
                goToSlide(index, index >= slideIndex ? 1 : -1);
              }}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={`Show tip ${index + 1}`}
            >
              <View style={[styles.dot, index === slideIndex && styles.dotActive]} />
            </Pressable>
          ))}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: '#f0f9ff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  timerCol: { flex: 1, minWidth: 0 },
  title: { fontSize: 15, fontWeight: '800', color: '#0c4a6e' },
  timerLabel: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '600',
    color: '#0369a1',
  },
  timer: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0284c7',
    fontVariant: ['tabular-nums'],
    lineHeight: 32,
  },
  replyChip: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: 'center',
    maxWidth: 110,
  },
  replyChipLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#b45309',
    textTransform: 'uppercase',
  },
  replyChipValue: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: '800',
    color: '#92400e',
    textAlign: 'center',
  },
  statusLine: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  track: {
    marginTop: 8,
    height: 5,
    backgroundColor: '#e0f2fe',
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: { height: '100%', backgroundColor: '#0284c7', borderRadius: 3 },
  explainBox: {
    marginTop: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0f2fe',
    paddingHorizontal: 8,
    paddingTop: 10,
    paddingBottom: 8,
    minHeight: 92,
  },
  explainHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  explainHeading: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0369a1',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  explainCount: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
  },
  explainRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  navBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#e0f2fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnPressed: { backgroundColor: '#bae6fd' },
  navIcon: {
    fontSize: 26,
    fontWeight: '700',
    color: '#0284c7',
    lineHeight: 28,
    marginTop: -1,
  },
  explainSlide: { flex: 1, minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  explainEyebrow: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0284c7',
  },
  explainLine: {
    marginTop: 2,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '600',
    color: '#0f172a',
  },
  dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 8 },
  dot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#bae6fd' },
  dotActive: { backgroundColor: '#0284c7', width: 14 },
});
