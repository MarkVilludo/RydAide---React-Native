import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { getApiErrorMessage } from '../../api/client';
import { createWallet, updateWallet, type WalletType } from '../../api/paymentMethods';
import { KeyboardAwareScrollView } from '../../components/KeyboardAwareScrollView';
import { showAppToast } from '../../components/AppToast';
import type { PaymentMethodsParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';
import { protectedImageSource } from '../../utils/protectedImage';
import {
  WALLET_TYPES,
  formatMobileInput,
  isMobileWallet,
  normalizeMobile,
  walletFormErrors,
  type WalletFormErrors,
} from '../../utils/paymentMethods';

type Props = NativeStackScreenProps<PaymentMethodsParamList, 'PaymentMethodForm'>;

type PickedQr = { uri: string; mimeType?: string | null; fileName?: string | null; fileSize?: number | null };

const ALLOWED_QR_MIME = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

/** Add or edit one wallet: type, account name, number and an optional QR screenshot. */
export function PaymentMethodFormScreen({ navigation, route }: Props) {
  const editing = route.params?.wallet ?? null;
  const maxQrMb = route.params?.maxQrMb ?? 5;

  const [type, setType] = useState<WalletType | null>(editing?.type ?? null);
  const [providerName, setProviderName] = useState(editing?.provider_name ?? '');
  const [accountName, setAccountName] = useState(editing?.account_name ?? '');
  const [accountNumber, setAccountNumber] = useState(
    editing?.account_number
      ? editing.type === 'OTHER'
        ? editing.account_number
        : formatMobileInput(editing.account_number)
      : '',
  );
  const [qr, setQr] = useState<PickedQr | null>(null);
  const [removeQr, setRemoveQr] = useState(false);
  const [preferred, setPreferred] = useState(editing?.is_preferred ?? route.params?.firstWallet ?? false);
  const [showErrors, setShowErrors] = useState(false);
  const [serverErrors, setServerErrors] = useState<WalletFormErrors>({});
  const [saving, setSaving] = useState(false);

  const typeMeta = WALLET_TYPES.find((t) => t.value === type) ?? null;
  // Saved QR is private: load it through the authenticated endpoint. A newly picked file is local.
  const existingQrSource = editing?.qr_url && !removeQr ? protectedImageSource(editing.qr_url) : null;
  const previewSource = qr?.uri ? { uri: qr.uri } : existingQrSource;

  const errors = useMemo(
    () => ({ ...walletFormErrors({ type, providerName, accountName, accountNumber }), ...serverErrors }),
    [type, providerName, accountName, accountNumber, serverErrors],
  );
  const visibleErrors: WalletFormErrors = showErrors ? errors : serverErrors;

  const clearServerError = (key: keyof WalletFormErrors) => {
    if (serverErrors[key]) setServerErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const pickQr = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo access to upload a screenshot of your QR code.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: false,
      quality: 0.9,
    });
    if (result.canceled || !result.assets[0]?.uri) return;
    const asset = result.assets[0];
    const mime = (asset.mimeType ?? '').toLowerCase();
    if (mime && !ALLOWED_QR_MIME.includes(mime)) {
      setServerErrors((prev) => ({ ...prev, qr: 'The QR code must be a JPG, PNG or WebP image.' }));
      return;
    }
    if (asset.fileSize != null && asset.fileSize > maxQrMb * 1024 * 1024) {
      setServerErrors((prev) => ({ ...prev, qr: `The QR image is too large. Use an image under ${maxQrMb} MB.` }));
      return;
    }
    if (asset.width && asset.height && (asset.width < 120 || asset.height < 120)) {
      setServerErrors((prev) => ({ ...prev, qr: 'The QR image is too small to scan. Use a clearer screenshot.' }));
      return;
    }
    clearServerError('qr');
    setRemoveQr(false);
    setQr({ uri: asset.uri, mimeType: asset.mimeType, fileName: asset.fileName, fileSize: asset.fileSize });
  };

  const onRemoveQr = () => {
    if (qr) {
      setQr(null);
      return;
    }
    if (editing?.qr_url) {
      Alert.alert('Remove QR code?', 'People paying you will only see your account name and number.', [
        { text: 'Keep', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => setRemoveQr(true) },
      ]);
    }
  };

  const save = async () => {
    setShowErrors(true);
    const local = walletFormErrors({ type, providerName, accountName, accountNumber });
    if (Object.keys(local).length > 0 || !type) return;

    const number = isMobileWallet(type) ? normalizeMobile(accountNumber) ?? accountNumber : accountNumber.trim();
    const input = {
      type,
      provider_name: type === 'OTHER' ? providerName.trim() : undefined,
      account_name: accountName.trim(),
      account_number: number,
      qr,
      remove_qr: removeQr && !qr,
      is_preferred: preferred,
    };

    setSaving(true);
    setServerErrors({});
    try {
      if (editing) {
        await updateWallet(editing.id, input);
        showAppToast('Wallet updated.');
      } else {
        await createWallet(input);
        showAppToast('Wallet saved.');
      }
      navigation.goBack();
    } catch (e) {
      const fieldErrors = extractFieldErrors(e);
      if (Object.keys(fieldErrors).length > 0) {
        setServerErrors(fieldErrors);
      } else {
        Alert.alert('Could not save', getApiErrorMessage(e));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAwareScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.label}>Wallet</Text>
      <View style={styles.typeRow}>
        {WALLET_TYPES.map((t) => {
          const on = type === t.value;
          return (
            <Pressable
              key={t.value}
              style={[styles.typeTile, on && styles.typeTileOn]}
              onPress={() => {
                setType(t.value);
                clearServerError('type');
                if (t.value !== 'OTHER' && accountNumber) setAccountNumber(formatMobileInput(accountNumber));
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
            >
              <Text style={styles.typeIcon}>{t.icon}</Text>
              <Text style={[styles.typeLabel, on && styles.typeLabelOn]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {visibleErrors.type ? <Text style={styles.error}>{visibleErrors.type}</Text> : null}

      {type === 'OTHER' ? (
        <>
          <Text style={styles.label}>Wallet or bank name</Text>
          <TextInput
            style={[styles.input, visibleErrors.providerName && styles.inputError]}
            value={providerName}
            onChangeText={(v) => {
              setProviderName(v);
              clearServerError('providerName');
            }}
            placeholder="e.g. ShopeePay, GoTyme, BPI"
            placeholderTextColor={colors.mutedSoft}
            autoCapitalize="words"
            maxLength={40}
          />
          {visibleErrors.providerName ? <Text style={styles.error}>{visibleErrors.providerName}</Text> : null}
        </>
      ) : null}

      <Text style={styles.label}>Account name</Text>
      <TextInput
        style={[styles.input, visibleErrors.accountName && styles.inputError]}
        value={accountName}
        onChangeText={(v) => {
          setAccountName(v);
          clearServerError('accountName');
        }}
        placeholder="e.g. Juan Dela Cruz"
        placeholderTextColor={colors.mutedSoft}
        autoCapitalize="words"
        textContentType="name"
        maxLength={80}
      />
      <Text style={styles.hint}>As it appears in your wallet app, so the payer can confirm it's you.</Text>
      {visibleErrors.accountName ? <Text style={styles.error}>{visibleErrors.accountName}</Text> : null}

      <Text style={styles.label}>{typeMeta?.numberLabel ?? 'Account or mobile number'}</Text>
      <TextInput
        style={[styles.input, visibleErrors.accountNumber && styles.inputError]}
        value={accountNumber}
        onChangeText={(v) => {
          setAccountNumber(type && isMobileWallet(type) ? formatMobileInput(v) : v.toUpperCase());
          clearServerError('accountNumber');
        }}
        placeholder={typeMeta?.numberPlaceholder ?? '0917 123 4567'}
        placeholderTextColor={colors.mutedSoft}
        keyboardType={type === 'OTHER' ? 'default' : 'phone-pad'}
        autoCapitalize="characters"
        textContentType={type === 'OTHER' ? 'none' : 'telephoneNumber'}
        maxLength={type === 'OTHER' ? 34 : 13}
      />
      {visibleErrors.accountNumber ? <Text style={styles.error}>{visibleErrors.accountNumber}</Text> : null}

      <Text style={styles.label}>QR code (optional)</Text>
      {previewSource ? (
        <View style={styles.qrBox}>
          <Image source={previewSource} style={styles.qrPreview} resizeMode="contain" accessibilityLabel="QR code preview" />
          <View style={styles.qrActions}>
            <Pressable style={styles.secondaryBtn} onPress={() => void pickQr()}>
              <Text style={styles.secondaryBtnText}>Replace</Text>
            </Pressable>
            <Pressable style={styles.secondaryBtn} onPress={onRemoveQr}>
              <Text style={[styles.secondaryBtnText, styles.dangerText]}>Remove</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable style={styles.qrUpload} onPress={() => void pickQr()} accessibilityRole="button">
          <Text style={styles.qrUploadIcon}>🔳</Text>
          <Text style={styles.qrUploadTitle}>Upload QR screenshot</Text>
          <Text style={styles.qrUploadHint}>JPG, PNG or WebP · up to {maxQrMb} MB. Open your wallet app → Receive / My QR → screenshot.</Text>
        </Pressable>
      )}
      {visibleErrors.qr ? <Text style={styles.error}>{visibleErrors.qr}</Text> : null}

      <View style={styles.switchRow}>
        <View style={styles.flex}>
          <Text style={styles.switchTitle}>Set as preferred</Text>
          <Text style={styles.hint}>Shown first on your help requests and jobs. Cash stays available.</Text>
        </View>
        <Switch value={preferred} onValueChange={setPreferred} />
      </View>

      <Pressable style={[styles.primaryBtn, saving && styles.btnDisabled]} disabled={saving} onPress={() => void save()}>
        {saving ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={styles.primaryBtnText}>{editing ? 'Save changes' : 'Save wallet'}</Text>}
      </Pressable>
      <Text style={styles.privacy}>
        Your full number and QR are shown only to the person on your active or completed job. RydAid never moves money.
      </Text>
    </KeyboardAwareScrollView>
  );
}

const FIELD_MAP: Record<string, keyof WalletFormErrors> = {
  type: 'type',
  provider_name: 'providerName',
  account_name: 'accountName',
  account_number: 'accountNumber',
  qr: 'qr',
};

function extractFieldErrors(e: unknown): WalletFormErrors {
  const data = (e as { response?: { status?: number; data?: { errors?: Record<string, string[]> } } })?.response;
  if (data?.status !== 422 || !data.data?.errors) return {};
  const out: WalletFormErrors = {};
  for (const [key, messages] of Object.entries(data.data.errors)) {
    const field = FIELD_MAP[key];
    if (field && messages?.[0]) out[field] = messages[0];
  }
  return out;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 48 },
  flex: { flex: 1, minWidth: 0 },
  label: { fontSize: 14, fontWeight: '700', color: colors.text, marginTop: 16, marginBottom: 6 },
  hint: { fontSize: 12, color: colors.muted, marginTop: 4, lineHeight: 17 },
  error: { fontSize: 13, color: colors.danger, marginTop: 6, fontWeight: '600' },
  typeRow: { flexDirection: 'row', gap: 10 },
  typeTile: {
    flex: 1,
    minHeight: 72,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  typeTileOn: { borderColor: colors.primary, borderWidth: 2, backgroundColor: colors.primarySoft },
  typeIcon: { fontSize: 22 },
  typeLabel: { fontSize: 14, fontWeight: '700', color: colors.text },
  typeLabelOn: { color: colors.primaryInk },
  input: {
    minHeight: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    fontSize: 16,
    color: colors.text,
  },
  inputError: { borderColor: colors.danger },
  qrUpload: {
    alignItems: 'center',
    padding: 18,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.primaryBorder,
    backgroundColor: colors.primarySoft,
  },
  qrUploadIcon: { fontSize: 28 },
  qrUploadTitle: { fontSize: 15, fontWeight: '800', color: colors.primaryInk, marginTop: 4 },
  qrUploadHint: { fontSize: 12, color: colors.muted, textAlign: 'center', marginTop: 4, lineHeight: 17 },
  qrBox: {
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  qrPreview: { width: 200, height: 200, borderRadius: 8, backgroundColor: colors.surfaceMuted },
  qrActions: { flexDirection: 'row', gap: 10, marginTop: 10 },
  secondaryBtn: {
    minHeight: 40,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
  },
  secondaryBtnText: { fontSize: 14, fontWeight: '700', color: colors.primary },
  dangerText: { color: colors.danger },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 20,
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  switchTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  primaryBtn: {
    marginTop: 22,
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: colors.onPrimary, fontSize: 16, fontWeight: '800' },
  privacy: { fontSize: 12, color: colors.muted, textAlign: 'center', marginTop: 12, lineHeight: 17 },
});
