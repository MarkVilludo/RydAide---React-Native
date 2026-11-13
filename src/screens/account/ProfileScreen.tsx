import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import axios from 'axios';
import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { removeMyAvatar, updateMyProfile, uploadMyAvatar } from '../../api/account';
import { resendVerificationEmail } from '../../api/auth';
import { getApiErrorMessage } from '../../api/client';
import { fetchMyMechanicProfile } from '../../api/mechanicProfile';
import type { MechanicResult } from '../../api/mechanics';
import { fetchMechanicSubscription, type MechanicSubscriptionDetails } from '../../api/mechanicSubscription';
import { fetchOwnerVehicles, savedVehicleDetailsLine, vehicleDisplayLabel, type OwnerVehicle } from '../../api/vehicles';
import { showAppToast } from '../../components/AppToast';
import { DrawerIcon, type DrawerIconName } from '../../components/DrawerIcons';
import { useAuth } from '../../context/AuthContext';
import { useAppConfig } from '../../hooks/useAppConfig';
import type { MechanicStackParamList, OwnerStackParamList, ProfileParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';
import { confirmBeforeDeleteAccountFlow } from '../../utils/deleteAccountConfirm';
import { formatMobileInput, normalizeMobile } from '../../utils/paymentMethods';
import { resolveMediaUrl } from '../../utils/resolveMediaUrl';

type Props = NativeStackScreenProps<ProfileParamList, 'Profile'>;

type EditField = 'name' | 'phone' | null;

function isMissingEndpoint(e: unknown): boolean {
  return axios.isAxiosError(e) && (e.response?.status === 404 || e.response?.status === 405);
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return ((parts[0]![0] ?? '') + (parts.length > 1 ? parts[parts.length - 1]![0] ?? '' : '')).toUpperCase();
}

function memberSince(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });
}

