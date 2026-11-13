import { StatusBar } from 'expo-status-bar';
import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  Keyboard,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type KeyboardEvent,
  type ScrollViewInstance,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LAUNCH_BACKGROUND, LAUNCH_LOGO } from '../../constants/launchBrand';
import { colors, spacing, type } from '../../theme/tokens';
import type { KeyboardAwareScrollViewRef } from '../KeyboardAwareScrollView';

export const AUTH_TAGLINE = 'Roadside help, anytime';

/** Brand area minimum below the status bar (includes the 20 dp the sheet overlaps). */
export const BRAND_MIN = 128;
/** From this window height up the brand uses the stacked layout (big logo + skyline). */
export const TALL_SCREEN = 700;
/** The white sheet overlaps the brand area by this much. */
export const SHEET_OVERLAP = 20;
/** Visible strip while the keyboard is open (logo only). */
const COLLAPSED_STRIP = 56;

type Props = {
  /** Sheet heading. Omit to start the sheet directly with the form (sign in). */
  title?: string;
  /** One short line under the title. */
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  /** One muted line pinned to the bottom (hidden while typing). */
  footer?: React.ReactNode;
  /** White "‹ Back" in the brand area. */
  onBack?: () => void;
  /** Y of the form (children) inside the scroll content — add a field's own y to scroll it into view. */
  onFormLayout?: (y: number) => void;
  /** Extra scrollable space under the form while the keyboard is open. */
  extraBottomPadding?: number;
};

/**
 * Branded auth frame shared by sign in, register, verify, forgot and reset.
 *
 * Vertical distribution (keyboard closed):
 * - the white sheet takes exactly its natural height (20 dp top padding, form, footer) and sits at the
 *   bottom — no spacer inside it, so there's never a gap above the first field or below the last;
 * - the blue brand area flex-grows into ALL the leftover height (min 128 dp + status bar);
 * - if the form is taller than the space, the brand stays at its min and the sheet scrolls.
 * Keyboard open: the brand collapses to a 56 dp logo strip and the sheet is padded by the keyboard overlap.
 */
export const AuthLayout = forwardRef<KeyboardAwareScrollViewRef, Props>(function AuthLayout(
  { title, subtitle, children, footer, onBack, onFormLayout, extraBottomPadding = 0 },
  ref,
) {
  const insets = useSafeAreaInsets();
  const { height: windowH } = useWindowDimensions();
  const scrollRef = useRef<ScrollViewInstance | null>(null);
  const windowHRef = useRef(windowH);
  windowHRef.current = windowH;
  const [kb, setKb] = useState<{ open: boolean; overlap: number }>({ open: false, overlap: 0 });
  const enter = useRef(new Animated.Value(0)).current;
  const formY = useRef(0);
  const innerY = useRef(0);
  const reportForm = () => onFormLayout?.(formY.current + innerY.current);

  useImperativeHandle(
    ref,
    () => ({
      scrollToEnd: (o) => scrollRef.current?.scrollToEnd(o),
      scrollTo: (o) => scrollRef.current?.scrollTo({ x: 0, y: Math.max(0, o.y), animated: o.animated ?? true }),
    }),
    [],
  );

  // Sheet entrance: slide up 12 dp + fade, 250 ms.
  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 250, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [enter]);

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const anim = () => LayoutAnimation.configureNext(LayoutAnimation.create(200, 'easeInEaseOut', 'opacity'));
    const a = Keyboard.addListener(showEvt, (e: KeyboardEvent) => {
      anim();
      // 0 when Android already resized the window above the keyboard.
      setKb({ open: true, overlap: Math.max(0, windowHRef.current - e.endCoordinates.screenY) });
    });
    const b = Keyboard.addListener(hideEvt, () => {
      anim();
      setKb({ open: false, overlap: 0 });
    });
    return () => {
      a.remove();
      b.remove();
    };
  }, []);

  const tall = windowH >= TALL_SCREEN;
  const brandMin = insets.top + BRAND_MIN;
  const logo = windowH >= 800 ? 72 : 64;
  const brandStyle = kb.open
    ? { height: insets.top + COLLAPSED_STRIP + SHEET_OVERLAP, flexGrow: 0 }
    : { minHeight: brandMin, flexGrow: 1, flexBasis: brandMin };
  const bottomPad = kb.open ? kb.overlap + spacing.lg + extraBottomPadding : 0;

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <View style={[styles.brand, brandStyle, { paddingTop: insets.top }]}>
        <BrandArt illustrated={tall && !kb.open} />
        {onBack ? (
          <Pressable
            onPress={onBack}
            style={[styles.back, { top: insets.top + 4 }]}
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={8}
          >
            <Text style={styles.backText}>‹ Back</Text>
          </Pressable>
        ) : null}
        <View style={styles.brandContent}>
          {kb.open ? (
            <Image source={LAUNCH_LOGO} style={styles.logoMini} resizeMode="contain" fadeDuration={0} accessible accessibilityLabel="RydAid" />
          ) : tall ? (
            <View style={styles.stack}>
              <Image source={LAUNCH_LOGO} style={{ width: logo, height: logo }} resizeMode="contain" fadeDuration={0} accessible={false} />
              <Text style={styles.wordTall} accessibilityRole="header">
                RydAid
              </Text>
              <Text style={styles.tagline} numberOfLines={1}>
                {AUTH_TAGLINE}
              </Text>
            </View>
          ) : (
            <View style={styles.row}>
              <Image source={LAUNCH_LOGO} style={styles.logoRow} resizeMode="contain" fadeDuration={0} accessible={false} />
              <View style={styles.rowText}>
                <Text style={styles.word} accessibilityRole="header">
                  RydAid
                </Text>
                <Text style={styles.tagline} numberOfLines={1}>
                  {AUTH_TAGLINE}
                </Text>
              </View>
            </View>
          )}
        </View>
      </View>

      <Animated.View
        style={[
          styles.sheet,
          kb.open ? styles.sheetKeyboard : styles.sheetFit,
          { opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] },
        ]}
      >
        <ScrollView
          ref={scrollRef}
          // Hug the content (no grow) so the sheet is exactly form + footer; scrolls only if it can't fit.
          style={kb.open ? styles.scrollFill : styles.scrollFit}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}
        >
          <View
            style={styles.form}
            onLayout={(e) => {
              formY.current = e.nativeEvent.layout.y;
              reportForm();
            }}
          >
            {title ? (
              <Text style={styles.title} accessibilityRole="header">
                {title}
              </Text>
            ) : null}
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            <View
              onLayout={(e) => {
                innerY.current = e.nativeEvent.layout.y;
                reportForm();
              }}
            >
              {children}
            </View>
          </View>
          {footer && !kb.open ? (
            <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>{footer}</View>
          ) : null}
        </ScrollView>
      </Animated.View>
    </View>
  );
});

