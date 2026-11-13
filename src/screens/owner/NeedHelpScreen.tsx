import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { stickyFooterBottomPadding } from '../../utils/screenInsets';
import { getApiErrorMessage } from '../../api/client';
import {
  createHelpRequest,
  fetchActiveHelpRequest,
  fetchCategoryQuestions,
  fetchHelpCancellationSummary,
  fetchProblemCategories,
  type HelpCancellationSummary,
  type ProblemCategory,
} from '../../api/helpRequests';
import { useAuth } from '../../context/AuthContext';
import {
  EMPTY_VEHICLE,
  forgetLastHelpVehicle,
  loadLastHelpVehicle,
  normalizePlate,
  saveLastHelpVehicle,
  vehicleApiFields,
  vehicleDetailsLine,
  vehicleErrors,
  type HelpVehicleForm,
} from '../../utils/helpVehicle';
import { isOwnerLiveHelpRequest } from '../../utils/helpRequestStatus';
import { GrabStyleBottomSheet } from '../../components/GrabStyleBottomSheet';
import { HelpPaymentPicker, type HelpPaymentChoice } from '../../components/HelpPaymentPicker';
import { HelpRequestPhotoGallery } from '../../components/HelpRequestPhotoGallery';
import { HelpRequestMap } from '../../components/HelpRequestMap';
import { LocationPickMap } from '../../components/LocationPickMap';
import { useAppConfig } from '../../hooks/useAppConfig';
import { useEnsureNearbyProviders } from '../../hooks/useEnsureNearbyProviders';
import type { OwnerStackParamList } from '../../navigation/types';
import { NeedHelpVehicleStep } from './NeedHelpVehicleStep';
import { createVehicle, isVehicleApiMissing } from '../../api/vehicles';
import { showAppToast } from '../../components/AppToast';
import { RydAidRefreshControl } from '../../components/RydAidRefreshControl';
import { needHelpInitialStep } from '../../utils/needHelpDraft';

type Props = NativeStackScreenProps<OwnerStackParamList, 'NeedHelp'>;

type Step = 'vehicle' | 'problem' | 'location' | 'review';

const STEPS: Step[] = ['vehicle', 'problem', 'location', 'review'];

const STEP_TITLES: Record<Step, string> = {
  vehicle: 'Vehicle',
  problem: 'Problem',
  location: 'Location',
  review: 'Review',
};

const ANSWER_OPTIONS = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'unsure', label: 'Unsure' },
] as const;