/** Shared profile for owners and mechanics: personal + contact info, role summary, quick actions, account. */
export function ProfileScreen({ navigation }: Props) {
  const { user, signOut, setCurrentUser } = useAuth();
  const isMechanic = user?.role === 'mechanic';
  const [editing, setEditing] = useState<EditField>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [resending, setResending] = useState(false);

  if (!user) return null;

  const avatarUri = user.avatar_url ? resolveMediaUrl(user.avatar_url) : null;

  const changePhoto = () => {
    const options: Array<{ text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }> = [
      { text: 'Choose from gallery', onPress: () => void pickPhoto() },
    ];
    if (avatarUri) options.push({ text: 'Remove photo', style: 'destructive', onPress: () => void removePhoto() });
    options.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert('Profile photo', 'Your photo helps your mechanic or customer recognise you.', options);
  };

  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo access to choose a profile photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]?.uri) return;
    const asset = result.assets[0];
    if (asset.fileSize != null && asset.fileSize > 5 * 1024 * 1024) {
      Alert.alert('Photo too large', 'Use a photo under 5 MB.');
      return;
    }
    setPhotoBusy(true);
    try {
      setCurrentUser(await uploadMyAvatar({ uri: asset.uri, mimeType: asset.mimeType, fileName: asset.fileName }));
      showAppToast('Photo updated.');
    } catch (e) {
      Alert.alert(
        'Could not update photo',
        isMissingEndpoint(e) ? 'Profile photos will be available after the next server update.' : getApiErrorMessage(e),
      );
    } finally {
      setPhotoBusy(false);
    }
  };

  const removePhoto = async () => {
    setPhotoBusy(true);
    try {
      setCurrentUser(await removeMyAvatar());
      showAppToast('Photo removed.');
    } catch (e) {
      Alert.alert('Could not remove photo', getApiErrorMessage(e));
    } finally {
      setPhotoBusy(false);
    }
  };

  const resend = async () => {
    setResending(true);
    try {
      await resendVerificationEmail();
      showAppToast('Verification e-mail sent. Check your inbox.');
    } catch (e) {
      Alert.alert('Could not send', getApiErrorMessage(e));
    } finally {
      setResending(false);
    }
  };

  const confirmSignOut = () => {
    Alert.alert('Sign out?', 'You can sign back in anytime with your e-mail and password.', [
      { text: 'Stay signed in', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
    ]);
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.band}>
          <Pressable
            onPress={changePhoto}
            disabled={photoBusy}
            style={styles.avatarWrap}
            accessibilityRole="button"
            accessibilityLabel={avatarUri ? 'Change profile photo' : 'Add a profile photo'}
          >
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarInitials]}>
                <Text style={styles.avatarText}>{initialsOf(user.name)}</Text>
              </View>
            )}
            <View style={styles.cameraBadge}>
              {photoBusy ? <ActivityIndicator size="small" color={colors.primary} /> : <DrawerIcon name="camera" size={18} color={colors.primary} />}
            </View>
          </Pressable>
          <Text style={styles.bandName} numberOfLines={1}>
            {user.name}
          </Text>
          <View style={styles.rolePill}>
            <Text style={styles.roleText}>{isMechanic ? 'Mechanic' : 'Vehicle owner'}</Text>
          </View>
        </View>

        <Card title="Personal information" onEdit={() => setEditing('name')} editLabel="Edit name">
          <Field label="Name" value={user.name} />
          <Field label="Account type" value={isMechanic ? 'Mechanic' : 'Vehicle owner'} />
          {memberSince(user.created_at) ? <Field label="Member since" value={memberSince(user.created_at)!} last /> : null}
        </Card>

        <Card title="Contact information">
          {user.phone ? (
            <Pressable
              onPress={() => setEditing('phone')}
              style={styles.fieldPress}
              accessibilityRole="button"
              accessibilityLabel={`Mobile number ${user.phone}. Edit`}
            >
              <View style={styles.flex}>
                <Text style={styles.fieldLabel}>Mobile number</Text>
                <Text style={styles.fieldValue}>{formatMobileInput(user.phone)}</Text>
              </View>
              <DrawerIcon name="pencil" size={18} color={colors.primary} />
            </Pressable>
          ) : (
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Mobile number</Text>
              <AddLink label="Add a mobile number" onPress={() => setEditing('phone')} />
              <Text style={styles.helper}>
                {isMechanic
                  ? 'Customers on your jobs can call you directly.'
                  : 'Your mechanic can call you if they can’t find you.'}
              </Text>
            </View>
          )}
          <View style={[styles.field, styles.fieldLast]}>
            <Text style={styles.fieldLabel}>E-mail</Text>
            <View style={styles.emailRow}>
              <Text style={[styles.fieldValue, styles.flex]} numberOfLines={1}>
                {user.email}
              </Text>
              <Text style={[styles.pill, user.email_verified_at ? styles.pillOk : styles.pillWarn]}>
                {user.email_verified_at ? 'Verified' : 'Not verified'}
              </Text>
            </View>
            {!user.email_verified_at ? (
              <Pressable onPress={() => void resend()} disabled={resending} style={styles.linkRow} accessibilityRole="button">
                <Text style={styles.link}>{resending ? 'Sending…' : 'Resend verification e-mail'}</Text>
              </Pressable>
            ) : null}
            <Text style={styles.helper}>
              Your e-mail is your sign-in.{' '}
              <Text style={styles.linkInline} onPress={() => navigation.navigate('ContactSupport')} accessibilityRole="link">
                Contact support
              </Text>{' '}
              to change it.
            </Text>
          </View>
        </Card>

        {isMechanic ? <MechanicSections /> : <OwnerVehiclesCard />}

        <Card title="Shortcuts">
          <ActionRow icon="wallet" label="Payment methods" sub="Cash and your saved wallets" onPress={() => navigation.navigate('PaymentMethods')} />
          <ActionRow icon="headset" label="Contact Support" sub="Report a problem with the app" onPress={() => navigation.navigate('ContactSupport')} last />
        </Card>

        <Card title="Account settings">
          <Pressable
            style={styles.textAction}
            onPress={() => confirmBeforeDeleteAccountFlow(() => navigation.navigate('DeleteAccount'))}
            accessibilityRole="button"
          >
            <Text style={styles.link}>Request account deletion</Text>
          </Pressable>
          <Pressable style={[styles.textAction, styles.fieldLast]} onPress={confirmSignOut} accessibilityRole="button">
            <Text style={styles.link}>Sign out</Text>
          </Pressable>
        </Card>
      </ScrollView>

      <EditSheet
        field={editing}
        initialName={user.name}
        initialPhone={user.phone}
        onClose={() => setEditing(null)}
        onSaved={(u) => {
          setCurrentUser(u);
          setEditing(null);
          showAppToast('Profile updated.');
        }}
      />
    </View>
  );
}

