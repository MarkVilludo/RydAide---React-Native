import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { DrawerActions, useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  type AppStateStatus,
  Animated,
  Easing,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fetchEntitlements } from '../../api/auth';
import { fetchMechanicSubscription, type MechanicSubscriptionDetails } from '../../api/mechanicSubscription';
import type { HelpRequest } from '../../api/helpRequests';
import { fetchMechanicHelpQueues } from '../../api/mechanicHelp';
import {
  fetchMyMechanicProfile,
  updateMechanicAvailability,
  updateMechanicProfileLocation,
} from '../../api/mechanicProfile';
import {
  MechanicDashboardLocationCard,
  type SavedWorkLocation,
} from '../../components/MechanicDashboardLocationCard';
import type { Entitlements } from '../../api/types';
import type { MechanicIdentityVerification } from '../../api/mechanics';
import { RydAidRefreshControl } from '../../components/RydAidRefreshControl';
import { useAuth } from '../../context/AuthContext';
import { useMechanicLiveLocation } from '../../context/MechanicLocationContext';
import { mechanicQueueFetchCoords, useServicePinMaxOffsetKm } from '../../hooks/useMechanicDistanceOrigin';
import { useAppConfig } from '../../hooks/useAppConfig';
import type { MechanicStackParamList } from '../../navigation/types';
import { colors as C } from '../../theme/colors';
import { formatTimeAgo } from '../../utils/formatTimeAgo';
import { jobStatusLabelOf, vehicleTitle } from '../../utils/helpRequestUi';
import { reverseGeocodeLine } from '../../utils/reverseGeocode';

type Props = NativeStackScreenProps<MechanicStackParamList, 'MechanicHome'>;

type RequestTab = 'incoming' | 'accepted_active' | 'in_progress' | 'completed';

const GUIDE_STEPS = [
  { key: 'online', title: 'Go online', hint: 'Match nearby owners' },
  { key: 'accept', title: 'Accept', hint: 'Grab an incoming job' },
  { key: 'complete', title: 'Finish', hint: 'Arrive, repair, close' },
] as const;

const GUIDE_INTERVAL_MS = 3400;

function pickPrimaryActiveJob(queues: Awaited<ReturnType<typeof fetchMechanicHelpQueues>>): HelpRequest | null {
  const active = [...queues.accepted_active, ...queues.in_progress];
  return active[0] ?? null;
}

function greetingFor(date: Date): string {
  const h = date.getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

type ChipTone = 'live' | 'off' | 'warn' | 'danger' | 'busy';

/** Status chip: colored dot + text, so the state never relies on color alone. */
function StatusChip({ label, tone }: { label: string; tone: ChipTone }) {
  return (
    <View
      style={[
        styles.chip,
        tone === 'live' && styles.chipLive,
        tone === 'warn' && styles.chipWarn,
        tone === 'danger' && styles.chipDanger,
        tone === 'busy' && styles.chipBusy,
      ]}
    >
      <View
        style={[
          styles.chipDot,
          tone === 'live' && styles.chipDotLive,
          tone === 'warn' && styles.chipDotWarn,
          tone === 'danger' && styles.chipDotDanger,
          tone === 'busy' && styles.chipDotBusy,
        ]}
      />
      <Text
        style={[
          styles.chipText,
          tone === 'live' && styles.chipTextLive,
          tone === 'warn' && styles.chipTextWarn,
          tone === 'danger' && styles.chipTextDanger,
          tone === 'busy' && styles.chipTextBusy,
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

function firstName(fullName: string | undefined): string {
  if (!fullName?.trim()) return 'there';
  return fullName.trim().split(/\s+/)[0] ?? 'there';
}

function PulseLive() {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.55, duration: 900, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [scale]);
  return (
    <View style={styles.pulseWrap}>
      <Animated.View style={[styles.pulseRing, { transform: [{ scale }] }]} />
      <View style={[styles.dot, styles.dotOn]} />
    </View>
  );
}

function IconOnline({ active }: { active: boolean }) {
  const ring = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!active) {
      ring.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(ring, {
          toValue: 1,
          duration: 1300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(ring, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, ring]);

  const scale = ring.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.4] });
  const opacity = ring.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.5, 0] });

  return (
    <View style={iconStyles.canvas}>
      <Animated.View
        style={[
          iconStyles.signalRing,
          active && { transform: [{ scale }], opacity },
          !active && iconStyles.signalRingIdle,
        ]}
      />
      <View style={[iconStyles.signalCore, active && iconStyles.signalCoreOn]} />
    </View>
  );
}

function IconAccept({ active }: { active: boolean }) {
  const bounce = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!active) {
      bounce.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, {
          toValue: 1,
          duration: 500,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(bounce, {
          toValue: 0,
          duration: 500,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, bounce]);

  const y = bounce.interpolate({ inputRange: [0, 1], outputRange: [0, -3] });

  return (
    <View style={iconStyles.canvas}>
      <View style={[iconStyles.tray, active && iconStyles.trayOn]} />
      <Animated.View
        style={[iconStyles.slip, active && iconStyles.slipOn, { transform: [{ translateY: y }] }]}
      />
    </View>
  );
}

function IconComplete({ active }: { active: boolean }) {
  const draw = useRef(new Animated.Value(active ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(draw, {
      toValue: active ? 1 : 0.4,
      friction: 6,
      tension: 120,
      useNativeDriver: true,
    }).start();
  }, [active, draw]);

  const scale = draw.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] });

  return (
    <View style={iconStyles.canvas}>
      <Animated.View
        style={[
          iconStyles.checkCircle,
          active && iconStyles.checkCircleOn,
          { transform: [{ scale }] },
        ]}
      >
        <View style={[iconStyles.checkStem, active && iconStyles.checkStemOn]} />
        <View style={[iconStyles.checkArm, active && iconStyles.checkArmOn]} />
      </Animated.View>
    </View>
  );
}

function GuideIcon({ stepKey, active }: { stepKey: (typeof GUIDE_STEPS)[number]['key']; active: boolean }) {
  if (stepKey === 'online') return <IconOnline active={active} />;
  if (stepKey === 'accept') return <IconAccept active={active} />;
  return <IconComplete active={active} />;
}