function formatAnswerLabel(value: string): string {
  return ANSWER_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

/** Same as rydaid.help_requests.max_problems on the server (default 3). */
const MAX_PROBLEMS = 3;

function minRemarksLength(emergency: boolean): number {
  return emergency ? 2 : 10;
}

export function NeedHelpScreen({ navigation, route }: Props) {
  const draft = route.params;
  const emergency = draft?.emergency ?? true;
  const insets = useSafeAreaInsets();
  const footerBottomPad = stickyFooterBottomPadding(insets);
  const { config, loading: configLoading } = useAppConfig();
  const { user } = useAuth();
  const submitLock = useRef(false);
  const preservePrefillAnswers = useRef(
    Boolean(draft?.fromFailedMatch && draft.answers && draft.answers.length > 0),
  );

  React.useEffect(() => {
    if (configLoading || config == null) return;
    if (!config.features.emergency_assistance) {
      navigation.replace('OwnerHome');
    }
  }, [config, configLoading, navigation]);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const active = await fetchActiveHelpRequest();
        if (cancelled || !active || !isOwnerLiveHelpRequest(active)) return;
        Alert.alert(
          'Active request in progress',
          'You already have an active help request. Finish or cancel it before booking another service.',
        );
        navigation.replace('ActiveHelpRequest', {
          helpRequestId: active.id,
          initialRequest: active,
        });
      } catch {
        /* allow form if active check fails; API still enforces on submit */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigation]);
  const [step, setStep] = useState<Step>(() => needHelpInitialStep(draft));
  const [vehicle, setVehicle] = useState<HelpVehicleForm>(
    () =>
      draft?.vehicleForm ?? {
        ...EMPTY_VEHICLE,
        makeModel: (draft?.vehicleDescription ?? '').split(' · ')[0]?.trim() ?? '',
      },
  );
  const [vehicleId, setVehicleId] = useState<number | null>(null);
  const [vehicleShowErrors, setVehicleShowErrors] = useState(false);
  const [rememberedVehicle, setRememberedVehicle] = useState<HelpVehicleForm | null>(null);
  const [saveVehicleToGarage, setSaveVehicleToGarage] = useState<boolean | null>(null);
  const [cancelSummary, setCancelSummary] = useState<HelpCancellationSummary | null>(null);
  const [problemLimitNote, setProblemLimitNote] = useState(false);
  const [paymentChoice, setPaymentChoice] = useState<HelpPaymentChoice | null>(null);

  React.useEffect(() => {
    let alive = true;
    void loadLastHelpVehicle(user?.id).then((v) => alive && setRememberedVehicle(v));
    // Null on servers without the cancellation limit — the warning simply stays hidden.
    void fetchHelpCancellationSummary().then((s) => alive && setCancelSummary(s));
    return () => {
      alive = false;
    };
  }, [user?.id]);

  const [categories, setCategories] = useState<ProblemCategory[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [categoryIds, setCategoryIds] = useState<number[]>(
    () =>
      draft?.problemCategoryIds?.slice(0, MAX_PROBLEMS) ??
      (draft?.problemCategoryId != null ? [draft.problemCategoryId] : []),
  );
  const categoryKey = categoryIds.join(',');
  const [remarks, setRemarks] = useState(draft?.remarks ?? '');
  const [questions, setQuestions] = useState<Array<{ id: number; question_text: string }>>([]);
  const [answers, setAnswers] = useState<Record<number, string>>(() => {
    const initial = draft?.answers;
    if (!initial?.length) return {};
    return Object.fromEntries(initial.map((a) => [a.question_id, a.answer]));
  });
  const [photoUris, setPhotoUris] = useState<string[]>(draft?.photoUris ?? []);

  const [lat, setLat] = useState<number | null>(draft?.latitude ?? null);
  const [lng, setLng] = useState<number | null>(draft?.longitude ?? null);
  const [landmark, setLandmark] = useState(draft?.landmark ?? '');
  const [locating, setLocating] = useState(false);
  const [address, setAddress] = useState(draft?.addressText ?? '');

  const [submitting, setSubmitting] = useState(false);
  const [mapRecenterKey, setMapRecenterKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEnsureNearbyProviders(lat, lng, config?.features?.dynamic_nearby_seed === true);

  const reloadCategories = React.useCallback(() => {
    setCategoriesLoading(true);
    setCategoriesError(null);
    return fetchProblemCategories()
      .then((list) => {
        setCategories(list);
      })
      .catch((err) => {
        setCategories([]);
        setCategoriesError(getApiErrorMessage(err));
      })
      .finally(() => setCategoriesLoading(false));
  }, []);

  React.useEffect(() => {
    reloadCategories();
  }, [reloadCategories]);

  const onPullRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      reloadCategories();
      void fetchHelpCancellationSummary().then(setCancelSummary);
    } finally {
      setRefreshing(false);
    }
  }, [reloadCategories]);

  // Questions for every selected problem, merged in order and de-duplicated.
  React.useEffect(() => {
    if (categoryIds.length === 0) {
      setQuestions([]);
      return;
    }
    let alive = true;
    void Promise.all(categoryIds.map((id) => fetchCategoryQuestions(id).catch(() => [])))
      .then((lists) => {
        if (!alive) return;
        const seen = new Set<number>();
        const merged = lists.flat().filter((q) => (seen.has(q.id) ? false : (seen.add(q.id), true)));
        setQuestions(merged);
        // Keep answers for questions that are still shown.
        setAnswers((prev) => {
          if (preservePrefillAnswers.current) {
            preservePrefillAnswers.current = false;
            return prev;
          }
          return Object.fromEntries(Object.entries(prev).filter(([qid]) => seen.has(Number(qid))));
        });
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- categoryKey tracks categoryIds
  }, [categoryKey]);

  const toggleProblem = (id: number) => {
    setCategoryIds((prev) => {
      if (prev.includes(id)) {
        setProblemLimitNote(false);
        return prev.filter((x) => x !== id);
      }
      if (prev.length >= MAX_PROBLEMS) {
        setProblemLimitNote(true);
        return prev;
      }
      return [...prev, id];
    });
  };

  const stepIndex = STEPS.indexOf(step);

  const reverseGeocode = async (latitude: number, longitude: number) => {
    try {
      const rev = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (rev[0]) {
        const line = [rev[0].street, rev[0].city, rev[0].region].filter(Boolean).join(', ');
        setAddress(line);
      }
    } catch {
      setAddress('');
    }
  };

  const captureLocation = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location required', 'We need your location to dispatch nearby mechanics.');
        return;
      }
      try {
        const enabled = await Location.hasServicesEnabledAsync();
        if (!enabled) {
          Alert.alert('Location off', 'Turn on location services, then try again.');
          return;
        }
      } catch {
        /* continue */
      }
      const pos = await Location.getCurrentPositionAsync({});
      setLat(pos.coords.latitude);
      setLng(pos.coords.longitude);
      await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
      setMapRecenterKey((k) => k + 1);
    } catch {
      Alert.alert('Location unavailable', 'Could not read GPS. Drop a pin on the map instead.');
    } finally {
      setLocating(false);
    }
  };

  React.useEffect(() => {
    if (lat != null && lng != null && !address) {
      reverseGeocode(lat, lng);
    }
  }, [lat, lng]);

  const autoLocated = useRef(false);
  React.useEffect(() => {
    if (autoLocated.current || (lat != null && lng != null)) {
      return;
    }
    autoLocated.current = true;
    void captureLocation();
  }, []);

  const onCenterChange = (center: { latitude: number; longitude: number }) => {
    setLat(center.latitude);
    setLng(center.longitude);
    reverseGeocode(center.latitude, center.longitude);
  };

  const vehicleValid = () => Object.keys(vehicleErrors(vehicle)).length === 0;

  const remarksMin = minRemarksLength(emergency);
  const problemValid = () => categoryIds.length > 0 && remarks.trim().length >= remarksMin;
  const atCancelLimit = cancelSummary?.limit_reached === true;

  const locationValid = () => lat != null && lng != null;

  const goNext = () => {
    if (step === 'vehicle' && !vehicleValid()) {
      // Errors show inline under each field.
      setVehicleShowErrors(true);
      return;
    }
    if (step === 'problem' && !problemValid()) {
      Alert.alert(
        'Problem',
        categoryIds.length === 0
          ? `Pick at least one problem (up to ${MAX_PROBLEMS}) and describe what happened.`
          : `Describe what happened (${remarksMin}+ characters).`,
      );
      return;
    }
    if (step === 'location' && !locationValid()) {
      Alert.alert('Location', 'Confirm where you need help on the map.');
      return;
    }
    const next = STEPS[stepIndex + 1];
    if (next) setStep(next);
  };

  const goBack = () => {
    if (stepIndex === 0) {
      navigation.goBack();
      return;
    }
    const prev = STEPS[stepIndex - 1];
    if (prev) setStep(prev);
  };

  const appendPickedPhotos = (uris: string[]) => {
    if (uris.length === 0) return;
    setPhotoUris((prev) => [...prev, ...uris].slice(0, 2));
  };

  const pickPhotosFromLibrary = async () => {
    const remaining = 2 - photoUris.length;
    if (remaining <= 0) {
      Alert.alert('Limit reached', 'You can attach up to 2 photos.');
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo access to attach images of the problem.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.8,
    });
    if (!result.canceled && result.assets.length > 0) {
      appendPickedPhotos(result.assets.map((a) => a.uri));
    }
  };

  const takePhoto = async () => {
    if (photoUris.length >= 2) {
      Alert.alert('Limit reached', 'You can attach up to 2 photos.');
      return;
    }
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow camera access to take a photo of the problem.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      appendPickedPhotos([result.assets[0].uri]);
    }
  };

  const pickPhotos = () => {
    if (photoUris.length >= 2) {
      Alert.alert('Limit reached', 'You can attach up to 2 photos.');
      return;
    }
    Alert.alert('Add photo', 'Attach a picture of the problem (optional).', [
      { text: 'Take photo', onPress: () => void takePhoto() },
      { text: 'Choose from library', onPress: () => void pickPhotosFromLibrary() },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const submit = async () => {
    if (submitLock.current || submitting) return;
    if (!vehicleValid() || categoryIds.length === 0 || !problemValid() || lat === null || lng === null) {
      Alert.alert('Incomplete', 'Check all steps before submitting.');
      return;
    }
    if (atCancelLimit) {
      Alert.alert('Daily limit reached', cancelLimitText(cancelSummary));
      return;
    }
    submitLock.current = true;
    setSubmitting(true);
    try {
      const addressText = [landmark.trim(), address].filter(Boolean).join(' · ') || address;
      // Older servers (no cancellation endpoint) ignore structured fields, so keep color/plate in the line there.
      const newApi = cancelSummary != null;
      const description = newApi
        ? vehicle.makeModel.trim()
        : [vehicle.makeModel.trim(), vehicle.color.trim(), normalizePlate(vehicle.plate)].filter(Boolean).join(' · ');
      const helpRequest = await createHelpRequest({
        ...(vehicleId != null ? { vehicle_id: vehicleId } : {}),
        vehicle_description: description.slice(0, 255),
        ...vehicleApiFields(vehicle),
        problem_category_id: categoryIds[0]!,
        problem_category_ids: categoryIds,
        request_type: emergency ? 'EMERGENCY' : 'SERVICE',
        remarks: remarks.trim(),
        latitude: lat,
        longitude: lng,
        address_text: addressText || undefined,
        answers: Object.entries(answers).map(([question_id, answer]) => ({
          question_id: Number(question_id),
          answer,
        })),
        photoUris: photoUris.length > 0 ? photoUris : undefined,
        ...(typeof paymentChoice === 'number'
          ? { payment_method_id: paymentChoice }
          : paymentChoice === 'cash'
            ? { payment_preference: 'cash' as const }
            : {}),
      });
      if (vehicleId == null) {
        void saveLastHelpVehicle(user?.id, vehicle);
        // "Save this vehicle" — best effort; the request is already sent, so never block on it.
        if (saveVehicleToGarage === true) {
          createVehicle(vehicle)
            .then(() => showAppToast('Vehicle saved to My vehicles.'))
            .catch((err) =>
              showAppToast(
                isVehicleApiMissing(err)
                  ? 'Saving vehicles needs the latest server update.'
                  : `Couldn’t save the vehicle: ${getApiErrorMessage(err)}`,
              ),
            );
        }
      }
      navigation.replace('ActiveHelpRequest', {
        helpRequestId: helpRequest.id,
        initialRequest: helpRequest,
      });
    } catch (error) {
      submitLock.current = false;
      Alert.alert('Could not submit', getApiErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const selectedNames = categoryIds
    .map((id) => categories.find((c) => c.id === id)?.name)
    .filter(Boolean)
    .join(', ');
  const cancelBanner =
    cancelSummary && cancelSummary.limit != null && cancelSummary.remaining_today != null
      ? cancelSummary.limit_reached
        ? { tone: 'bad' as const, text: cancelLimitText(cancelSummary) }
        : cancelSummary.remaining_today <= 1
          ? {
              tone: 'warn' as const,
              text: `You’ve cancelled ${cancelSummary.used_today} of ${cancelSummary.limit} help requests today. ${cancelSummary.remaining_today} cancellation left — after that you can’t send new requests until midnight.`,
            }
          : null
      : null;
  const addressToSend =
    [landmark.trim(), address].filter(Boolean).join(' · ') ||
    (lat != null && lng != null ? `${lat.toFixed(5)}, ${lng.toFixed(5)}` : '');

  return (
    <View style={styles.root}>
      <View style={styles.progressHeader}>
        <Text style={styles.progressCaption} accessibilityRole="header">
          Step {stepIndex + 1} of {STEPS.length} · {STEP_TITLES[step]}
        </Text>
        <View style={styles.progressRow}>
          {STEPS.map((s, i) => (
            <View
              key={s}
              style={[styles.progressDot, i <= stepIndex && styles.progressDotOn]}
              accessibilityLabel={`${STEP_TITLES[s]}${i === stepIndex ? ', current' : i < stepIndex ? ', completed' : ''}`}
            />
          ))}
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        alwaysBounceVertical={Platform.OS === 'ios'}
        refreshControl={
          <RydAidRefreshControl refreshing={refreshing} onRefresh={() => void onPullRefresh()} title="Refresh form" />
        }
      >
        {cancelBanner && (step === 'vehicle' || step === 'review') ? (
          <View
            style={[styles.limitBanner, cancelBanner.tone === 'bad' ? styles.limitBannerBad : styles.limitBannerWarn]}
            accessibilityRole="alert"
          >
            <Text style={[styles.limitBannerText, cancelBanner.tone === 'bad' && styles.limitBannerTextBad]}>
              {cancelBanner.text}
            </Text>
          </View>
        ) : null}

        {step === 'vehicle' && (
          <NeedHelpVehicleStep
            value={vehicle}
            onChange={setVehicle}
            vehicleId={vehicleId}
            onVehicleIdChange={setVehicleId}
            showErrors={vehicleShowErrors}
            remembered={rememberedVehicle}
            onForgetRemembered={() => {
              setRememberedVehicle(null);
              void forgetLastHelpVehicle(user?.id);
            }}
            saveToGarage={saveVehicleToGarage}
            onSaveToGarageChange={setSaveVehicleToGarage}
            onManageVehicles={() => navigation.navigate('MyVehicles')}
          />
        )}

        {step === 'problem' && (
          <>
            <Text style={styles.title}>What happened?</Text>
            <View style={styles.problemHead}>
              <Text style={styles.problemHint}>Pick up to {MAX_PROBLEMS}. The first one you pick is the main problem.</Text>
              <Text
                style={[styles.problemCount, categoryIds.length >= MAX_PROBLEMS && styles.problemCountFull]}
                accessibilityLabel={`${categoryIds.length} of ${MAX_PROBLEMS} problems selected`}
              >
                {categoryIds.length}/{MAX_PROBLEMS} selected
              </Text>
            </View>
            {categoriesLoading ? (
              <ActivityIndicator style={{ marginVertical: 8 }} />
            ) : categoriesError ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>Could not load problem categories. {categoriesError}</Text>
                <Pressable style={styles.retryBtn} onPress={() => void reloadCategories()}>
                  <Text style={styles.retryBtnText}>Retry</Text>
                </Pressable>
              </View>
            ) : categories.length === 0 ? (
              <Text style={styles.meta}>No categories available. Pull to refresh or tap Retry.</Text>
            ) : (
              <View style={styles.chips}>
                {categories.map((c) => {
                  const order = categoryIds.indexOf(c.id);
                  const on = order >= 0;
                  const full = !on && categoryIds.length >= MAX_PROBLEMS;
                  return (
                    <Pressable
                      key={c.id}
                      style={[styles.chip, on && styles.chipOn, full && styles.chipFull]}
                      onPress={() => toggleProblem(c.id)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: on, disabled: full }}
                      accessibilityLabel={`${c.name}${order === 0 ? ', main problem' : ''}`}
                    >
                      <Text style={on ? styles.chipOnText : full ? styles.chipFullText : styles.chipText}>
                        {on ? `${order + 1}. ` : ''}
                        {c.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
            {problemLimitNote && categoryIds.length >= MAX_PROBLEMS ? (
              <Text style={styles.problemLimit} accessibilityRole="alert">
                You can pick up to {MAX_PROBLEMS} problems. Tap a selected one to remove it.
              </Text>
            ) : null}
            {questions.map((q) => (
              <View key={q.id} style={{ marginTop: 12 }}>
                <Text style={styles.subLabel}>{q.question_text}</Text>
                <View style={styles.chips}>
                  {ANSWER_OPTIONS.map((opt) => (
                    <Pressable
                      key={opt.value}
                      style={[styles.chip, answers[q.id] === opt.value && styles.chipOn]}
                      onPress={() => setAnswers((prev) => ({ ...prev, [q.id]: opt.value }))}
                    >
                      <Text style={answers[q.id] === opt.value ? styles.chipOnText : undefined}>
                        {opt.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}
            <Text style={styles.label}>Details</Text>
            <TextInput
              style={styles.input}
              multiline
              placeholder={`Describe the problem (${remarksMin}+ characters)…`}
              placeholderTextColor="#94a3b8"
              value={remarks}
              onChangeText={setRemarks}
            />
            <Pressable style={styles.secondaryBtn} onPress={pickPhotos}>
              <Text style={styles.secondaryBtnText}>
                {photoUris.length === 0 ? 'Add photos (optional)' : `Photos (${photoUris.length}/2)`}
              </Text>
            </Pressable>
            {photoUris.length > 0 ? (
              <HelpRequestPhotoGallery localUris={photoUris} title="Attached photos" compact />
            ) : null}
          </>
        )}

        {step === 'location' && (
          <>
            <Text style={styles.title}>Where are you?</Text>
            <LocationPickMap
              center={lat != null && lng != null ? { latitude: lat, longitude: lng } : null}
              onCenterChange={onCenterChange}
              onUseMyLocation={captureLocation}
              locating={locating}
              recenterKey={mapRecenterKey}
              height={280}
            />
            <Text style={styles.label}>Landmark or directions (optional)</Text>
            <TextInput
              style={styles.singleLineInput}
              placeholder="e.g. beside 7-Eleven, northbound lane"
              placeholderTextColor="#94a3b8"
              value={landmark}
              onChangeText={setLandmark}
            />
            <View style={styles.addressSentBox}>
              <Text style={styles.addressSentLabel}>Address we will send</Text>
              <Text style={styles.addressSentValue}>{addressToSend || 'Move the map to set your location.'}</Text>
            </View>
          </>
        )}

        {step === 'review' && lat != null && lng != null && (
          <>
            <Text style={styles.title}>Review & request</Text>
            <Text style={styles.reviewIntro}>Tap any section to change it before you send.</Text>
            <GrabStyleBottomSheet>
              <ReviewRow
                label="Vehicle"
                value={
                  [vehicle.makeModel.trim() || '—', vehicleDetailsLine(vehicle)].filter(Boolean).join('\n')
                }
                onEdit={() => setStep('vehicle')}
              />
              <ReviewRow
                label={categoryIds.length > 1 ? 'Problems' : 'Problem'}
                value={selectedNames || '—'}
                onEdit={() => setStep('problem')}
              />
              <ReviewRow label="Details" value={remarks || '—'} onEdit={() => setStep('problem')} />
              {questions.length > 0 ? (
                <View style={styles.reviewAnswersBlock}>
                  <Text style={styles.reviewLabel}>Your answers</Text>
                  {questions.map((q) => (
                    <Pressable key={q.id} onPress={() => setStep('problem')} accessibilityRole="button">
                      <Text style={styles.reviewAnswerQ}>{q.question_text}</Text>
                      <Text style={styles.reviewAnswerA}>
                        {answers[q.id] ? formatAnswerLabel(answers[q.id]) : '—'}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
              {photoUris.length > 0 ? (
                <View style={styles.reviewPhotosBlock}>
                  <Pressable onPress={() => setStep('problem')} accessibilityRole="button">
                    <Text style={styles.reviewLabel}>Photos</Text>
                  </Pressable>
                  <HelpRequestPhotoGallery localUris={photoUris} compact />
                </View>
              ) : null}
              <HelpPaymentPicker
                value={paymentChoice}
                onChange={setPaymentChoice}
                onManage={() => navigation.navigate('PaymentMethods')}
              />
              <ReviewRow label="Location" value={addressToSend} onEdit={() => setStep('location')} />
              <HelpRequestMap
                request={{ latitude: lat, longitude: lng, title: 'You' }}
                height={140}
              />
              <Text style={styles.reviewHint}>
                {emergency
                  ? 'We notify nearby verified mechanics. The first to accept comes to you.'
                  : 'We will match you with an available mechanic.'}
              </Text>
            </GrabStyleBottomSheet>
          </>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: footerBottomPad }]}>
        <Pressable
          style={({ pressed }) => [
            styles.backBtn,
            pressed && styles.footerBtnPressed,
            submitting && styles.footerBtnDisabled,
          ]}
          onPress={goBack}
          disabled={submitting}
          accessibilityRole="button"
          accessibilityLabel={stepIndex === 0 ? 'Cancel request' : 'Go back'}
        >
          <Text style={styles.backBtnText}>{stepIndex === 0 ? 'Cancel' : '← Back'}</Text>
        </Pressable>
        {step !== 'review' ? (
          <Pressable
            style={({ pressed }) => [styles.primary, styles.continueBtn, pressed && styles.footerBtnPressed]}
            onPress={goNext}
            accessibilityRole="button"
            accessibilityLabel="Continue to next step"
          >
            <Text style={styles.primaryText}>Continue →</Text>
          </Pressable>
        ) : (
          <Pressable
            style={({ pressed }) => [
              styles.primary,
              styles.submitBtn,
              pressed && styles.footerBtnPressed,
              (submitting || atCancelLimit) && styles.footerBtnDisabled,
            ]}
            onPress={submit}
            disabled={submitting || atCancelLimit}
            accessibilityRole="button"
            accessibilityLabel={emergency ? 'Request help now' : 'Submit request'}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryText}>{emergency ? 'Request help now' : 'Submit request'}</Text>
            )}
          </Pressable>
        )}
      </View>
    </View>
  );
}

function cancelLimitText(s: HelpCancellationSummary | null): string {
  const limit = s?.limit ?? 5;
  return `You’ve reached today’s limit of ${limit} cancelled help requests. You can send a new request after midnight.`;
}

function ReviewRow({
  label,
  value,
  onEdit,
}: {
  label: string;
  value: string;
  onEdit?: () => void;
}) {
  const inner = (
    <>
      <Text style={styles.reviewLabel}>{label}</Text>
      <Text style={styles.reviewValue}>{value}</Text>
      {onEdit ? <Text style={styles.reviewTapHint}>Tap to edit</Text> : null}
    </>
  );
  if (onEdit) {
    return (
      <Pressable
        style={styles.reviewRowPressable}
        onPress={onEdit}
        accessibilityRole="button"
        accessibilityLabel={`Edit ${label}`}
      >
        {inner}
      </Pressable>
    );
  }
  return <View style={styles.reviewRow}>{inner}</View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f8fafc' },
  progressHeader: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  progressCaption: { fontSize: 13, fontWeight: '700', color: '#475569', marginBottom: 8 },
  progressRow: { flexDirection: 'row', gap: 6 },
  progressDot: { flex: 1, height: 4, borderRadius: 2, backgroundColor: '#e2e8f0' },
  progressDotOn: { backgroundColor: '#0284c7' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 },
  title: { fontSize: 22, fontWeight: '800', color: '#0f172a', marginBottom: 16 },
  label: { fontWeight: '600', marginTop: 16, marginBottom: 8 },
  subLabel: { fontSize: 13, color: '#475569', marginBottom: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  chipOn: { backgroundColor: '#0284c7', borderColor: '#0284c7' },
  chipOnText: { color: '#fff', fontWeight: '700' },
  chipText: { color: '#0f172a', fontWeight: '600' },
  chipFull: { opacity: 0.45 },
  chipFullText: { color: '#64748b', fontWeight: '600' },
  problemHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: -8, marginBottom: 12, gap: 8 },
  problemHint: { flex: 1, fontSize: 13, color: '#64748b', lineHeight: 18 },
  problemCount: { fontSize: 13, fontWeight: '800', color: '#0369a1' },
  problemCountFull: { color: '#b45309' },
  problemLimit: { marginTop: 8, color: '#b45309', fontSize: 13, fontWeight: '600' },
  limitBanner: { borderRadius: 12, padding: 12, marginBottom: 14, borderWidth: 1 },
  limitBannerWarn: { backgroundColor: '#fef3c7', borderColor: '#fcd34d' },
  limitBannerBad: { backgroundColor: '#fee2e2', borderColor: '#fca5a5' },
  limitBannerText: { color: '#92400e', fontSize: 14, lineHeight: 20, fontWeight: '600' },
  limitBannerTextBad: { color: '#991b1b' },
  input: {
    minHeight: 100,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    padding: 12,
    textAlignVertical: 'top',
    color: '#0f172a',
  },
  singleLineInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    padding: 12,
    color: '#0f172a',
  },
  secondaryBtn: {
    marginTop: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#0284c7',
    borderRadius: 10,
  },
  secondaryBtnText: { color: '#0284c7', fontWeight: '600' },
  meta: { marginTop: 8, color: '#64748b' },
  reviewRow: { marginBottom: 10 },
  reviewRowPressable: {
    marginBottom: 10,
    padding: 10,
    marginHorizontal: -10,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
  },
  reviewIntro: { fontSize: 14, color: '#64748b', marginBottom: 12, marginTop: -8 },
  reviewLabel: { fontSize: 12, color: '#64748b', fontWeight: '600', textTransform: 'uppercase' },
  reviewValue: { fontSize: 15, color: '#0f172a', marginTop: 2, lineHeight: 20 },
  reviewTapHint: { fontSize: 12, color: '#0284c7', fontWeight: '600', marginTop: 4 },
  reviewAnswersBlock: { marginBottom: 12, gap: 8 },
  reviewAnswerQ: { fontSize: 13, color: '#475569', marginTop: 6 },
  reviewAnswerA: { fontSize: 15, color: '#0f172a', fontWeight: '600', marginTop: 2 },
  reviewPhotosBlock: { marginBottom: 12 },
  reviewHint: { marginTop: 12, color: '#64748b', fontSize: 13, lineHeight: 18 },
  errorBox: {
    padding: 12,
    backgroundColor: '#fef2f2',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fecaca',
    marginBottom: 12,
  },
  errorText: { color: '#b91c1c', fontSize: 14, marginBottom: 8 },
  retryBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#b91c1c',
  },
  retryBtnText: { color: '#b91c1c', fontWeight: '700' },
  addressSentBox: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  addressSentLabel: { fontSize: 12, fontWeight: '700', color: '#64748b', textTransform: 'uppercase' },
  addressSentValue: { fontSize: 15, color: '#0f172a', marginTop: 4, lineHeight: 20 },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#cbd5e1',
    backgroundColor: '#fff',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 16,
  },
  backBtn: {
    flex: 1,
    minHeight: 54,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#334155',
    backgroundColor: '#f8fafc',
  },
  backBtnText: { color: '#0f172a', fontWeight: '800', fontSize: 16 },
  primary: {
    flex: 1.35,
    minHeight: 54,
    paddingHorizontal: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueBtn: {
    backgroundColor: '#0284c7',
    shadowColor: '#0369a1',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  submitBtn: {
    backgroundColor: '#dc2626',
    shadowColor: '#b91c1c',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  primaryText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  footerBtnPressed: { opacity: 0.88, transform: [{ scale: 0.98 }] },
  footerBtnDisabled: { opacity: 0.55 },
});