function EditSheet({
  field,
  initialName,
  initialPhone,
  onClose,
  onSaved,
}: {
  field: EditField;
  initialName: string;
  initialPhone: string | null;
  onClose: () => void;
  onSaved: (u: import('../../api/types').User) => void;
}) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (field === 'name') setValue(initialName);
    if (field === 'phone') setValue(initialPhone ? formatMobileInput(initialPhone) : '');
    setError(null);
  }, [field, initialName, initialPhone]);

  const validate = (): string | null => {
    if (field === 'name') return value.trim().length < 2 ? 'Enter your full name.' : null;
    if (field === 'phone' && value.trim() !== '' && !normalizeMobile(value)) {
      return 'Enter an 11-digit mobile number, e.g. 0917 123 4567.';
    }
    return null;
  };

  const save = async () => {
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = field === 'name' ? { name: value.trim() } : { phone: value.trim() === '' ? null : normalizeMobile(value) };
      onSaved(await updateMyProfile(payload));
    } catch (e) {
      if (isMissingEndpoint(e)) {
        setError('Editing your profile will be available after the next server update.');
      } else {
        const fieldErr = (e as { response?: { data?: { errors?: Record<string, string[]> } } })?.response?.data?.errors?.[field ?? '']?.[0];
        setError(fieldErr ?? getApiErrorMessage(e));
      }
    } finally {
      setSaving(false);
    }
  };

  const isName = field === 'name';
  return (
    <Modal visible={field != null} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.sheetBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.flex} onPress={onClose} accessibilityLabel="Close" />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>{isName ? 'Edit name' : 'Mobile number'}</Text>
          <Text style={styles.fieldLabel}>{isName ? 'Full name' : 'Mobile number'}</Text>
          <TextInput
            style={[styles.input, error && styles.inputError]}
            value={value}
            onChangeText={(t) => {
              setValue(isName ? t : formatMobileInput(t));
              if (error) setError(null);
            }}
            placeholder={isName ? 'e.g. Juan Dela Cruz' : '0917 123 4567'}
            placeholderTextColor={colors.mutedSoft}
            autoFocus
            autoCapitalize={isName ? 'words' : 'none'}
            keyboardType={isName ? 'default' : 'phone-pad'}
            textContentType={isName ? 'name' : 'telephoneNumber'}
            maxLength={isName ? 80 : 13}
            returnKeyType="done"
            onSubmitEditing={() => void save()}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {!isName ? <Text style={styles.helper}>Leave empty to remove it.</Text> : null}
          <Pressable style={[styles.primaryBtn, saving && styles.btnDisabled]} disabled={saving} onPress={() => void save()} accessibilityRole="button">
            {saving ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={styles.primaryBtnText}>Save</Text>}
          </Pressable>
          <Pressable style={styles.cancelBtn} onPress={onClose} accessibilityRole="button">
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function OwnerVehiclesCard() {
  const navigation = useNavigation<NativeStackNavigationProp<OwnerStackParamList>>();
  const [vehicles, setVehicles] = useState<OwnerVehicle[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [reload, setReload] = useState(0);
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      fetchOwnerVehicles()
        .then((v) => {
          if (!alive) return;
          setVehicles(v);
          setFailed(false);
        })
        .catch(() => {
          if (!alive) return;
          setFailed(true);
          setVehicles((prev) => prev ?? []);
        });
      return () => {
        alive = false;
      };
    }, [reload]),
  );
  const manage = () => navigation.navigate('MyVehicles');
  const add = () => navigation.navigate('VehicleForm', undefined);
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <Text style={styles.cardTitle} accessibilityRole="header">
          My vehicles
        </Text>
        <Pressable onPress={manage} style={styles.linkBtn} accessibilityRole="button" accessibilityLabel="Manage vehicles">
          <Text style={styles.link}>Manage</Text>
        </Pressable>
      </View>
      <View style={styles.cardBody}>
        {vehicles == null ? (
          <ActivityIndicator style={styles.loader} color={colors.primary} />
        ) : failed && vehicles.length === 0 ? (
          <View style={styles.field}>
            <Text style={styles.helper}>Couldn’t load your vehicles.</Text>
            <Pressable onPress={() => setReload((n) => n + 1)} style={styles.linkRow} accessibilityRole="button">
              <Text style={styles.link}>Try again</Text>
            </Pressable>
          </View>
        ) : vehicles.length === 0 ? (
          <View style={styles.field}>
            <Text style={styles.fieldValue}>No vehicles yet</Text>
            <Text style={styles.helper}>Add one so help requests are faster.</Text>
          </View>
        ) : (
          vehicles.map((v) => (
            <Pressable
              key={v.id}
              style={styles.fieldPress}
              onPress={() => navigation.navigate('VehicleForm', { vehicle: v })}
              accessibilityRole="button"
              accessibilityLabel={`Edit ${vehicleDisplayLabel(v)}${v.is_default ? ', default vehicle' : ''}`}
            >
              <DrawerIcon name="car" color={colors.primary} />
              <View style={styles.flex}>
                <View style={styles.emailRow}>
                  <Text style={[styles.fieldValue, styles.vehicleName]} numberOfLines={1}>
                    {vehicleDisplayLabel(v)}
                  </Text>
                  {v.is_default ? <Text style={[styles.pill, styles.pillDefault]}>Default</Text> : null}
                </View>
                <Text style={styles.helperTight} numberOfLines={1}>
                  {savedVehicleDetailsLine(v) || 'Saved vehicle'}
                </Text>
              </View>
              <DrawerIcon name="pencil" size={18} color={colors.mutedSoft} />
            </Pressable>
          ))
        )}
        <Pressable onPress={add} style={styles.addLink} accessibilityRole="button" accessibilityLabel="Add a vehicle">
          <Text style={styles.link}>+ Add a vehicle</Text>
        </Pressable>
      </View>
    </View>
  );
}