/** Lighter sheen (gradient feel without a gradient package); on tall screens also a skyline over a curved road. */
function BrandArt({ illustrated }: { illustrated: boolean }) {
  const blocks = [
    { w: 18, h: 22 }, { w: 12, h: 38 }, { w: 22, h: 28 }, { w: 10, h: 46 }, { w: 20, h: 20 }, { w: 14, h: 34 },
    { w: 24, h: 26 }, { w: 12, h: 42 }, { w: 18, h: 18 }, { w: 26, h: 32 }, { w: 14, h: 24 }, { w: 20, h: 40 },
    { w: 16, h: 22 }, { w: 22, h: 36 }, { w: 12, h: 28 }, { w: 24, h: 20 },
  ];
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={styles.sheen} />
      {illustrated ? (
        <>
          <View style={styles.skyline}>
            {blocks.map((b, i) => (
              <View key={i} style={[styles.bld, { width: b.w, height: b.h }]} />
            ))}
          </View>
          <View style={styles.roadOuter} />
          <View style={styles.roadInner} />
        </>
      ) : (
        <View style={styles.roadOuter} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: LAUNCH_BACKGROUND },
  brand: { backgroundColor: LAUNCH_BACKGROUND, overflow: 'hidden' },
  sheen: {
    position: 'absolute',
    top: -160,
    right: -100,
    width: 340,
    height: 340,
    borderRadius: 170,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  skyline: {
    position: 'absolute',
    left: -4,
    right: -4,
    bottom: SHEET_OVERLAP + 10,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    opacity: 0.9,
  },
  bld: { backgroundColor: 'rgba(255,255,255,0.09)', borderTopLeftRadius: 2, borderTopRightRadius: 2 },
  roadOuter: {
    position: 'absolute',
    left: -120,
    bottom: -300,
    width: 560,
    height: 360,
    borderRadius: 280,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  roadInner: {
    position: 'absolute',
    left: -80,
    bottom: -318,
    width: 560,
    height: 360,
    borderRadius: 280,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  back: { position: 'absolute', left: spacing.sm, minHeight: 44, minWidth: 64, justifyContent: 'center', paddingHorizontal: spacing.sm, zIndex: 2 },
  backText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  brandContent: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xxl, marginBottom: SHEET_OVERLAP },
  stack: { alignItems: 'center' },
  wordTall: { marginTop: spacing.md, fontSize: 28, lineHeight: 32, fontWeight: '800', color: '#ffffff', letterSpacing: -0.4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowText: { flexShrink: 1 },
  logoRow: { width: 48, height: 48 },
  logoMini: { width: 32, height: 32 },
  word: { fontSize: 24, lineHeight: 28, fontWeight: '800', color: '#ffffff', letterSpacing: -0.3 },
  tagline: { fontSize: 14, lineHeight: 18, fontWeight: '600', color: '#e0f2fe', marginTop: 2 },
  sheet: {
    marginTop: -SHEET_OVERLAP,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  // Natural height (never grows); shrinks + scrolls only when the form doesn't fit.
  sheetFit: { flexGrow: 0, flexShrink: 1, minHeight: 0 },
  sheetKeyboard: { flex: 1 },
  content: { flexGrow: 0 },
  scrollFit: { flexGrow: 0, flexShrink: 1 },
  scrollFill: { flex: 1 },
  form: { width: '100%', maxWidth: 440, alignSelf: 'center', paddingHorizontal: spacing.xl, paddingTop: spacing.xl },
  title: { ...type.title, fontSize: 22, lineHeight: 28 },
  subtitle: { fontSize: 14, lineHeight: 20, color: colors.muted, marginTop: spacing.xs },
  footer: { paddingTop: spacing.md, paddingHorizontal: spacing.xl, alignItems: 'center' },
});

/** Shared bits for auth forms (8-pt grid). */
export const authStyles = StyleSheet.create({
  fields: { marginTop: spacing.md },
  primary: { marginTop: spacing.xs },
  banner: {
    padding: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    marginTop: spacing.md,
  },
  bannerText: { color: colors.dangerInk, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  linkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm },
  linkRowText: { fontSize: 14, color: colors.muted },
  /** Footer: one small muted line of links. */
  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' },
  footerLink: { minHeight: 32, justifyContent: 'center', paddingHorizontal: spacing.xs },
  footerText: { fontSize: 12, color: colors.muted },
  footerDot: { fontSize: 12, color: colors.mutedSoft },
  devHint: { fontSize: 10, color: colors.mutedSoft, textAlign: 'center', marginTop: 2 },
});
