import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { DrawerActions, useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  type AppStateStatus,
  Animated,
  Easing,
  FlatList,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchEntitlements } from '../../api/auth';
import { getApiErrorMessage } from '../../api/client';
import { fetchMechanicSubscription, type MechanicSubscriptionDetails } from '../../api/mechanicSubscription';
import type { HelpRequest } from '../../api/helpRequests';
import { acceptHelpRequest, fetchMechanicHelpQueues } from '../../api/mechanicHelp';
import {
  fetchMyMechanicProfile,
  updateMechanicAvailability,
  updateMechanicProfile,
  updateMechanicProfileLocation,
} from '../../api/mechanicProfile';
import { shortAreaLabel, type SavedWorkLocation } from '../../components/MechanicDashboardLocationCard';
import {
  isEmergencyRequest,
  isNewRequest,
  MechanicDashboardMap,
  type LatLng,
  type MechanicDashboardMapHandle,
} from '../../components/MechanicDashboardMap';
import { DrawerIcon } from '../../components/DrawerIcons';
import type { Entitlements } from '../../api/types';
import type { MechanicIdentityVerification } from '../../api/mechanics';
import { useAuth } from '../../context/AuthContext';
import { useMechanicLiveLocation } from '../../context/MechanicLocationContext';
import { mechanicQueueFetchCoords, useServicePinMaxOffsetKm } from '../../hooks/useMechanicDistanceOrigin';
import { useAppConfig } from '../../hooks/useAppConfig';
import type { MechanicStackParamList } from '../../navigation/types';
import { colors as C } from '../../theme/colors';
import { formatDistanceKm, resolveMechanicToCustomerDistanceKm } from '../../utils/distanceKm';
import { formatTimeAgo } from '../../utils/formatTimeAgo';
import { jobStatusLabelOf, problemNamesOf, vehicleTitle, vehicleWithDetails } from '../../utils/helpRequestUi';
import { acceptLostRaceKind, incomingOfferUnavailableTitle } from '../../utils/incomingHelpOffer';
import { subscriptionRequiredMessage } from '../../utils/mechanicAcceptErrors';
import { markLaunchStep } from '../../utils/launchSteps';
import { cachedGeocodeLine, reverseGeocodeLine } from '../../utils/reverseGeocode';

type Props = NativeStackScreenProps<MechanicStackParamList, 'MechanicHome'>;

type RequestTab = 'incoming' | 'accepted_active' | 'in_progress' | 'completed';