function verificationLabel(status: string | undefined, hasProfile: boolean): { text: string; tone: 'ok' | 'warn' | 'bad' } {
  if (!hasProfile) return { text: 'Not set up', tone: 'warn' };
  switch (status) {
    case 'verified':
      return { text: 'Verified', tone: 'ok' };
    case 'rejected':
      return { text: 'Not approved', tone: 'bad' };
    default:
      return { text: 'Pending review', tone: 'warn' };
  }
}

function MechanicSections() {
  const navigation = useNavigation<NativeStackNavigationProp<MechanicStackParamList>>();
  const { config } = useAppConfig();
  const subscriptionsOn = config?.features?.mechanic_subscriptions ?? false;
  const [listing, setListing] = useState<MechanicResult | null | undefined>(undefined);
  const [sub, setSub] = useState<MechanicSubscriptionDetails | null | undefined>(undefined);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      fetchMyMechanicProfile()
        .then((p) => alive && setListing(p))
        .catch(() => alive && setListing(null));
      fetchMechanicSubscription()
        .then((d) => alive && setSub(d.subscription))
        .catch(() => alive && setSub(null));
      return () => {
        alive = false;
      };
    }, []),
  );

  const status = verificationLabel(listing?.verification_status, !!listing);
  const proActive = sub?.billing_status === 'ACTIVE';
  const expires = sub?.subscription?.expires_at ? new Date(sub.subscription.expires_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : null;

  return (
    <>
      <Card title="Your listing">
        {listing === undefined ? (
          <ActivityIndicator color={colors.primary} style={styles.loader} />
        ) : (
          <>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Verification</Text>
              <Text style={[styles.pill, styles.pillSelf, status.tone === 'ok' ? styles.pillOk : status.tone === 'bad' ? styles.pillBad : styles.pillWarn]}>
                {status.text}
              </Text>
            </View>
            {listing ? (
              <>
                <Field label="Emergency help" value={listing.emergency_available ? 'On — you receive HELP requests' : 'Off'} />
                <Field label="Mobile service" value={listing.mobile_service_available ? 'On — you travel to customers' : 'Off'} />
                <Field label="Work location" value={listing.address?.trim() || (listing.latitude != null ? 'Pin set on map' : 'Not set')} />
              </>
            ) : null}
            <View style={styles.linkPair}>
              <Pressable style={styles.linkBtn} onPress={() => navigation.navigate('MechanicOnboarding')} accessibilityRole="button">
                <Text style={styles.link}>{listing ? 'Edit listing' : 'Set up your listing'}</Text>
              </Pressable>
              {listing ? (
                <Pressable style={styles.linkBtn} onPress={() => navigation.navigate('MechanicWorkLocation')} accessibilityRole="button">
                  <Text style={styles.link}>Work location</Text>
                </Pressable>
              ) : null}
            </View>
          </>
        )}
      </Card>

      {subscriptionsOn ? (
        <Card title="Mechanic Pro">
          {sub === undefined ? (
            <ActivityIndicator color={colors.primary} style={styles.loader} />
          ) : sub === null ? (
            <Text style={styles.helper}>Couldn’t load your plan right now.</Text>
          ) : proActive ? (
            <>
              <Field label="Plan" value={`Pro · Active${expires ? ` · renews ${expires}` : ''}`} />
              <Text style={styles.helper}>Accept eligible HELP requests without using free credits.</Text>
            </>
          ) : (
            <>
              <Field
                label="Free credits"
                value={`${sub.free_credits.remaining} of ${sub.free_credits.total} left`}
              />
              <Text style={styles.helper}>Each accepted HELP request uses 1 free credit.</Text>
            </>
          )}
          <Pressable style={styles.linkBtn} onPress={() => navigation.navigate('MechanicSubscription')} accessibilityRole="button">
            <Text style={styles.link}>{proActive ? 'Manage Mechanic Pro' : 'See Mechanic Pro'}</Text>
          </Pressable>
        </Card>
      ) : null}
    </>
  );
}