function MechanicGuideRail({
  onStepAction,
}: {
  onStepAction: (key: (typeof GUIDE_STEPS)[number]['key']) => void;
}) {
  const [index, setIndex] = useState(0);
  const [autoToken, setAutoToken] = useState(0);
  const [paused, setPaused] = useState(false);
  const hintOpacity = useRef(new Animated.Value(1)).current;
  const hintY = useRef(new Animated.Value(0)).current;
  const progress = useRef(new Animated.Value(0)).current;
  const active = GUIDE_STEPS[index] ?? GUIDE_STEPS[0]!;

  const goTo = useCallback(
    (next: number) => {
      const normalized = ((next % GUIDE_STEPS.length) + GUIDE_STEPS.length) % GUIDE_STEPS.length;
      Animated.parallel([
        Animated.timing(hintOpacity, { toValue: 0, duration: 110, useNativeDriver: true }),
        Animated.timing(hintY, { toValue: -5, duration: 110, useNativeDriver: true }),
      ]).start(() => {
        setIndex(normalized);
        hintY.setValue(5);
        Animated.parallel([
          Animated.timing(hintOpacity, {
            toValue: 1,
            duration: 200,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(hintY, {
            toValue: 0,
            duration: 200,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]).start();
      });
    },
    [hintOpacity, hintY],
  );

  const select = useCallback(
    (i: number) => {
      setPaused(true);
      setAutoToken((t) => t + 1);
      goTo(i);
      const step = GUIDE_STEPS[i];
      if (step) onStepAction(step.key);
      setTimeout(() => setPaused(false), 4500);
    },
    [goTo, onStepAction],
  );

  useEffect(() => {
    if (paused) {
      progress.setValue(0);
      return;
    }
    progress.setValue(0);
    const fill = Animated.timing(progress, {
      toValue: 1,
      duration: GUIDE_INTERVAL_MS,
      easing: Easing.linear,
      useNativeDriver: false,
    });
    fill.start(({ finished }) => {
      if (finished) {
        goTo(index + 1);
        setAutoToken((t) => t + 1);
      }
    });
    return () => fill.stop();
  }, [autoToken, goTo, index, paused, progress]);

  const progressWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={guideStyles.rail}>
      <View style={guideStyles.steps}>
        {GUIDE_STEPS.map((step, i) => {
          const on = i === index;
          return (
            <React.Fragment key={step.key}>
              {i > 0 ? <View style={[guideStyles.line, i <= index && guideStyles.lineOn]} /> : null}
              <Pressable
                onPress={() => select(i)}
                style={[guideStyles.orb, on && guideStyles.orbOn]}
                accessibilityRole="button"
                accessibilityLabel={step.title}
                accessibilityState={{ selected: on }}
              >
                <GuideIcon stepKey={step.key} active={on} />
              </Pressable>
            </React.Fragment>
          );
        })}
      </View>

      <Animated.View style={[guideStyles.caption, { opacity: hintOpacity, transform: [{ translateY: hintY }] }]}>
        <Text style={guideStyles.captionTitle}>{active.title}</Text>
        <Text style={guideStyles.captionHint} numberOfLines={1}>
          {active.hint}
        </Text>
      </Animated.View>

      <View style={guideStyles.track}>
        <Animated.View style={[guideStyles.fill, { width: progressWidth }]} />
      </View>
    </View>
  );
}

const POLL_INTERVAL_MS = 45_000;

/** Cheap structural compare for small API payloads, so unchanged polls don't re-render. */
function sameJson(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

function keepIfSame<T>(next: T): (prev: T) => T {
  return (prev) => (sameJson(prev, next) ? prev : next);
}
const CLOCK_TICK_MS = 15_000;

type ReadinessItem = {
  key: string;
  label: string;
  detail: string;
  done: boolean;
  onPress: () => void;
};

function formatShortDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
}

export function MechanicHomeScreen({ navigation }: Props) {
  const { user } = useAuth();
  const { config } = useAppConfig();
  const emergencyOn = config?.features?.emergency_assistance ?? false;
  const subscriptionsOn = config?.features?.mechanic_subscriptions ?? false;

  const pageOpacity = useRef(new Animated.Value(0)).current;

  const [entitlements, setEntitlements] = useState<Entitlements | null>(null);
  const [subscriptionDashboard, setSubscriptionDashboard] = useState<MechanicSubscriptionDetails | null>(null);
  const [listingStatus, setListingStatus] = useState<string | null>(null);
  const [identity, setIdentity] = useState<MechanicIdentityVerification | null>(null);
  const [serviceRadiusKm, setServiceRadiusKm] = useState<number | null>(null);
  const [emergencyListing, setEmergencyListing] = useState<boolean | null>(null);
  const [availability, setAvailability] = useState<'available' | 'offline' | 'busy'>('offline');
  const [availabilityBusy, setAvailabilityBusy] = useState(false);
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof fetchMechanicHelpQueues>>['summary'] | null>(
    null,
  );
  const [activeJob, setActiveJob] = useState<HelpRequest | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [mapCollapsed, setMapCollapsed] = useState(false);
  const [workLocation, setWorkLocation] = useState<SavedWorkLocation | null>(null);
  const [deviceSaveBusy, setDeviceSaveBusy] = useState(false);
  const resumePrompted = useRef(false);
  const loadInFlight = useRef(false);
  /** A focus/manual load requested while another was running; re-run once it finishes. */
  const loadQueued = useRef<{ showRefresh: boolean } | null>(null);
  const mountedRef = useRef(true);
  const focusedRef = useRef(false);
  const lastLoadAtRef = useRef(0);
  const maxOffsetKm = useServicePinMaxOffsetKm();
  const { coords, permissionDenied, servicePin, servicePinManual, applySavedMechanicLocation } =
    useMechanicLiveLocation();
  // Read live location through a ref so GPS ticks (every few seconds) don't recreate `load`
  // and re-fire the focus fetch.
  const locRef = useRef({ servicePin, servicePinManual, coords, maxOffsetKm });
  locRef.current = { servicePin, servicePinManual, coords, maxOffsetKm };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      pageOpacity.setValue(0);
      Animated.timing(pageOpacity, {
        toValue: 1,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }, [pageOpacity]),
  );

  const load = useCallback(async (showRefresh = false, fromPoll = false): Promise<void> => {
    if (loadInFlight.current) {
      // Background polls just skip; focus/manual loads run once the current one finishes.
      if (!fromPoll) {
        const prev = loadQueued.current;
        loadQueued.current = { showRefresh: showRefresh || (prev?.showRefresh ?? false) };
        if (showRefresh) setRefreshing(true);
      }
      return;
    }
    loadInFlight.current = true;
    if (showRefresh) setRefreshing(true);
    const alive = () => mountedRef.current;
    try {
      await Promise.all([
        fetchEntitlements()
          .then((e) => alive() && setEntitlements(keepIfSame<Entitlements | null>(e)))
          .catch(() => alive() && setEntitlements(null)),
        // Always read stored free credits so the tile can show the real count even when limits are off.
        fetchMechanicSubscription()
          .then((d) => alive() && setSubscriptionDashboard(keepIfSame<MechanicSubscriptionDetails | null>(d.subscription)))
          .catch(() => alive() && setSubscriptionDashboard(null)),
        fetchMyMechanicProfile()
          .then((p) => {
            if (!alive()) return;
            setListingStatus(p?.verification_status ?? (p ? 'pending' : 'none'));
            setAvailability(p?.availability_status ?? 'offline');
            setIdentity(keepIfSame<MechanicIdentityVerification | null>(p?.identity_verification ?? null));
            setServiceRadiusKm(
              p?.service_radius_km != null && Number(p.service_radius_km) > 0 ? Number(p.service_radius_km) : null,
            );
            setEmergencyListing(typeof p?.emergency_available === 'boolean' ? p.emergency_available : null);
            const lat = p?.latitude != null ? Number(p.latitude) : NaN;
            const lng = p?.longitude != null ? Number(p.longitude) : NaN;
            if (Number.isFinite(lat) && Number.isFinite(lng)) {
              setWorkLocation(
                keepIfSame<SavedWorkLocation | null>({ latitude: lat, longitude: lng, address: p?.address ?? null }),
              );
            } else {
              setWorkLocation(null);
            }
          })
          .catch(() => {
            if (!alive()) return;
            setListingStatus(null);
            setAvailability('offline');
            setWorkLocation(null);
          }),
      ]);

      if (!alive()) return;
      if (!emergencyOn) {
        setSummary(null);
        setActiveJob(null);
        setLastUpdatedAt(new Date().toISOString());
        return;
      }
      const q = await fetchMechanicHelpQueues(mechanicQueueFetchCoords(locRef.current));
      if (!alive()) return;
      setSummary(keepIfSame<typeof q.summary | null>(q.summary));
      setActiveJob(keepIfSame<HelpRequest | null>(pickPrimaryActiveJob(q)));
      setLastUpdatedAt(new Date().toISOString());
    } catch {
      if (alive()) {
        setSummary(null);
        setActiveJob(null);
      }
    } finally {
      loadInFlight.current = false;
      lastLoadAtRef.current = Date.now();
      const queued = loadQueued.current;
      loadQueued.current = null;
      if (alive()) {
        setNowMs(Date.now());
        if (queued) {
          // Keep the spinner if either the finished or the queued load asked for it.
          void loadRef.current(queued.showRefresh || showRefresh);
        } else if (showRefresh) {
          setRefreshing(false);
        }
      }
    }
  }, [emergencyOn]);

  const loadRef = useRef(load);
  loadRef.current = load;

  useFocusEffect(
    useCallback(() => {
      focusedRef.current = true;
      void load();
      return () => {
        focusedRef.current = false;
      };
    }, [load]),
  );

  // The queue is fetched around the service pin, so refresh when the pin itself moves
  // (saved on the map, or re-synced from GPS every ~40 m) — not on every GPS tick.
  const pinKey = servicePin
    ? `${servicePin.latitude.toFixed(5)},${servicePin.longitude.toFixed(5)},${servicePinManual ? 1 : 0}`
    : 'none';
  const pinKeySeen = useRef(pinKey);
  useEffect(() => {
    if (pinKeySeen.current === pinKey) return;
    pinKeySeen.current = pinKey;
    // Queued (not skipped) so the pin-correct fetch still happens if a load is running.
    if (focusedRef.current) void loadRef.current(false);
  }, [pinKey]);

  const isOnline = availability === 'available';
  const isBusy = availability === 'busy';
  const pollWhileFocused = emergencyOn && (isOnline || isBusy);

  // Keep counts fresh while the mechanic is online and looking at the dashboard. Stops on blur/unmount.
  useFocusEffect(
    useCallback(() => {
      const isActive = () => AppState.currentState === 'active';
      const tick = setInterval(() => {
        if (isActive()) setNowMs(Date.now());
      }, CLOCK_TICK_MS);
      const poll = pollWhileFocused
        ? setInterval(() => {
            if (isActive()) void loadRef.current(false, true);
          }, POLL_INTERVAL_MS)
        : null;
      // Skip work while backgrounded; catch up once when the app comes back if data is stale.
      const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
        if (state !== 'active') return;
        setNowMs(Date.now());
        if (pollWhileFocused && Date.now() - lastLoadAtRef.current >= POLL_INTERVAL_MS) {
          void loadRef.current(false, true);
        }
      });
      return () => {
        clearInterval(tick);
        if (poll) clearInterval(poll);
        sub.remove();
      };
    }, [pollWhileFocused]),
  );

  useEffect(() => {
    if (!emergencyOn || !activeJob || resumePrompted.current) return;
    resumePrompted.current = true;
    Alert.alert('Active job', 'Resume now?', [
      { text: 'Later', style: 'cancel' },
      {
        text: 'Resume',
        onPress: () =>
          navigation.navigate('ActiveJob', { helpRequestId: activeJob.id, initialRequest: activeJob }),
      },
    ]);
  }, [activeJob, emergencyOn, navigation]);

  const verified = listingStatus === 'verified';
  const needsProfile = listingStatus === 'none' || listingStatus === null;
  const verificationRejected = listingStatus === 'rejected';
  const verificationSuspended = listingStatus === 'suspended';
  const verificationPending = listingStatus === 'pending';
  const acceptedRemaining =
    entitlements?.accepted_requests?.remaining ?? entitlements?.accepted_requests_remaining;
  const unlimitedAccepts =
    entitlements?.accepted_requests?.unlimited ?? entitlements?.unlimited_accepted_requests ?? false;
  const isPro =
    entitlements?.plan_code === 'MECHANIC_PRO' || entitlements?.plan_code === 'MECHANIC_PRO_YEARLY';
  // Free credits only matter when the server enforces them and the mechanic isn't Pro
  // (Laravel SubscriptionService::entitlementsFor → accepted_requests.unlimited).
  const creditsApply = entitlements != null && !isPro && !unlimitedAccepts;
  /** Server limits are off and the mechanic isn't Pro: accepting is free, no credits used. */
  const limitsOff = entitlements != null && !isPro && unlimitedAccepts;
  const creditsRemaining = creditsApply
    ? (acceptedRemaining ?? subscriptionDashboard?.free_credits.remaining ?? null)
    : null;
  const acceptLimit =
    entitlements?.accepted_requests?.limit ??
    entitlements?.max_accepted_requests ??
    subscriptionDashboard?.free_credits.total ??
    null;
  // Authoritative: the same flag the accept endpoint enforces (MechanicRequestLimitService::canAccept).
  const atFreeLimit =
    creditsApply &&
    (entitlements?.can_accept_help_requests === false || (creditsRemaining != null && creditsRemaining <= 0));
  const lowCredits = creditsApply && !atFreeLimit && creditsRemaining != null && creditsRemaining <= 2;
  const showCreditsTile = subscriptionsOn || creditsApply || limitsOff;
  /**
   * Real remaining free credits for any non-Pro mechanic, even when the server isn't consuming them
   * (limits off → entitlements return null, so fall back to the stored credits from /mechanic/subscription).
   */
  const freeLeftShown = isPro
    ? null
    : (creditsRemaining ?? subscriptionDashboard?.free_credits.remaining ?? null);
  const freeCountText =
    freeLeftShown != null ? (acceptLimit != null ? `${freeLeftShown}/${acceptLimit}` : String(freeLeftShown)) : '—';
  const freeOfTotal =
    freeLeftShown != null
      ? acceptLimit != null
        ? `${freeLeftShown} of ${acceptLimit} free request${acceptLimit === 1 ? '' : 's'} left`
        : `${freeLeftShown} free request${freeLeftShown === 1 ? '' : 's'} left`
      : null;

  const incomingCount = summary?.incoming ?? 0;
  const workingCount = (summary?.accepted_active ?? 0) + (summary?.in_progress ?? 0);
  const doneCount = summary?.completed ?? 0;
  const hasWork = emergencyOn && (activeJob != null || incomingCount > 0 || workingCount > 0);
  // Dispatch only matches verified + online mechanics (server MechanicMatchingService), so be explicit.
  const onlineButNotMatchable = isOnline && !verified;
  /** Online and matched for offers, but can't accept until they get Mechanic Pro. */
  const onlineButCantAccept = isOnline && verified && atFreeLimit;
  const updatedLabel = lastUpdatedAt ? formatTimeAgo(lastUpdatedAt, nowMs) : null;

  const headerChip: { label: string; tone: ChipTone } = needsProfile
    ? { label: 'Setup needed', tone: 'warn' }
    : verificationSuspended
      ? { label: 'Suspended', tone: 'danger' }
      : verificationRejected
        ? { label: 'Needs fixes', tone: 'danger' }
        : verificationPending
          ? { label: 'In review', tone: 'warn' }
          : isBusy
            ? { label: 'On a job', tone: 'busy' }
            : isOnline
              ? { label: 'Online', tone: 'live' }
              : { label: 'Offline', tone: 'off' };
  const greeting = greetingFor(new Date(nowMs));

  const toggleOnline = async () => {
    // Going offline is always allowed, even while the listing is in review.
    if (!verified && !isOnline) {
      Alert.alert(
        'Not approved yet',
        needsProfile
          ? 'Complete your listing first, then we can review it.'
          : verificationRejected
            ? 'Your listing needs a few fixes before you can go online.'
            : verificationSuspended
              ? 'Your listing is suspended, so you can’t go online right now.'
              : 'Your listing is still being reviewed. You can go online once it’s approved.',
        [
          { text: 'Close', style: 'cancel' },
          needsProfile || verificationRejected
            ? { text: 'Open listing', onPress: () => navigation.navigate('MechanicOnboarding') }
            : { text: 'OK' },
        ],
      );
      return;
    }
    if (isBusy) {
      Alert.alert('Busy', 'Finish your active job first.');
      return;
    }
    const next = isOnline ? 'offline' : 'available';
    setAvailabilityBusy(true);
    try {
      if (next === 'available') {
        const target = mechanicQueueFetchCoords({ servicePin, servicePinManual, coords, maxOffsetKm });
        if (!target) {
          Alert.alert('Location needed', 'Set your service pin or turn on location first.');
          return;
        }
        const useManualPin = servicePinManual && servicePin != null;
        if (useManualPin && !coords) {
          Alert.alert('Location needed', 'Turn on location so we can check your pin.');
          return;
        }
        try {
          const updatedLoc = await updateMechanicProfileLocation(
            target.latitude,
            target.longitude,
            undefined,
            useManualPin && coords
              ? { source: 'manual', gps: coords }
              : { source: 'device' },
          );
          applySavedMechanicLocation(
            updatedLoc.latitude ?? target.latitude,
            updatedLoc.longitude ?? target.longitude,
            useManualPin,
          );
          setWorkLocation({
            latitude: updatedLoc.latitude ?? target.latitude,
            longitude: updatedLoc.longitude ?? target.longitude,
            address: updatedLoc.address ?? workLocation?.address ?? null,
          });
        } catch {
          Alert.alert('Could not update location', 'Fix your pin, then try again.');
          return;
        }
      }
      const updated = await updateMechanicAvailability(next);
      setAvailability(updated.availability_status ?? next);
      void load();
    } catch {
      Alert.alert('Could not update', 'Try again.');
    } finally {
      setAvailabilityBusy(false);
    }
  };

  const openRequests = (tab: RequestTab) => navigation.navigate('MechanicRequests', { tab });

  const onGuideAction = useCallback(
    (key: (typeof GUIDE_STEPS)[number]['key']) => {
      if (key === 'online') {
        if (!isOnline && !isBusy) void toggleOnline();
        return;
      }
      if (key === 'accept') {
        openRequests('incoming');
        return;
      }
      if (activeJob) {
        navigation.navigate('ActiveJob', {
          helpRequestId: activeJob.id,
          initialRequest: activeJob,
        });
      } else {
        openRequests('accepted_active');
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- toggleOnline closes over latest state
    [activeJob, isBusy, isOnline, navigation],
  );

  const saveDeviceLocationRef = useRef<() => Promise<void>>(async () => {});
  const saveDeviceLocation = async () => {
    if (!coords) {
      Alert.alert('Location unavailable', 'Turn on location and try again.');
      return;
    }
    setDeviceSaveBusy(true);
    try {
      const address = await reverseGeocodeLine(coords.latitude, coords.longitude);
      const updated = await updateMechanicProfileLocation(coords.latitude, coords.longitude, address ?? undefined, {
        source: 'device',
      });
      applySavedMechanicLocation(
        updated.latitude ?? coords.latitude,
        updated.longitude ?? coords.longitude,
        false,
      );
      setWorkLocation({
        latitude: updated.latitude ?? coords.latitude,
        longitude: updated.longitude ?? coords.longitude,
        address: address ?? updated.address ?? null,
      });
    } catch {
      Alert.alert('Could not save', 'Use Adjust pin to set your spot on the map.');
    } finally {
      setDeviceSaveBusy(false);
    }
  };

  saveDeviceLocationRef.current = saveDeviceLocation;
  const onUseDeviceLocation = useCallback(() => void saveDeviceLocationRef.current(), []);
  const onEditMap = useCallback(() => navigation.navigate('MechanicWorkLocation'), [navigation]);
  const onToggleMap = useCallback(() => setMapCollapsed((v) => !v), []);

  const showAlert = (emergencyOn && !verified) || !emergencyOn;

  const submittedOn = formatShortDate(identity?.submitted_at ?? null);
  const alertCopy: { title: string; detail: string | null } = needsProfile
      ? { title: 'Finish your listing to go online', detail: 'Add your details, service pin, and ID.' }
      : verificationRejected
        ? {
            title: 'Your listing needs updates',
            detail: identity?.rejection_reason?.trim()
              ? `Reason: ${identity.rejection_reason.trim()}`
              : 'Tap to see your listing and fix the details.',
          }
        : verificationSuspended
          ? {
              title: 'Your listing is suspended',
              detail: 'You won’t get requests while it’s suspended.',
            }
          : !emergencyOn
            ? { title: 'Help requests are paused right now', detail: 'You can still update your listing.' }
            : {
                title: 'Listing under review',
                detail: identity?.submitted
                  ? `ID submitted${submittedOn ? ` ${submittedOn}` : ''}. Requests start once your listing is approved.`
                  : 'Your ID check isn’t submitted yet. Tap to finish it so we can approve you.',
              };

  const availabilityTitle = isBusy ? 'On a job' : isOnline ? 'You’re online' : 'Go online';
  const availabilitySub = isBusy
    ? 'Finish the job to take new requests'
    : onlineButNotMatchable
      ? 'Requests start after your listing is approved'
      : onlineButCantAccept
        ? 'You’ll see requests, but need Mechanic Pro to accept'
      : isOnline
        ? 'Nearby requests will show up here'
        : verified
          ? 'Start getting nearby requests'
          : needsProfile
            ? 'Finish your listing first'
            : 'Available once your listing is approved';

  const readiness: ReadinessItem[] = [
    {
      key: 'verified',
      label: 'Listing approved',
      detail: verificationRejected
        ? 'Needs fixes'
        : verificationSuspended
          ? 'Suspended'
          : identity?.submitted
            ? 'In review'
            : 'Submit your ID',
      done: verified,
      onPress: () => navigation.navigate('MechanicOnboarding'),
    },
    {
      key: 'pin',
      label: 'Service pin set',
      detail: 'Pick where you work from',
      done: workLocation != null,
      onPress: () => navigation.navigate('MechanicWorkLocation'),
    },
    {
      key: 'gps',
      label: 'Location access on',
      detail: 'Open settings',
      done: !permissionDenied,
      onPress: () => void Linking.openSettings().catch(() => {}),
    },
    ...(subscriptionsOn && !isPro && !unlimitedAccepts && creditsRemaining != null
      ? [
          {
            key: 'credits',
            label: 'Credits left to accept',
            detail: 'View Mechanic Pro',
            done: creditsRemaining > 0,
            onPress: () => navigation.navigate('MechanicSubscription'),
          },
        ]
      : []),
  ];
  const readinessOpen = readiness.filter((r) => !r.done);
  const showReadiness = emergencyOn && !needsProfile && !hasWork && readinessOpen.length > 0;

  const creditsHint: { text: string; tone: 'muted' | 'warn' } | null = needsProfile || !showCreditsTile
    ? null
    : isPro
      ? { text: 'Unlimited accepted requests with Mechanic Pro.', tone: 'muted' }
      : limitsOff
        ? {
            text: freeOfTotal
              ? `${freeOfTotal} · Free credits aren’t used right now.`
              : 'Free credits aren’t used right now.',
            tone: 'muted',
          }
        : atFreeLimit
          ? null // the "free requests used" card explains it
          : lowCredits && creditsRemaining != null
            ? {
                text: `Only ${freeOfTotal ?? `${creditsRemaining} free requests left`}. ${
                  subscriptionsOn ? 'Get Mechanic Pro to keep accepting.' : 'Each accepted request uses 1.'
                }`,
                tone: 'warn',
              }
            : creditsRemaining != null
              ? { text: `${freeOfTotal} · each accepted request uses 1.`, tone: 'muted' }
              : { text: 'Each accepted request uses 1 free credit.', tone: 'muted' };

  const showWaiting = emergencyOn && !needsProfile && !hasWork && isOnline && verified && !atFreeLimit;
  const showOutOfCredits = atFreeLimit && !needsProfile;
  const waitingSub = [
    serviceRadiusKm != null ? `Within ${serviceRadiusKm} km of your service pin` : 'Near your service pin',
    emergencyListing === false ? 'Service requests only' : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const compactMap = !hasWork && !needsProfile;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <Animated.View style={[styles.page, { opacity: pageOpacity }]}>
        {/* Identity + primary availability */}
        <View style={styles.topBar}>
          <Pressable
            onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
            style={({ pressed }) => [styles.ghostBtn, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Open menu"
          >
            <View style={styles.menuBars}>
              <View style={styles.menuBar} />
              <View style={[styles.menuBar, styles.menuBarMid]} />
              <View style={styles.menuBar} />
            </View>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.identity, pressed && styles.pressed]}
            onPress={() => navigation.navigate('MechanicOnboarding')}
            accessibilityRole="button"
            accessibilityLabel={`${greeting}, ${firstName(user?.name)}. Status: ${headerChip.label}. Open your listing`}
          >
            <Text style={styles.greeting} numberOfLines={1}>
              {greeting}
            </Text>
            <View style={styles.nameRow}>
              <Text style={styles.hello} numberOfLines={1}>
                {firstName(user?.name)}
              </Text>
              <StatusChip label={headerChip.label} tone={headerChip.tone} />
            </View>
          </Pressable>

          <Pressable
            onPress={() => void load(true)}
            style={({ pressed }) => [styles.freshPill, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={updatedLabel ? `Refresh. Updated ${updatedLabel.toLowerCase()}` : 'Refresh'}
            disabled={refreshing}
          >
            {refreshing ? (
              <ActivityIndicator size="small" color={C.primary} />
            ) : (
              <>
                {pollWhileFocused ? <View style={styles.freshDot} /> : null}
                <Text style={styles.freshText} numberOfLines={1}>
                  {updatedLabel ?? 'Refresh'}
                </Text>
                <Text style={styles.refreshGlyph}>↻</Text>
              </>
            )}
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RydAidRefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />}
        >
          {emergencyOn ? (
            <Pressable
              style={({ pressed }) => [
                styles.availabilityBtn,
                isOnline && !onlineButNotMatchable && !onlineButCantAccept && styles.availabilityLive,
                (onlineButNotMatchable || onlineButCantAccept) && styles.availabilityPending,
                isBusy && styles.availabilityBusy,
                pressed && !availabilityBusy && !isBusy && styles.pressed,
              ]}
              onPress={() => void toggleOnline()}
              disabled={availabilityBusy || isBusy}
              accessibilityRole="switch"
              accessibilityState={{ checked: isOnline, disabled: availabilityBusy || isBusy }}
              accessibilityLabel={`${availabilityTitle}. ${availabilitySub}`}
              accessibilityHint={isOnline ? 'Double tap to go offline' : 'Double tap to go online'}
            >
              {availabilityBusy ? (
                <ActivityIndicator size="small" color={isOnline ? C.liveInk : C.text} />
              ) : (
                <>
                  {isOnline && !onlineButNotMatchable && !onlineButCantAccept ? (
                    <PulseLive />
                  ) : (
                    <View
                      style={[
                        styles.dot,
                        isBusy || onlineButNotMatchable || onlineButCantAccept ? styles.dotBusy : styles.dotOff,
                      ]}
                    />
                  )}
                  <View style={styles.availabilityCopy}>
                    <Text
                      style={[
                        styles.availabilityText,
                        isOnline && !onlineButNotMatchable && !onlineButCantAccept && styles.availabilityTextLive,
                        (onlineButNotMatchable || onlineButCantAccept) && styles.availabilityTextPending,
                      ]}
                    >
                      {availabilityTitle}
                    </Text>
                    <Text
                      style={[
                        styles.availabilitySub,
                        isOnline && !onlineButNotMatchable && !onlineButCantAccept && styles.availabilityHintLive,
                        (onlineButNotMatchable || onlineButCantAccept) && styles.availabilityTextPending,
                      ]}
                      numberOfLines={2}
                    >
                      {availabilitySub}
                    </Text>
                  </View>
                  {!isBusy ? (
                    <Text
                      style={[
                        styles.availabilityHint,
                        isOnline && !onlineButNotMatchable && !onlineButCantAccept && styles.availabilityHintLive,
                        (onlineButNotMatchable || onlineButCantAccept) && styles.availabilityTextPending,
                      ]}
                    >
                      {isOnline ? 'Tap to go offline' : 'Tap to go online'}
                    </Text>
                  ) : null}
                </>
              )}
            </Pressable>
          ) : null}

          {showAlert ? (
            <Pressable
              style={[
                styles.alertRow,
                (needsProfile || verificationPending || !emergencyOn) && styles.alertWarn,
                (verificationRejected || verificationSuspended) && styles.alertDanger,
              ]}
              onPress={() => navigation.navigate('MechanicOnboarding')}
              accessibilityRole="button"
              accessibilityLabel={`${alertCopy.title}. ${alertCopy.detail ?? ''}`}
            >
              <View style={styles.alertCopy}>
                <Text
                  style={[
                    styles.alertText,
                    (verificationRejected || verificationSuspended) && styles.alertTextDanger,
                  ]}
                  numberOfLines={1}
                >
                  {alertCopy.title}
                </Text>
                {alertCopy.detail ? (
                  <Text style={styles.alertDetail} numberOfLines={2}>
                    {alertCopy.detail}
                  </Text>
                ) : null}
              </View>
              <Text style={styles.alertChevron}>›</Text>
            </Pressable>
          ) : null}

          {showOutOfCredits ? (
            <View style={styles.outCard}>
              <Text style={styles.outEyebrow}>Free requests used</Text>
              <Text style={styles.outTitle} accessibilityRole="header">
                {acceptLimit != null
                  ? `You’ve used your ${acceptLimit} free requests`
                  : 'You’ve used all your free requests'}
              </Text>
              <Text style={styles.outBody}>
                {emergencyOn && verified
                  ? isOnline
                    ? 'You’ll still get nearby requests while you’re online, but you can’t accept them until you get Mechanic Pro.'
                    : 'You can still go online and see nearby requests, but you can’t accept them until you get Mechanic Pro.'
                  : 'You can’t accept new requests until you get Mechanic Pro.'}{' '}
                Free requests don’t renew on their own.
                {subscriptionsOn ? '' : ' Mechanic Pro isn’t available in the app yet.'}
              </Text>
              {doneCount > 0 ? (
                <Text style={styles.outStat}>
                  {doneCount} job{doneCount === 1 ? '' : 's'} completed with RydAid
                </Text>
              ) : null}
              <View style={styles.outActions}>
                {subscriptionsOn ? (
                  <Pressable
                    style={({ pressed }) => [styles.outPrimary, pressed && styles.pressed]}
                    onPress={() => navigation.navigate('MechanicSubscription')}
                    accessibilityRole="button"
                    accessibilityLabel="Get Mechanic Pro"
                    accessibilityHint="Opens Mechanic Pro plans"
                  >
                    <Text style={styles.outPrimaryText}>Get Mechanic Pro</Text>
                  </Pressable>
                ) : null}
                {doneCount > 0 ? (
                  <Pressable
                    style={({ pressed }) => [styles.outSecondary, pressed && styles.pressed]}
                    onPress={() => openRequests('completed')}
                    accessibilityRole="button"
                    accessibilityLabel="View completed jobs"
                  >
                    <Text style={styles.outSecondaryText}>View completed jobs</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          ) : null}

          {emergencyOn && activeJob ? (
            <Pressable
              style={({ pressed }) => [styles.activeJob, pressed && styles.pressed]}
              onPress={() =>
                navigation.navigate('ActiveJob', {
                  helpRequestId: activeJob.id,
                  initialRequest: activeJob,
                })
              }
              accessibilityRole="button"
              accessibilityLabel={`Active job, ${vehicleTitle(activeJob)}, ${jobStatusLabelOf(activeJob)}. Open`}
            >
              <View style={styles.activeJobCopy}>
                <Text style={styles.activeJobEyebrow}>Active job</Text>
                <Text style={styles.activeJobTitle} numberOfLines={1}>
                  {vehicleTitle(activeJob)}
                </Text>
                <Text style={styles.activeJobStatus}>{jobStatusLabelOf(activeJob)}</Text>
              </View>
              <View style={styles.activeJobCta}>
                <Text style={styles.activeJobCtaText}>Open</Text>
              </View>
            </Pressable>
          ) : emergencyOn && incomingCount > 0 ? (
            <Pressable
              style={({ pressed }) => [styles.incomingCard, pressed && styles.pressed]}
              onPress={() => openRequests('incoming')}
              accessibilityRole="button"
              accessibilityLabel={`${incomingCount} new request${incomingCount === 1 ? '' : 's'} near you.${
                atFreeLimit ? ' Upgrade to Mechanic Pro to accept.' : ''
              } Review`}
            >
              <View style={styles.activeJobCopy}>
                <Text style={styles.activeJobEyebrow}>New near you</Text>
                <Text style={styles.activeJobTitle} numberOfLines={1}>
                  {incomingCount} request{incomingCount === 1 ? '' : 's'} waiting for a mechanic
                </Text>
                <Text style={styles.incomingSub}>
                  {atFreeLimit
                    ? 'Upgrade to Mechanic Pro to accept'
                    : 'Open one to see the problem and distance'}
                </Text>
              </View>
              <View style={styles.activeJobCta}>
                <Text style={styles.activeJobCtaText}>Review</Text>
              </View>
            </Pressable>
          ) : showWaiting ? (
            <View style={styles.waitingCard} accessibilityRole="summary">
              <PulseLive />
              <View style={styles.waitingCopy}>
                <Text style={styles.waitingTitle}>Waiting for requests near you</Text>
                <Text style={styles.waitingSub} numberOfLines={2}>
                  {waitingSub}
                </Text>
              </View>
            </View>
          ) : emergencyOn && verified && !isOnline && !isBusy ? (
            <MechanicGuideRail onStepAction={onGuideAction} />
          ) : null}

          {emergencyOn ? (
            <View>
              <View style={styles.metrics}>
                <Pressable
                  style={({ pressed }) => [
                    styles.metric,
                    incomingCount > 0 && styles.metricHot,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => openRequests('incoming')}
                  accessibilityRole="button"
                  accessibilityLabel={`Incoming requests: ${incomingCount}`}
                >
                  <Text style={[styles.metricNum, incomingCount > 0 && styles.metricNumHot]}>
                    {incomingCount}
                  </Text>
                  <Text style={[styles.metricLbl, incomingCount > 0 && styles.metricLblHot]}>
                    Incoming
                  </Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    styles.metric,
                    workingCount > 0 && styles.metricHot,
                    pressed && styles.pressed,
                  ]}
                  onPress={() =>
                    openRequests((summary?.in_progress ?? 0) > 0 && (summary?.accepted_active ?? 0) === 0
                      ? 'in_progress'
                      : 'accepted_active')
                  }
                  accessibilityRole="button"
                  accessibilityLabel={`Working jobs: ${workingCount}`}
                >
                  <Text style={[styles.metricNum, workingCount > 0 && styles.metricNumHot]}>{workingCount}</Text>
                  <Text style={[styles.metricLbl, workingCount > 0 && styles.metricLblHot]}>Working</Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [styles.metric, pressed && styles.pressed]}
                  onPress={() => openRequests('completed')}
                  accessibilityRole="button"
                  accessibilityLabel={`Completed jobs: ${doneCount}`}
                >
                  <Text style={styles.metricNum}>{doneCount}</Text>
                  <Text style={styles.metricLbl}>Done</Text>
                </Pressable>

                {showCreditsTile ? (
                  <Pressable
                    style={({ pressed }) => [
                      styles.metric,
                      atFreeLimit && styles.metricDanger,
                      lowCredits && styles.metricWarn,
                      pressed && styles.pressed,
                    ]}
                    onPress={() => (subscriptionsOn ? navigation.navigate('MechanicSubscription') : undefined)}
                    disabled={!subscriptionsOn}
                    accessibilityRole="button"
                    accessibilityLabel={
                      isPro
                        ? 'Mechanic Pro, unlimited accepted requests'
                        : `${freeOfTotal ?? 'Free requests left unknown'}${
                            limitsOff ? '. Free credits aren’t used right now' : ''
                          }`
                    }
                  >
                    <Text
                      style={[
                        styles.metricNum,
                        atFreeLimit && styles.metricNumDanger,
                        lowCredits && styles.metricNumWarn,
                      ]}
                    >
                      {isPro ? 'Pro' : freeCountText}
                    </Text>
                    <Text
                      style={[
                        styles.metricLbl,
                        atFreeLimit && styles.metricNumDanger,
                        lowCredits && styles.metricNumWarn,
                      ]}
                      numberOfLines={1}
                    >
                      {isPro ? 'Unlimited' : 'Free left'}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
              {creditsHint ? (
                <Text
                  style={[styles.creditsHint, creditsHint.tone === 'warn' && styles.creditsHintWarn]}
                  numberOfLines={2}
                >
                  {creditsHint.text}
                </Text>
              ) : null}
            </View>
          ) : null}

          {showReadiness ? (
            <View style={styles.readyCard}>
              <Text style={styles.readyTitle}>Get ready for requests</Text>
              {readiness.map((item) => (
                <Pressable
                  key={item.key}
                  style={({ pressed }) => [styles.readyRow, pressed && !item.done && styles.pressed]}
                  onPress={item.done ? undefined : item.onPress}
                  disabled={item.done}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.label}: ${item.done ? 'done' : item.detail}`}
                  accessibilityState={{ checked: item.done, disabled: item.done }}
                >
                  <View style={[styles.readyMark, item.done && styles.readyMarkDone]}>
                    {item.done ? <Text style={styles.readyMarkGlyph}>✓</Text> : null}
                  </View>
                  <Text style={[styles.readyLabel, item.done && styles.readyLabelDone]} numberOfLines={1}>
                    {item.label}
                  </Text>
                  {!item.done ? (
                    <Text style={styles.readyAction} numberOfLines={1}>
                      {item.detail} ›
                    </Text>
                  ) : null}
                </Pressable>
              ))}
            </View>
          ) : null}

          <View style={[styles.mapStage, compactMap && styles.mapStageCompact]}>
            {!needsProfile ? (
              <MechanicDashboardLocationCard
                embedded
                saved={workLocation}
                deviceLatitude={coords?.latitude ?? null}
                deviceLongitude={coords?.longitude ?? null}
                permissionDenied={permissionDenied}
                pinManual={servicePinManual}
                onEditMap={onEditMap}
                onUseDeviceLocation={onUseDeviceLocation}
                deviceSaveBusy={deviceSaveBusy}
                mapHeight={compactMap ? 150 : undefined}
                collapsed={compactMap && mapCollapsed}
                onToggleCollapsed={compactMap ? onToggleMap : undefined}
              />
            ) : (
              <Pressable
                style={({ pressed }) => [styles.setupStage, pressed && styles.pressed]}
                onPress={() => navigation.navigate('MechanicOnboarding')}
                accessibilityRole="button"
                accessibilityLabel="Set up your listing"
              >
                <IconOnline active />
                <Text style={styles.setupTitle}>Set up your listing</Text>
                <Text style={styles.setupHint}>Pin, services, then go online</Text>
              </Pressable>
            )}
          </View>
        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  );
}

const iconStyles = StyleSheet.create({
  canvas: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },
  signalRing: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: C.primaryBright,
  },
  signalRingIdle: { opacity: 0.25, transform: [{ scale: 1 }] },
  signalCore: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: C.mutedSoft,
  },
  signalCoreOn: { backgroundColor: C.primary },
  tray: {
    position: 'absolute',
    bottom: 3,
    width: 18,
    height: 9,
    borderRadius: 2,
    borderWidth: 2,
    borderColor: C.mutedSoft,
    borderTopWidth: 0,
  },
  trayOn: { borderColor: C.primary },
  slip: {
    position: 'absolute',
    top: 4,
    width: 12,
    height: 9,
    borderRadius: 2,
    backgroundColor: '#cbd5e1',
  },
  slipOn: { backgroundColor: C.primaryBright },
  checkCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: C.mutedSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircleOn: { borderColor: C.live, backgroundColor: C.liveSoft },
  checkStem: {
    position: 'absolute',
    width: 2.5,
    height: 6,
    backgroundColor: C.mutedSoft,
    transform: [{ rotate: '-45deg' }, { translateX: -2 }, { translateY: 1 }],
    borderRadius: 1,
  },
  checkArm: {
    position: 'absolute',
    width: 2.5,
    height: 10,
    backgroundColor: C.mutedSoft,
    transform: [{ rotate: '40deg' }, { translateX: 3 }, { translateY: -1 }],
    borderRadius: 1,
  },
  checkStemOn: { backgroundColor: C.live },
  checkArmOn: { backgroundColor: C.live },
});

const guideStyles = StyleSheet.create({
  rail: {
    backgroundColor: C.surface,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
    borderWidth: 1,
    borderColor: C.border,
  },
  steps: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  line: {
    width: 26,
    height: 2,
    backgroundColor: C.border,
    marginHorizontal: 2,
  },
  lineOn: { backgroundColor: C.primaryBright },
  orb: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: C.surfaceMuted,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbOn: {
    backgroundColor: C.primarySoft,
    borderColor: C.primaryBright,
  },
  caption: {
    marginTop: 8,
    alignItems: 'center',
    minHeight: 34,
  },
  captionTitle: { fontSize: 13, fontWeight: '700', color: C.text, letterSpacing: 0.2 },
  captionHint: { marginTop: 2, fontSize: 11, color: C.muted },
  track: {
    marginTop: 8,
    height: 2,
    borderRadius: 1,
    backgroundColor: C.surfaceMuted,
    overflow: 'hidden',
  },
  fill: { height: '100%', backgroundColor: C.primary },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  page: {
    flex: 1,
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: Platform.OS === 'android' ? 8 : 4,
    gap: 10,
  },
  pressed: { opacity: 0.88 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  ghostBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: C.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  menuBars: { gap: 3.5, width: 15 },
  menuBar: { height: 2, borderRadius: 1, backgroundColor: C.text },
  menuBarMid: { width: 10 },
  identity: { flex: 1, minWidth: 0, minHeight: 44, justifyContent: 'center' },
  greeting: { fontSize: 12, fontWeight: '600', color: C.muted, letterSpacing: 0.1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 1 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: C.surfaceMuted,
    borderColor: C.border,
    flexShrink: 0,
  },
  chipLive: { backgroundColor: C.liveSoft, borderColor: C.liveBorder },
  chipWarn: { backgroundColor: C.warnSoft, borderColor: C.warnBorder },
  chipDanger: { backgroundColor: C.dangerSoft, borderColor: C.dangerBorder },
  chipBusy: { backgroundColor: C.busySoft, borderColor: C.busyBorder },
  chipDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.mutedSoft },
  chipDotLive: { backgroundColor: C.live },
  chipDotWarn: { backgroundColor: C.busy },
  chipDotDanger: { backgroundColor: C.danger },
  chipDotBusy: { backgroundColor: C.busy },
  chipText: { fontSize: 11, fontWeight: '700', color: C.muted, letterSpacing: 0.2 },
  chipTextLive: { color: C.liveInk },
  chipTextWarn: { color: C.warnInk },
  chipTextDanger: { color: C.dangerInk },
  chipTextBusy: { color: C.warnInk },
  hello: {
    flexShrink: 1,
    fontSize: 20,
    fontWeight: '700',
    color: C.text,
    letterSpacing: -0.3,
  },
  refreshGlyph: { fontSize: 17, color: C.primary, fontWeight: '700' },
  availabilityBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 52,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
  },
  availabilityLive: {
    backgroundColor: C.liveSoft,
    borderColor: C.liveBorder,
  },
  availabilityBusy: {
    backgroundColor: C.busySoft,
    borderColor: C.busyBorder,
  },
  availabilityText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: C.text,
    letterSpacing: -0.2,
  },
  availabilityTextLive: { color: C.liveInk },
  availabilityHint: {
    fontSize: 11,
    fontWeight: '600',
    color: C.muted,
  },
  availabilityHintLive: { color: C.liveInk },
  pulseWrap: { width: 14, height: 14, alignItems: 'center', justifyContent: 'center' },
  pulseRing: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(34, 197, 94, 0.35)',
  },
  dot: { width: 9, height: 9, borderRadius: 5 },
  dotOn: { backgroundColor: C.liveBright },
  dotOff: { backgroundColor: C.mutedSoft },
  dotBusy: { backgroundColor: C.busy },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  alertWarn: { backgroundColor: C.warnSoft, borderColor: C.warnBorder },
  alertDanger: { backgroundColor: C.dangerSoft, borderColor: C.dangerBorder },
  alertText: { flex: 1, fontSize: 12, fontWeight: '600', color: C.warnInk },
  alertChevron: { fontSize: 18, color: C.muted, fontWeight: '600' },
  activeJob: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.active,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  activeJobCopy: { flex: 1, minWidth: 0 },
  activeJobEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    color: C.onPrimary,
    opacity: 0.75,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  activeJobTitle: { marginTop: 2, color: C.onPrimary, fontSize: 15, fontWeight: '800' },
  activeJobStatus: { marginTop: 2, color: C.activeSoft, fontSize: 12, fontWeight: '600' },
  activeJobCta: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  activeJobCtaText: { color: C.onPrimary, fontWeight: '700', fontSize: 13 },
  metrics: { flexDirection: 'row', gap: 8 },
  metric: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.border,
    minHeight: 58,
  },
  metricNum: { fontSize: 18, fontWeight: '800', color: C.text, lineHeight: 22 },
  metricLbl: { marginTop: 2, fontSize: 10, fontWeight: '700', color: C.muted },
  mapStage: {
    flex: 1,
    minHeight: 280,
    backgroundColor: C.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
  },
  setupStage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 24,
  },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1, gap: 10, paddingBottom: 6 },
  freshPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 44,
    minWidth: 44,
    maxWidth: 140,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    justifyContent: 'center',
  },
  freshDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.liveBright },
  freshText: { fontSize: 11, fontWeight: '600', color: C.muted, flexShrink: 1 },
  availabilityCopy: { flex: 1, minWidth: 0, paddingVertical: 8 },
  availabilitySub: { marginTop: 1, fontSize: 12, fontWeight: '500', color: C.muted },
  availabilityPending: { backgroundColor: C.warnSoft, borderColor: C.warnBorder },
  availabilityTextPending: { color: C.warnInk },
  alertCopy: { flex: 1, minWidth: 0 },
  alertTextDanger: { color: C.dangerInk },
  alertDetail: { marginTop: 2, fontSize: 12, color: C.text, opacity: 0.75, lineHeight: 16 },
  incomingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.primary,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  incomingSub: { marginTop: 2, color: '#e0f2fe', fontSize: 12, fontWeight: '600' },
  waitingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.surface,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  waitingCopy: { flex: 1, minWidth: 0 },
  waitingTitle: { fontSize: 14, fontWeight: '700', color: C.text },
  waitingSub: { marginTop: 2, fontSize: 12, color: C.muted },
  metricHot: { backgroundColor: C.primary, borderColor: C.primary },
  metricNumHot: { color: C.onPrimary },
  metricLblHot: { color: '#e0f2fe' },
  metricOff: { backgroundColor: C.surfaceMuted },
  metricWarn: { backgroundColor: C.warnSoft, borderColor: C.warnBorder },
  metricDanger: { backgroundColor: C.dangerSoft, borderColor: C.dangerBorder },
  metricNumWarn: { color: C.warnInk },
  metricNumDanger: { color: C.dangerInk },
  creditsHint: { marginTop: 6, fontSize: 11, color: C.muted, textAlign: 'center' },
  creditsHintWarn: { color: C.warnInk, fontWeight: '700' },
  outCard: {
    backgroundColor: C.warnSoft,
    borderColor: C.warnBorder,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  outEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: C.warnInk,
  },
  outTitle: { marginTop: 4, fontSize: 17, fontWeight: '800', color: C.text },
  outBody: { marginTop: 6, fontSize: 13, lineHeight: 19, color: C.text, opacity: 0.85 },
  outStat: { marginTop: 8, fontSize: 13, fontWeight: '700', color: C.liveInk },
  outActions: { marginTop: 12, gap: 8 },
  outPrimary: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outPrimaryText: { color: C.onPrimary, fontWeight: '800', fontSize: 15 },
  outSecondary: {
    minHeight: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.primaryBorder,
    backgroundColor: C.surface,
  },
  outSecondaryText: { color: C.primaryInk, fontWeight: '700', fontSize: 14 },
  readyCard: {
    backgroundColor: C.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  readyTitle: { fontSize: 13, fontWeight: '700', color: C.text, marginBottom: 4 },
  readyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7, minHeight: 36 },
  readyMark: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: C.mutedSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  readyMarkDone: { backgroundColor: C.live, borderColor: C.live },
  readyMarkGlyph: { color: C.onPrimary, fontSize: 10, fontWeight: '800', lineHeight: 12 },
  readyLabel: { flex: 1, fontSize: 13, fontWeight: '600', color: C.text },
  readyLabelDone: { color: C.muted, fontWeight: '500' },
  readyAction: { fontSize: 12, fontWeight: '700', color: C.primary, maxWidth: 150 },
  mapStageCompact: { flex: 0, flexGrow: 0, minHeight: 0 },
  setupTitle: { fontSize: 16, fontWeight: '700', color: C.text },
  setupHint: { fontSize: 13, color: C.muted, textAlign: 'center' },
});