function pickPrimaryActiveJob(queues: Awaited<ReturnType<typeof fetchMechanicHelpQueues>>): HelpRequest | null {
  const active = [...queues.accepted_active, ...queues.in_progress];
  return active[0] ?? null;
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
        Animated.timing(scale, {
          toValue: 1.55,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
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

/** Online dashboards refresh the nearby list this often (paused in background / off-screen). */
const POLL_INTERVAL_MS = 20_000;

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
  /** False until the first profile response, so the dashboard never flashes 'Setup needed'. */
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [identity, setIdentity] = useState<MechanicIdentityVerification | null>(null);
  const [serviceRadiusKm, setServiceRadiusKm] = useState<number | null>(null);
  const [emergencyListing, setEmergencyListing] = useState<boolean | null>(null);
  const [availability, setAvailability] = useState<'available' | 'offline' | 'busy'>('offline');
  const [availabilityBusy, setAvailabilityBusy] = useState(false);
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof fetchMechanicHelpQueues>>['summary'] | null>(null);
  const [activeJob, setActiveJob] = useState<HelpRequest | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [incoming, setIncoming] = useState<HelpRequest[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [actingId, setActingId] = useState<number | null>(null);
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

  const load = useCallback(
    async (showRefresh = false, fromPoll = false): Promise<void> => {
      if (loadInFlight.current) {
        // Background polls just skip; focus/manual loads run once the current one finishes.
        if (!fromPoll) {
          const prev = loadQueued.current;
          loadQueued.current = {
            showRefresh: showRefresh || (prev?.showRefresh ?? false),
          };
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
            .then(
              (d) =>
                alive() && setSubscriptionDashboard(keepIfSame<MechanicSubscriptionDetails | null>(d.subscription)),
            )
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
                  keepIfSame<SavedWorkLocation | null>({
                    latitude: lat,
                    longitude: lng,
                    address: p?.address ?? null,
                  }),
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
          setIncoming([]);
          setLastUpdatedAt(new Date().toISOString());
          return;
        }
        const q = await fetchMechanicHelpQueues(mechanicQueueFetchCoords(locRef.current));
        if (!alive()) return;
        setSummary(keepIfSame<typeof q.summary | null>(q.summary));
        setActiveJob(keepIfSame<HelpRequest | null>(pickPrimaryActiveJob(q)));
        setIncoming(keepIfSame<HelpRequest[]>(q.incoming ?? []));
        setLastUpdatedAt(new Date().toISOString());
      } catch {
        if (alive()) {
          setSummary(null);
          setActiveJob(null);
          setIncoming([]);
        }
      } finally {
        loadInFlight.current = false;
        lastLoadAtRef.current = Date.now();
        if (alive()) setProfileLoaded(true);
        markLaunchStep('dashboard');
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
    },
    [emergencyOn],
  );

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
    // The launch recovery may already have opened the job — don't stack a prompt on top of it.
    if (!navigation.isFocused()) return;
    Alert.alert('Active job', 'Resume now?', [
      { text: 'Later', style: 'cancel' },
      {
        text: 'Resume',
        onPress: () =>
          navigation.navigate('ActiveJob', {
            helpRequestId: activeJob.id,
            initialRequest: activeJob,
          }),
      },
    ]);
  }, [activeJob, emergencyOn, navigation]);

  const verified = listingStatus === 'verified';
  const needsProfile = profileLoaded && (listingStatus === 'none' || listingStatus === null);
  const verificationRejected = listingStatus === 'rejected';
  const verificationSuspended = listingStatus === 'suspended';
  const verificationPending = listingStatus === 'pending';
  const acceptedRemaining = entitlements?.accepted_requests?.remaining ?? entitlements?.accepted_requests_remaining;
  const unlimitedAccepts =
    entitlements?.accepted_requests?.unlimited ?? entitlements?.unlimited_accepted_requests ?? false;
  const isPro = entitlements?.plan_code === 'MECHANIC_PRO' || entitlements?.plan_code === 'MECHANIC_PRO_YEARLY';
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
  const freeLeftShown = isPro ? null : (creditsRemaining ?? subscriptionDashboard?.free_credits.remaining ?? null);
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

  const applyOnlineStatus = async (next: 'available' | 'offline', enableEmergency = false) => {
    setAvailabilityBusy(true);
    try {
      if (next === 'available') {
        const target = mechanicQueueFetchCoords({
          servicePin,
          servicePinManual,
          coords,
          maxOffsetKm,
        });
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
            useManualPin && coords ? { source: 'manual', gps: coords } : { source: 'device' },
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
          if (enableEmergency) {
            await updateMechanicProfile({
              latitude: updatedLoc.latitude ?? target.latitude,
              longitude: updatedLoc.longitude ?? target.longitude,
              emergency_available: true,
            });
            setEmergencyListing(true);
          }
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
            ? {
                text: 'Open listing',
                onPress: () => navigation.navigate('MechanicOnboarding'),
              }
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
    if (next === 'available' && emergencyOn && emergencyListing === false) {
      Alert.alert(
        'HELP requests are off',
        'Owners requesting roadside HELP won’t see you until emergency HELP is on.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Go online without HELP',
            onPress: () => void applyOnlineStatus('available'),
          },
          {
            text: 'Enable HELP & go online',
            onPress: () => void applyOnlineStatus('available', true),
          },
        ],
      );
      return;
    }
    await applyOnlineStatus(next);
  };

  const openRequests = (tab: RequestTab) => navigation.navigate('MechanicRequests', { tab });

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
      applySavedMechanicLocation(updated.latitude ?? coords.latitude, updated.longitude ?? coords.longitude, false);
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

  const showAlert = (emergencyOn && !verified) || !emergencyOn;

  const submittedOn = formatShortDate(identity?.submitted_at ?? null);
  const alertCopy: { title: string; detail: string | null } = needsProfile
    ? {
        title: 'Finish your listing to go online',
        detail: 'Add your details, service pin, and ID.',
      }
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
          ? {
              title: 'Help requests are paused right now',
              detail: 'You can still update your listing.',
            }
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

  const showWaiting = emergencyOn && !needsProfile && !hasWork && isOnline && verified && !atFreeLimit;
  const showOutOfCredits = atFreeLimit && !needsProfile;
  const waitingSub = [
    serviceRadiusKm != null ? `Within ${serviceRadiusKm} km of your service pin` : 'Near your service pin',
    emergencyListing === false ? 'Service requests only' : null,
  ]
    .filter(Boolean)
    .join(' · ');

  // ---------- Map-first layout ----------
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const isWide = winW >= 768;
  const mapRef = useRef<MechanicDashboardMapHandle>(null);
  const listRef = useRef<FlatList<HelpRequest>>(null);
  const [topH, setTopH] = useState(140);
  const [bottomH, setBottomH] = useState(180);
  const onTopLayout = useCallback((e: LayoutChangeEvent) => {
    const h = Math.round(e.nativeEvent.layout.height + e.nativeEvent.layout.y);
    setTopH((prev) => (Math.abs(prev - h) > 4 ? h : prev));
  }, []);
  const onBottomLayout = useCallback((e: LayoutChangeEvent) => {
    const h = Math.round(e.nativeEvent.layout.height);
    setBottomH((prev) => (Math.abs(prev - h) > 4 ? h : prev));
  }, []);

  const PANEL_W = 392;
  const mapPadding = useMemo(
    () =>
      isWide
        ? {
            top: insets.top + 8,
            right: 0,
            bottom: insets.bottom + 8,
            left: PANEL_W + 24,
          }
        : { top: topH, right: 0, bottom: bottomH, left: 0 },
    [isWide, insets.top, insets.bottom, topH, bottomH],
  );

  // Map centre: service pin → saved work location → GPS. Rounded so GPS jitter keeps the same object.
  const rawCenter = servicePin ?? workLocation ?? coords ?? null;
  const centerKey = rawCenter ? `${rawCenter.latitude.toFixed(4)},${rawCenter.longitude.toFixed(4)}` : '';
  const center = useMemo<LatLng | null>(
    () => (rawCenter ? { latitude: rawCenter.latitude, longitude: rawCenter.longitude } : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on rounded coords on purpose
    [centerKey],
  );

  const pinLabel = usePinAreaLabel(workLocation, servicePinManual, center);

  const visibleRequests = useMemo(
    () => (emergencyOn && !needsProfile ? incoming : NO_REQUESTS),
    [emergencyOn, needsProfile, incoming],
  );
  const visibleRef = useRef(visibleRequests);
  visibleRef.current = visibleRequests;
  const activeJobRef = useRef(activeJob);
  activeJobRef.current = activeJob;
  const hasRequests = visibleRequests.length > 0;
  const showMarkersFit = hasRequests || (emergencyOn && activeJob != null);

  useEffect(() => {
    if (selectedId != null && !visibleRequests.some((r) => r.id === selectedId)) setSelectedId(null);
  }, [visibleRequests, selectedId]);

  const cardW = isWide ? PANEL_W : Math.min(winW - 48, 360);
  const CARD_GAP = 10;

  // Stable (reads refs) so the memoized map and markers don't re-render on unrelated state.
  const selectOnMap = useCallback(
    (id: number | null) => {
      const job = activeJobRef.current;
      if (id != null && job && id === job.id) {
        navigation.navigate('ActiveJob', {
          helpRequestId: job.id,
          initialRequest: job,
        });
        return;
      }
      setSelectedId(id);
      if (id == null) return;
      const index = visibleRef.current.findIndex((r) => r.id === id);
      if (index >= 0 && !isWide) {
        listRef.current?.scrollToIndex({
          index,
          animated: true,
          viewPosition: 0,
        });
      }
    },
    [navigation, isWide],
  );

  const selectFromList = useCallback((r: HelpRequest) => {
    setSelectedId(r.id);
    mapRef.current?.focusRequest(r);
  }, []);

  const onCarouselEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const index = Math.round(e.nativeEvent.contentOffset.x / (cardW + CARD_GAP));
      const r = visibleRequests[Math.max(0, Math.min(index, visibleRequests.length - 1))];
      if (r && r.id !== selectedId) selectFromList(r);
    },
    [cardW, visibleRequests, selectedId, selectFromList],
  );

  const distanceOf = useCallback(
    (r: HelpRequest) => formatDistanceKm(resolveMechanicToCustomerDistanceKm(r, center)),
    [center],
  );

  const doAccept = async (r: HelpRequest) => {
    setActingId(r.id);
    try {
      const accepted = await acceptHelpRequest(r.id);
      navigation.navigate('ActiveJob', {
        helpRequestId: r.id,
        justAccepted: true,
        initialRequest: accepted,
      });
    } catch (e) {
      const subMsg = subscriptionRequiredMessage(e);
      if (subMsg) {
        Alert.alert('Mechanic Pro required', subMsg, [
          { text: 'Not now', style: 'cancel' },
          ...(subscriptionsOn
            ? [
                {
                  text: 'Get Mechanic Pro',
                  onPress: () => navigation.navigate('MechanicSubscription'),
                },
              ]
            : []),
        ]);
      } else {
        const lost = acceptLostRaceKind(e);
        if (lost) {
          Alert.alert(incomingOfferUnavailableTitle(lost), 'Stay online for the next offer nearby.');
        } else {
          Alert.alert('Could not accept', getApiErrorMessage(e));
        }
      }
      void load();
    } finally {
      setActingId(null);
    }
  };

  const confirmAccept = (r: HelpRequest) => {
    if (atFreeLimit) {
      if (subscriptionsOn) navigation.navigate('MechanicSubscription');
      else Alert.alert('Free requests used', 'You can’t accept new requests until Mechanic Pro is available.');
      return;
    }
    const problems = problemNamesOf(r, r.request_type_label ?? 'Help request');
    const dist = distanceOf(r);
    const creditLine =
      creditsApply && creditsRemaining != null
        ? `\n\nUses 1 free request (${creditsRemaining} left${acceptLimit != null ? ` of ${acceptLimit}` : ''}).`
        : '';
    Alert.alert('Accept this request?', `${problems}${dist ? ` · ${dist}` : ''}${creditLine}`, [
      { text: 'Not yet', style: 'cancel' },
      { text: 'Accept', onPress: () => void doAccept(r) },
    ]);
  };

  // One compact banner at a time, most important first.
  type Banner = {
    key: string;
    tone: 'active' | 'warn' | 'danger' | 'info';
    eyebrow?: string;
    title: string;
    detail?: string | null;
    cta?: string;
    onPress: () => void;
  };
  const banner: Banner | null =
    emergencyOn && activeJob
      ? {
          key: 'active',
          tone: 'active',
          eyebrow: 'Active job',
          title: vehicleTitle(activeJob),
          detail: jobStatusLabelOf(activeJob),
          cta: 'Open',
          onPress: () =>
            navigation.navigate('ActiveJob', {
              helpRequestId: activeJob.id,
              initialRequest: activeJob,
            }),
        }
      : showAlert
        ? {
            key: 'listing',
            tone: verificationRejected || verificationSuspended ? 'danger' : 'warn',
            title: alertCopy.title,
            detail: alertCopy.detail,
            onPress: () => navigation.navigate('MechanicOnboarding'),
          }
        : showOutOfCredits
          ? {
              key: 'credits',
              tone: 'warn',
              eyebrow: 'Free requests used',
              title:
                acceptLimit != null
                  ? `You’ve used your ${acceptLimit} free requests`
                  : 'You’ve used all your free requests',
              detail: subscriptionsOn
                ? 'You can still see nearby requests. Get Mechanic Pro to accept them.'
                : 'You can still see requests. Mechanic Pro isn’t available in the app yet.',
              cta: subscriptionsOn ? 'Get Pro' : undefined,
              onPress: () =>
                subscriptionsOn ? navigation.navigate('MechanicSubscription') : openRequests('completed'),
            }
          : permissionDenied
            ? {
                key: 'gps',
                tone: 'info',
                title: 'Location is off',
                detail: 'Turn it on to show where you are and keep your pin accurate.',
                cta: 'Settings',
                onPress: () => void Linking.openSettings().catch(() => {}),
              }
            : !workLocation && !needsProfile
              ? {
                  key: 'pin',
                  tone: 'info',
                  title: 'Set your service pin',
                  detail: 'Requests are matched around it.',
                  cta: 'Set pin',
                  onPress: onEditMap,
                }
              : null;

  const creditsPill: {
    text: string;
    tone: 'pro' | 'ok' | 'warn' | 'danger' | 'muted';
    a11y: string;
  } | null =
    needsProfile || !showCreditsTile
      ? null
      : isPro
        ? {
            text: 'Pro',
            tone: 'pro',
            a11y: 'Mechanic Pro, unlimited accepted requests',
          }
        : freeLeftShown == null
          ? null
          : {
              text: `${freeCountText} Free left`,
              tone: limitsOff ? 'muted' : atFreeLimit ? 'danger' : lowCredits ? 'warn' : 'ok',
              a11y: `${freeOfTotal ?? ''}${limitsOff ? '. Free credits aren’t used right now' : ''}`,
            };

  const onCreditsPress = () => {
    if (subscriptionsOn) {
      navigation.navigate('MechanicSubscription');
      return;
    }
    Alert.alert(
      'Free requests',
      `${freeOfTotal ?? 'Your free requests'}.${limitsOff ? ' Free credits aren’t used right now.' : ' Each accepted request uses 1.'}`,
    );
  };

  const switchOn = isOnline || isBusy;
  const switchTone = isBusy || onlineButNotMatchable || onlineButCantAccept ? 'warn' : isOnline ? 'live' : 'off';

  const topOverlay = (
    <View
      style={isWide ? styles.wideTop : [styles.topOverlay, { paddingTop: insets.top + 6 }]}
      onLayout={isWide ? undefined : onTopLayout}
      pointerEvents="box-none"
    >
      <View style={styles.topCard}>
        <Pressable
          onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
          style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
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
          accessibilityLabel={`${firstName(user?.name)}. Status: ${headerChip.label}. Open your listing`}
        >
          <Text style={styles.hello} numberOfLines={1}>
            {firstName(user?.name)}
          </Text>
          <StatusChip label={headerChip.label} tone={headerChip.tone} />
        </Pressable>
        {emergencyOn && !needsProfile ? (
          <Pressable
            onPress={() => void toggleOnline()}
            disabled={availabilityBusy || isBusy}
            style={({ pressed }) => [styles.switchHit, pressed && styles.pressed]}
            accessibilityRole="switch"
            accessibilityState={{
              checked: switchOn,
              disabled: availabilityBusy || isBusy,
            }}
            accessibilityLabel={`${availabilityTitle}. ${availabilitySub}`}
            accessibilityHint={isOnline ? 'Double tap to go offline' : 'Double tap to go online'}
          >
            {availabilityBusy ? (
              <ActivityIndicator size="small" color={C.primary} />
            ) : (
              <View
                style={[
                  styles.switchTrack,
                  switchTone === 'live' && styles.switchTrackLive,
                  switchTone === 'warn' && switchOn && styles.switchTrackWarn,
                ]}
              >
                <View style={[styles.switchKnob, switchOn && styles.switchKnobOn]} />
              </View>
            )}
          </Pressable>
        ) : null}
      </View>

      <View style={styles.pillRow} pointerEvents="box-none">
        {creditsPill ? (
          <Pressable
            onPress={onCreditsPress}
            style={({ pressed }) => [
              styles.pill,
              creditsPill.tone === 'pro' && styles.pillPro,
              creditsPill.tone === 'warn' && styles.pillWarn,
              creditsPill.tone === 'danger' && styles.pillDanger,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={creditsPill.a11y}
          >
            {creditsPill.tone === 'pro' ? <DrawerIcon name="crown" size={14} color={C.primaryInk} /> : null}
            <Text
              style={[
                styles.pillText,
                creditsPill.tone === 'pro' && styles.pillTextPro,
                creditsPill.tone === 'warn' && styles.pillTextWarn,
                creditsPill.tone === 'danger' && styles.pillTextDanger,
              ]}
            >
              {creditsPill.text}
            </Text>
          </Pressable>
        ) : null}
        {emergencyOn && hasRequests ? (
          <Pressable
            onPress={() => openRequests('incoming')}
            style={({ pressed }) => [styles.pill, styles.pillHot, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={`${visibleRequests.length} request${visibleRequests.length === 1 ? '' : 's'} near you. See all`}
          >
            <Text style={[styles.pillText, styles.pillTextHot]}>{visibleRequests.length} near you ›</Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={() => void load(true)}
          disabled={refreshing}
          style={({ pressed }) => [styles.pill, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={updatedLabel ? `Refresh. Updated ${updatedLabel.toLowerCase()}` : 'Refresh'}
        >
          {refreshing ? (
            <ActivityIndicator size="small" color={C.primary} />
          ) : (
            <>
              {pollWhileFocused ? <View style={styles.freshDot} /> : null}
              <Text style={styles.pillText} numberOfLines={1}>
                {updatedLabel ?? 'Refresh'} ↻
              </Text>
            </>
          )}
        </Pressable>
      </View>

      {banner ? (
        <Pressable
          onPress={banner.onPress}
          style={({ pressed }) => [
            styles.banner,
            banner.tone === 'active' && styles.bannerActive,
            banner.tone === 'warn' && styles.bannerWarn,
            banner.tone === 'danger' && styles.bannerDanger,
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={[banner.eyebrow, banner.title, banner.detail, banner.cta].filter(Boolean).join('. ')}
        >
          <View style={styles.flex}>
            {banner.eyebrow ? (
              <Text style={[styles.bannerEyebrow, banner.tone === 'active' && styles.bannerTextOn]}>
                {banner.eyebrow}
              </Text>
            ) : null}
            <Text
              style={[
                styles.bannerTitle,
                banner.tone === 'active' && styles.bannerTextOn,
                banner.tone === 'danger' && styles.bannerTextDanger,
              ]}
              numberOfLines={1}
            >
              {banner.title}
            </Text>
            {banner.detail ? (
              <Text style={[styles.bannerDetail, banner.tone === 'active' && styles.bannerDetailOn]} numberOfLines={2}>
                {banner.detail}
              </Text>
            ) : null}
          </View>
          {banner.cta ? (
            <View style={[styles.bannerCta, banner.tone === 'active' && styles.bannerCtaOn]}>
              <Text style={[styles.bannerCtaText, banner.tone === 'active' && styles.bannerTextOn]}>{banner.cta}</Text>
            </View>
          ) : (
            <Text style={styles.chevron}>›</Text>
          )}
        </Pressable>
      ) : null}
    </View>
  );

  const fabs = (
    <View style={styles.fabCol} pointerEvents="box-none">
      {showMarkersFit ? (
        <Pressable
          onPress={() => mapRef.current?.fitAll()}
          style={({ pressed }) => [styles.fab, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Show all requests on the map"
        >
          <Text style={styles.fabGlyph}>⤢</Text>
        </Pressable>
      ) : null}
      {center ? (
        <Pressable
          onPress={() => mapRef.current?.recenter()}
          style={({ pressed }) => [styles.fab, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Re-center on your service pin"
        >
          <View style={styles.recenterRing}>
            <View style={styles.recenterDot} />
          </View>
        </Pressable>
      ) : null}
    </View>
  );

  const renderCard = ({ item }: { item: HelpRequest }) => (
    <RequestCard
      request={item}
      width={cardW}
      selected={item.id === selectedId}
      isNew={isNewRequest(item, nowMs)}
      timeAgo={formatTimeAgo(item.search_started_at ?? item.created_at, nowMs)}
      distance={distanceOf(item)}
      acceptLabel={atFreeLimit ? (subscriptionsOn ? 'Get Pro' : 'Pro needed') : 'Accept'}
      acceptDisabled={atFreeLimit && !subscriptionsOn}
      busy={actingId === item.id}
      onPress={() => selectFromList(item)}
      onView={() => navigation.navigate('IncomingRequestDetail', { helpRequestId: item.id })}
      onAccept={() => confirmAccept(item)}
    />
  );

  const listHeader = (
    <View style={styles.listHead}>
      <Text style={styles.listTitle}>
        {visibleRequests.length} request
        {visibleRequests.length === 1 ? '' : 's'} near you
      </Text>
      <Pressable onPress={() => openRequests('incoming')} style={styles.linkHit} accessibilityRole="button">
        <Text style={styles.link}>See all ›</Text>
      </Pressable>
    </View>
  );

  const statusStrip = needsProfile ? (
    <View style={styles.strip}>
      <View style={styles.stripRow}>
        <DrawerIcon name="listing" color={C.primary} />
        <View style={styles.flex}>
          <Text style={styles.stripTitle}>Set up your listing</Text>
          <Text style={styles.stripSub}>Add your pin, services and ID, then go online.</Text>
        </View>
      </View>
      <Pressable
        style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
        onPress={() => navigation.navigate('MechanicOnboarding')}
        accessibilityRole="button"
      >
        <Text style={styles.primaryBtnText}>Set up listing</Text>
      </Pressable>
    </View>
  ) : (
    <View style={styles.strip}>
      {emergencyOn && isOnline && !isBusy && verified ? (
        <View style={styles.stripRow}>
          <PulseLive />
          <View style={styles.flex}>
            <Text style={styles.stripTitle}>{showWaiting ? 'Waiting for requests near you' : 'You’re online'}</Text>
            <Text style={styles.stripSub} numberOfLines={2}>
              {onlineButCantAccept ? 'You’ll see requests, but need Mechanic Pro to accept' : waitingSub}
            </Text>
          </View>
        </View>
      ) : emergencyOn && isBusy ? (
        <View style={styles.stripRow}>
          <View style={[styles.dot, styles.dotBusy]} />
          <Text style={[styles.stripTitle, styles.flex]}>Finish your active job to take new requests</Text>
        </View>
      ) : emergencyOn && verified ? (
        <>
          <View style={styles.stripRow}>
            <View style={[styles.dot, styles.dotOff]} />
            <View style={styles.flex}>
              <Text style={styles.stripTitle}>You’re offline</Text>
              <Text style={styles.stripSub}>Go online to get nearby requests on this map.</Text>
            </View>
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.primaryBtn,
              styles.goOnlineBtn,
              availabilityBusy && styles.btnOff,
              pressed && styles.pressed,
            ]}
            onPress={() => void toggleOnline()}
            disabled={availabilityBusy}
            accessibilityRole="button"
            accessibilityLabel="Go online"
          >
            {availabilityBusy ? (
              <ActivityIndicator color={C.onPrimary} />
            ) : (
              <Text style={styles.primaryBtnText}>Go online</Text>
            )}
          </Pressable>
        </>
      ) : null}
      <View style={[styles.pinRow, !(emergencyOn && verified) && styles.pinRowFirst]}>
        <DrawerIcon name="pin" size={20} color={C.primaryInk} />
        <View style={styles.flex}>
          <Text style={styles.pinEyebrow}>{workLocation ? 'Service pin' : 'Current location · not saved'}</Text>
          <Text style={styles.pinText} numberOfLines={1}>
            {pinLabel ?? (permissionDenied ? 'Location is off' : 'Finding your location…')}
          </Text>
        </View>
        <Pressable
          onPress={onEditMap}
          style={styles.smallBtn}
          accessibilityRole="button"
          accessibilityLabel="Adjust service pin"
        >
          <Text style={styles.smallBtnText}>Adjust</Text>
        </Pressable>
        <Pressable
          onPress={onUseDeviceLocation}
          disabled={deviceSaveBusy || permissionDenied}
          style={[styles.smallBtn, styles.smallBtnPrimary, (deviceSaveBusy || permissionDenied) && styles.btnOff]}
          accessibilityRole="button"
          accessibilityLabel="Use my current GPS location as my service pin"
        >
          <Text style={[styles.smallBtnText, styles.smallBtnTextPrimary]}>
            {deviceSaveBusy ? 'Saving…' : 'Use GPS'}
          </Text>
        </Pressable>
      </View>
      {emergencyOn && doneCount + workingCount > 0 ? (
        <Pressable onPress={() => openRequests('completed')} style={styles.linkHit} accessibilityRole="button">
          <Text style={styles.link}>
            {doneCount} job{doneCount === 1 ? '' : 's'} done · See requests ›
          </Text>
        </Pressable>
      ) : null}
    </View>
  );

  const map = (
    <MechanicDashboardMap
      ref={mapRef}
      center={center}
      showUserLocation={!permissionDenied}
      serviceRadiusKm={serviceRadiusKm}
      requests={visibleRequests}
      activeJob={emergencyOn ? activeJob : null}
      selectedId={selectedId}
      onSelect={selectOnMap}
      padding={mapPadding}
      nowMs={nowMs}
    />
  );

  if (isWide) {
    return (
      <View style={styles.root}>
        {map}
        <Animated.View
          style={[
            styles.widePanel,
            {
              top: insets.top + 8,
              bottom: insets.bottom + 8,
              width: PANEL_W,
              opacity: pageOpacity,
            },
          ]}
          pointerEvents="box-none"
        >
          {topOverlay}
          <ScrollView style={styles.flex} contentContainerStyle={styles.wideList} showsVerticalScrollIndicator={false}>
            {hasRequests ? (
              <>
                {listHeader}
                {visibleRequests.map((item) => (
                  <React.Fragment key={item.id}>{renderCard({ item })}</React.Fragment>
                ))}
              </>
            ) : (
              statusStrip
            )}
          </ScrollView>
        </Animated.View>
        <View style={[styles.wideFabs, { bottom: insets.bottom + 16 }]} pointerEvents="box-none">
          {fabs}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {map}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: pageOpacity }]} pointerEvents="box-none">
        {topOverlay}
        <View style={styles.bottomOverlay} pointerEvents="box-none">
          {fabs}
          <View style={{ paddingBottom: insets.bottom + 10 }} onLayout={onBottomLayout} pointerEvents="box-none">
            {hasRequests ? (
              <View pointerEvents="box-none">
                <FlatList
                  ref={listRef}
                  data={visibleRequests}
                  keyExtractor={(r) => String(r.id)}
                  renderItem={renderCard}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  snapToInterval={cardW + CARD_GAP}
                  snapToAlignment="start"
                  decelerationRate="fast"
                  contentContainerStyle={styles.carousel}
                  ItemSeparatorComponent={CarouselGap}
                  getItemLayout={(_, index) => ({
                    length: cardW + CARD_GAP,
                    offset: (cardW + CARD_GAP) * index,
                    index,
                  })}
                  onMomentumScrollEnd={onCarouselEnd}
                  onScrollToIndexFailed={() => {}}
                />
              </View>
            ) : (
              <View style={[styles.stripWrap, { maxHeight: winH * 0.42 }]}>{statusStrip}</View>
            )}
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const NO_REQUESTS: HelpRequest[] = [];

function CarouselGap() {
  return <View style={{ width: 10 }} />;
}

/** Short area for the pin: trust a hand-placed pin's saved address, otherwise geocode what the map shows. */
function usePinAreaLabel(saved: SavedWorkLocation | null, manual: boolean, center: LatLng | null): string | null {
  const trustSaved = Boolean(saved && manual && saved.address?.trim());
  const lat = center?.latitude ?? null;
  const lng = center?.longitude ?? null;
  const [line, setLine] = useState<string | null>(() =>
    lat != null && lng != null ? cachedGeocodeLine(lat, lng) : null,
  );
  useEffect(() => {
    if (trustSaved || lat == null || lng == null) return;
    let alive = true;
    setLine(cachedGeocodeLine(lat, lng));
    void reverseGeocodeLine(lat, lng).then((l) => {
      if (alive) setLine(l);
    });
    return () => {
      alive = false;
    };
  }, [trustSaved, lat, lng]);
  const full = trustSaved ? saved!.address!.trim() : line;
  return shortAreaLabel(full) ?? (center ? `${center.latitude.toFixed(4)}, ${center.longitude.toFixed(4)}` : null);
}

const RequestCard = React.memo(function RequestCard({
  request,
  width,
  selected,
  isNew,
  timeAgo,
  distance,
  acceptLabel,
  acceptDisabled,
  busy,
  onPress,
  onView,
  onAccept,
}: {
  request: HelpRequest;
  width: number;
  selected: boolean;
  isNew: boolean;
  timeAgo: string;
  distance: string | null;
  acceptLabel: string;
  acceptDisabled: boolean;
  busy: boolean;
  onPress: () => void;
  onView: () => void;
  onAccept: () => void;
}) {
  const emergency = isEmergencyRequest(request);
  const problems = problemNamesOf(request, request.request_type_label ?? 'Help request');
  const meta = [distance, request.payment_preference?.label ? `Pays ${request.payment_preference.label}` : null]
    .filter(Boolean)
    .join(' · ');
  return (
    <Pressable
      onPress={onPress}
      style={[styles.card, { width }, selected && (emergency ? styles.cardSelEmergency : styles.cardSel)]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${emergency ? 'Emergency' : 'Service'} request${isNew ? ', new' : ''}. ${problems}. ${vehicleWithDetails(request)}. ${meta}. ${timeAgo}`}
    >
      <View style={styles.cardTop}>
        <View style={[styles.typeBadge, emergency ? styles.typeEmergency : styles.typeService]}>
          <Text style={[styles.typeText, emergency ? styles.typeTextEmergency : styles.typeTextService]}>
            {emergency ? 'EMERGENCY' : 'SERVICE'}
          </Text>
        </View>
        {isNew ? (
          <View style={styles.newBadge}>
            <Text style={styles.newBadgeText}>NEW</Text>
          </View>
        ) : null}
        <Text style={styles.cardTime} numberOfLines={1}>
          {timeAgo}
        </Text>
      </View>
      <Text style={styles.cardTitle} numberOfLines={1}>
        {problems}
      </Text>
      <Text style={styles.cardVehicle} numberOfLines={1}>
        {vehicleWithDetails(request)}
      </Text>
      {meta ? (
        <Text style={styles.cardMeta} numberOfLines={1}>
          {meta}
        </Text>
      ) : null}
      <View style={styles.cardActions}>
        <Pressable
          onPress={onView}
          style={({ pressed }) => [styles.cardBtn, styles.cardBtnGhost, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="View request details"
        >
          <Text style={styles.cardBtnGhostText}>View</Text>
        </Pressable>
        <Pressable
          onPress={onAccept}
          disabled={busy || acceptDisabled}
          style={({ pressed }) => [
            styles.cardBtn,
            emergency ? styles.cardBtnEmergency : styles.cardBtnPrimary,
            (busy || acceptDisabled) && styles.btnOff,
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={acceptLabel === 'Accept' ? 'Accept request' : acceptLabel}
        >
          {busy ? <ActivityIndicator color={C.onPrimary} /> : <Text style={styles.cardBtnText}>{acceptLabel}</Text>}
        </Pressable>
      </View>
    </Pressable>
  );
});

const SHADOW = {
  shadowColor: '#0f172a',
  shadowOpacity: 0.14,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 3 },
  elevation: 5,
} as const;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#e2e8f0' },
  flex: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.85 },
  topOverlay: { position: 'absolute', top: 0, left: 12, right: 12, gap: 8 },
  wideTop: { gap: 8 },
  topCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.surface,
    borderRadius: 16,
    paddingHorizontal: 4,
    paddingVertical: 4,
    ...SHADOW,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuBars: { gap: 3.5, width: 16 },
  menuBar: { height: 2, borderRadius: 1, backgroundColor: C.text },
  menuBarMid: { width: 11 },
  identity: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  hello: {
    flexShrink: 1,
    fontSize: 17,
    fontWeight: '800',
    color: C.text,
    letterSpacing: -0.3,
  },
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
  chipDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: C.mutedSoft,
  },
  chipDotLive: { backgroundColor: C.live },
  chipDotWarn: { backgroundColor: C.busy },
  chipDotDanger: { backgroundColor: C.danger },
  chipDotBusy: { backgroundColor: C.busy },
  chipText: {
    fontSize: 11,
    fontWeight: '700',
    color: C.muted,
    letterSpacing: 0.2,
  },
  chipTextLive: { color: C.liveInk },
  chipTextWarn: { color: C.warnInk },
  chipTextDanger: { color: C.dangerInk },
  chipTextBusy: { color: C.warnInk },
  switchHit: {
    minWidth: 64,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  switchTrack: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#cbd5e1',
    padding: 3,
    justifyContent: 'center',
  },
  switchTrackLive: { backgroundColor: C.live },
  switchTrackWarn: { backgroundColor: C.busy },
  switchKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    ...SHADOW,
    elevation: 2,
  },
  switchKnobOn: { alignSelf: 'flex-end' },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 32,
    paddingHorizontal: 11,
    borderRadius: 999,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    ...SHADOW,
    elevation: 3,
  },
  pillPro: { backgroundColor: C.primarySoft, borderColor: C.primaryBorder },
  pillWarn: { backgroundColor: C.warnSoft, borderColor: C.warnBorder },
  pillDanger: { backgroundColor: C.dangerSoft, borderColor: C.dangerBorder },
  pillHot: { backgroundColor: C.primary, borderColor: C.primary },
  pillText: { fontSize: 12, fontWeight: '700', color: C.text },
  pillTextPro: { color: C.primaryInk },
  pillTextWarn: { color: C.warnInk },
  pillTextDanger: { color: C.dangerInk },
  pillTextHot: { color: C.onPrimary },
  freshDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: C.liveBright,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.primaryBorder,
    ...SHADOW,
  },
  bannerActive: { backgroundColor: C.active, borderColor: C.active },
  bannerWarn: { backgroundColor: C.warnSoft, borderColor: C.warnBorder },
  bannerDanger: { backgroundColor: C.dangerSoft, borderColor: C.dangerBorder },
  bannerEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: C.warnInk,
  },
  bannerTitle: { fontSize: 14, fontWeight: '800', color: C.text },
  bannerDetail: {
    fontSize: 12,
    color: C.text,
    opacity: 0.8,
    marginTop: 1,
    lineHeight: 16,
  },
  bannerTextOn: { color: C.onPrimary },
  bannerDetailOn: { color: C.activeSoft, opacity: 1 },
  bannerTextDanger: { color: C.dangerInk },
  bannerCta: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerCtaOn: { backgroundColor: 'rgba(255,255,255,0.2)' },
  bannerCtaText: { color: C.onPrimary, fontWeight: '800', fontSize: 13 },
  chevron: { fontSize: 20, color: C.muted, fontWeight: '600' },
  bottomOverlay: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  fabCol: { alignSelf: 'flex-end', marginRight: 12, marginBottom: 10, gap: 10 },
  fab: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: C.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOW,
  },
  fabGlyph: { fontSize: 22, color: C.primaryInk, fontWeight: '700' },
  recenterRing: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recenterDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.primary,
  },
  carouselHead: { marginHorizontal: 12, marginBottom: 6 },
  carousel: { paddingHorizontal: 12 },
  listHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 12,
    paddingLeft: 12,
    ...SHADOW,
    elevation: 2,
  },
  listTitle: { fontSize: 13, fontWeight: '800', color: C.text },
  linkHit: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 10 },
  link: { fontSize: 13, fontWeight: '700', color: C.primary },
  card: {
    backgroundColor: C.surface,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 2,
    borderColor: 'transparent',
    ...SHADOW,
  },
  cardSel: { borderColor: C.primary },
  cardSelEmergency: { borderColor: C.danger },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  typeBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  typeEmergency: { backgroundColor: C.dangerSoft },
  typeService: { backgroundColor: C.primarySoft },
  typeText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  typeTextEmergency: { color: C.dangerInk },
  typeTextService: { color: C.primaryInk },
  newBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: C.liveSoft,
  },
  newBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: C.liveInk,
    letterSpacing: 0.5,
  },
  cardTime: {
    marginLeft: 'auto',
    fontSize: 12,
    color: C.muted,
    fontWeight: '600',
  },
  cardTitle: { marginTop: 4, fontSize: 16, fontWeight: '800', color: C.text },
  cardVehicle: { marginTop: 2, fontSize: 13, color: C.muted },
  cardMeta: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: '700',
    color: C.primaryInk,
  },
  cardActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  cardBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBtnGhost: { backgroundColor: C.surfaceMuted },
  cardBtnGhostText: { fontSize: 15, fontWeight: '800', color: C.text },
  cardBtnPrimary: { backgroundColor: C.primary },
  cardBtnEmergency: { backgroundColor: C.danger },
  cardBtnText: { fontSize: 15, fontWeight: '800', color: C.onPrimary },
  btnOff: { opacity: 0.5 },
  stripWrap: { paddingHorizontal: 12 },
  strip: {
    backgroundColor: C.surface,
    borderRadius: 18,
    padding: 12,
    gap: 8,
    ...SHADOW,
  },
  stripRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stripTitle: { fontSize: 15, fontWeight: '800', color: C.text },
  stripSub: { fontSize: 12, color: C.muted, marginTop: 1 },
  primaryBtn: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goOnlineBtn: { backgroundColor: C.live },
  primaryBtnText: { color: C.onPrimary, fontSize: 16, fontWeight: '800' },
  pinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.border,
    paddingTop: 8,
  },
  pinRowFirst: { borderTopWidth: 0, paddingTop: 0 },
  pinEyebrow: { fontSize: 11, fontWeight: '600', color: C.muted },
  pinText: { fontSize: 13, fontWeight: '700', color: C.text },
  smallBtn: {
    minHeight: 36,
    minWidth: 44,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: C.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallBtnPrimary: { backgroundColor: '#e0f2fe' },
  smallBtnText: { fontSize: 12, fontWeight: '800', color: '#475569' },
  smallBtnTextPrimary: { color: C.primaryInk },
  pulseWrap: {
    width: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(34, 197, 94, 0.35)',
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dotOn: { backgroundColor: C.liveBright },
  dotOff: { backgroundColor: C.mutedSoft },
  dotBusy: { backgroundColor: C.busy },
  widePanel: { position: 'absolute', left: 12, gap: 8 },
  wideList: { gap: 10, paddingTop: 8, paddingBottom: 12 },
  wideFabs: { position: 'absolute', right: 16 },
});