function Card({ title, children, onEdit, editLabel }: { title: string; children: React.ReactNode; onEdit?: () => void; editLabel?: string }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <Text style={styles.cardTitle} accessibilityRole="header">
          {title}
        </Text>
        {onEdit ? (
          <Pressable onPress={onEdit} style={styles.editBtn} accessibilityRole="button" accessibilityLabel={editLabel ?? `Edit ${title}`}>
            <DrawerIcon name="pencil" size={20} color={colors.primary} />
          </Pressable>
        ) : null}
      </View>
      <View style={styles.cardBody}>{children}</View>
    </View>
  );
}

function Field({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.field, last && styles.fieldLast]} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  );
}

function AddLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.addLink} accessibilityRole="button">
      <Text style={styles.link}>{label}</Text>
      <DrawerIcon name="pencil" size={16} color={colors.primary} />
    </Pressable>
  );
}

function ActionRow({ icon, label, sub, onPress, last }: { icon: DrawerIconName; label: string; sub: string; onPress: () => void; last?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.actionRow, !last && styles.actionDivider, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={sub}
    >
      <DrawerIcon name={icon} color={colors.primary} />
      <View style={styles.flex}>
        <Text style={styles.actionLabel}>{label}</Text>
        <Text style={styles.helperTight}>{sub}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const GAP = colors.primarySoft;
const BAND = '#e0f2fe';

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: GAP },
  content: { paddingBottom: 40 },
  flex: { flex: 1, minWidth: 0 },
  band: { backgroundColor: BAND, alignItems: 'center', paddingTop: 24, paddingBottom: 20 },
  avatarWrap: { width: 104, height: 104, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 96, height: 96, borderRadius: 48, borderWidth: 4, borderColor: colors.surface, backgroundColor: colors.surfaceMuted },
  avatarInitials: { backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.onPrimary, fontSize: 34, fontWeight: '800' },
  cameraBadge: {
    position: 'absolute',
    right: 2,
    bottom: 4,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bandName: { fontSize: 22, fontWeight: '800', color: colors.text, marginTop: 10, paddingHorizontal: 24, letterSpacing: -0.4 },
  rolePill: {
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  roleText: { fontSize: 12, fontWeight: '700', color: colors.primaryInk },
  card: { backgroundColor: colors.surface, marginTop: 12, marginHorizontal: 12, borderRadius: 16, overflow: 'hidden' },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    minHeight: 52,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  cardTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  editBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: -10 },
  cardBody: { paddingHorizontal: 16, paddingBottom: 6 },
  field: { paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  fieldPress: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: 12,
  },
  fieldLast: { borderBottomWidth: 0 },
  fieldLabel: { fontSize: 13, color: colors.muted, fontWeight: '600' },
  fieldValue: { fontSize: 16, color: colors.text, fontWeight: '600', marginTop: 3 },
  helper: { fontSize: 13, color: colors.muted, marginTop: 4, lineHeight: 18 },
  helperTight: { fontSize: 13, color: colors.muted, marginTop: 1 },
  emailRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pill: {
    fontSize: 11,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: 'hidden',
    marginTop: 3,
  },
  pillSelf: { alignSelf: 'flex-start', marginTop: 6 },
  pillOk: { backgroundColor: colors.liveSoft, color: colors.liveInk },
  pillWarn: { backgroundColor: colors.warnSoft, color: colors.warnInk },
  pillBad: { backgroundColor: colors.dangerSoft, color: colors.dangerInk },
  pillDefault: { backgroundColor: colors.primarySoft, color: colors.primaryInk, marginTop: 3 },
  vehicleName: { flexShrink: 1 },
  link: { fontSize: 15, fontWeight: '700', color: colors.primary },
  linkInline: { color: colors.primary, fontWeight: '700' },
  linkRow: { minHeight: 44, justifyContent: 'center' },
  addLink: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 },
  linkPair: { flexDirection: 'row', gap: 20 },
  linkBtn: { minHeight: 44, justifyContent: 'center' },
  loader: { marginVertical: 16 },
  vehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 60, paddingVertical: 8 },
  actionDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  actionLabel: { fontSize: 16, fontWeight: '700', color: colors.text },
  chevron: { fontSize: 24, color: colors.mutedSoft },
  pressed: { opacity: 0.6 },
  textAction: {
    minHeight: 52,
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 32,
  },
  sheetHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 12 },
  sheetTitle: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 14 },
  input: {
    minHeight: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    fontSize: 17,
    color: colors.text,
    marginTop: 6,
  },
  inputError: { borderColor: colors.danger },
  error: { fontSize: 13, color: colors.danger, marginTop: 6, fontWeight: '600' },
  primaryBtn: {
    marginTop: 18,
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: colors.onPrimary, fontSize: 16, fontWeight: '800' },
  cancelBtn: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  cancelText: { fontSize: 15, fontWeight: '700', color: colors.muted },
});
