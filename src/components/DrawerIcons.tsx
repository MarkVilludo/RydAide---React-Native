import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { colors } from '../theme/colors';

/**
 * 24×24 outline icons drawn with Views (no icon/SVG package in the app).
 * Stroke 2px; `bg` must match the row background where a shape masks a line.
 */
export type DrawerIconName =
  | 'home'
  | 'history'
  | 'search'
  | 'store'
  | 'dashboard'
  | 'requests'
  | 'pin'
  | 'listing'
  | 'card'
  | 'pro'
  | 'support'
  | 'logout'
  | 'trash'
  | 'phone'
  | 'mail'
  | 'chat'
  | 'faq'
  | 'wallet'
  | 'headset'
  | 'wrench'
  | 'toolbox'
  | 'crown'
  | 'map'
  | 'pencil'
  | 'car'
  | 'shield'
  | 'user'
  | 'camera'
  | 'menu'
  | 'lock'
  | 'eye'
  | 'eyeOff';

type Props = { name: DrawerIconName; color?: string; bg?: string; size?: number };

const S = 2; // stroke

function Box({ style }: { style: ViewStyle }) {
  return <View style={[{ position: 'absolute' }, style]} />;
}

export function DrawerIcon({ name, color = colors.text, bg = colors.surface, size = 24 }: Props) {
  const scale = size / 24;
  const line = (s: ViewStyle) => <Box style={{ backgroundColor: color, ...s }} />;
  const outline = (s: ViewStyle) => <Box style={{ borderColor: color, borderWidth: S, ...s }} />;

  let parts: React.ReactNode;
  switch (name) {
    case 'home':
      parts = (
        <>
          {outline({ left: 5, top: 4, width: 14, height: 14, borderRightWidth: 0, borderBottomWidth: 0, transform: [{ rotate: '45deg' }] })}
          {outline({ left: 5, top: 11, width: 14, height: 10, borderTopWidth: 0, borderBottomLeftRadius: 2, borderBottomRightRadius: 2 })}
          {outline({ left: 10, top: 15, width: 4, height: 6, borderBottomWidth: 0 })}
        </>
      );
      break;
    case 'history':
      parts = (
        <>
          {outline({ left: 2, top: 2, width: 20, height: 20, borderRadius: 10 })}
          {line({ left: 11, top: 6, width: S, height: 7 })}
          {line({ left: 11, top: 11, width: 6, height: S })}
          {line({ left: 0, top: 9, width: 6, height: 5, backgroundColor: bg })}
          {outline({ left: 0, top: 6, width: 5, height: 5, borderTopWidth: 0, borderLeftWidth: 0, transform: [{ rotate: '45deg' }] })}
        </>
      );
      break;
    case 'search':
      parts = (
        <>
          {outline({ left: 2, top: 2, width: 15, height: 15, borderRadius: 8 })}
          {line({ left: 17, top: 13, width: S, height: 9, transform: [{ rotate: '-45deg' }] })}
        </>
      );
      break;
    case 'store':
      parts = (
        <>
          {outline({ left: 2, top: 3, width: 20, height: 7, borderRadius: 2 })}
          {outline({ left: 4, top: 9, width: 16, height: 12, borderTopWidth: 0 })}
          {outline({ left: 10, top: 14, width: 5, height: 7, borderBottomWidth: 0 })}
        </>
      );
      break;
    case 'dashboard':
      parts = (
        <>
          {outline({ left: 2, top: 2, width: 9, height: 9, borderRadius: 2 })}
          {outline({ left: 13, top: 2, width: 9, height: 9, borderRadius: 2 })}
          {outline({ left: 2, top: 13, width: 9, height: 9, borderRadius: 2 })}
          {outline({ left: 13, top: 13, width: 9, height: 9, borderRadius: 2 })}
        </>
      );
      break;
    case 'requests':
      parts = (
        <>
          {outline({ left: 4, top: 4, width: 16, height: 18, borderRadius: 3 })}
          {outline({ left: 8, top: 2, width: 8, height: 5, borderRadius: 2, backgroundColor: bg })}
          {line({ left: 8, top: 11, width: 8, height: S })}
          {line({ left: 8, top: 15, width: 6, height: S })}
        </>
      );
      break;
    case 'pin':
      parts = (
        <>
          {outline({ left: 5, top: 2, width: 14, height: 14, borderTopLeftRadius: 7, borderTopRightRadius: 7, borderBottomLeftRadius: 7, transform: [{ rotate: '45deg' }] })}
          {outline({ left: 10, top: 7, width: 4, height: 4, borderRadius: 2 })}
        </>
      );
      break;
    case 'listing':
      parts = (
        <>
          {outline({ left: 2, top: 4, width: 20, height: 16, borderRadius: 3 })}
          {outline({ left: 5, top: 8, width: 6, height: 6, borderRadius: 3 })}
          {line({ left: 13, top: 9, width: 6, height: S })}
          {line({ left: 13, top: 13, width: 4, height: S })}
          {line({ left: 5, top: 16, width: 6, height: S })}
        </>
      );
      break;
    case 'card':
      parts = (
        <>
          {outline({ left: 2, top: 5, width: 20, height: 14, borderRadius: 3 })}
          {line({ left: 2, top: 9, width: 20, height: S })}
          {line({ left: 5, top: 14, width: 5, height: S })}
        </>
      );
      break;
    case 'pro':
      parts = (
        <>
          {outline({ left: 5, top: 5, width: 14, height: 14, borderRadius: 2, transform: [{ rotate: '45deg' }] })}
          {line({ left: 9, top: 9, width: 6, height: 6, borderRadius: 1, transform: [{ rotate: '45deg' }] })}
        </>
      );
      break;
    case 'support':
    case 'chat':
      parts = (
        <>
          {outline({ left: 2, top: 3, width: 20, height: 15, borderRadius: 6 })}
          {outline({ left: 6, top: 14, width: 6, height: 6, borderTopWidth: 0, borderLeftWidth: 0, backgroundColor: bg, transform: [{ rotate: '45deg' }] })}
          {line({ left: 7, top: 9, width: S + 1, height: S + 1, borderRadius: 2 })}
          {line({ left: 11, top: 9, width: S + 1, height: S + 1, borderRadius: 2 })}
          {line({ left: 15, top: 9, width: S + 1, height: S + 1, borderRadius: 2 })}
        </>
      );
      break;
    case 'menu':
      parts = (
        <>
          {line({ left: 3, top: 5, width: 18, height: S, borderRadius: 1 })}
          {line({ left: 3, top: 11, width: 18, height: S, borderRadius: 1 })}
          {line({ left: 3, top: 17, width: 18, height: S, borderRadius: 1 })}
        </>
      );
      break;
    case 'logout':
      parts = (
        <>
          {outline({ left: 3, top: 3, width: 10, height: 18, borderRightWidth: 0, borderTopLeftRadius: 3, borderBottomLeftRadius: 3 })}
          {line({ left: 9, top: 11, width: 12, height: S })}
          {outline({ left: 14, top: 8, width: 7, height: 7, borderLeftWidth: 0, borderBottomWidth: 0, transform: [{ rotate: '45deg' }] })}
        </>
      );
      break;
    case 'trash':
      parts = (
        <>
          {line({ left: 3, top: 5, width: 18, height: S })}
          {outline({ left: 9, top: 2, width: 6, height: 4, borderBottomWidth: 0, borderTopLeftRadius: 2, borderTopRightRadius: 2 })}
          {outline({ left: 5, top: 7, width: 14, height: 15, borderTopWidth: 0, borderBottomLeftRadius: 3, borderBottomRightRadius: 3 })}
          {line({ left: 10, top: 10, width: S, height: 8 })}
          {line({ left: 13, top: 10, width: S, height: 8 })}
        </>
      );
      break;
    case 'phone':
      parts = (
        <>
          {outline({ left: 6, top: 2, width: 12, height: 20, borderRadius: 3 })}
          {line({ left: 10, top: 18, width: 4, height: S, borderRadius: 1 })}
        </>
      );
      break;
    case 'mail':
      parts = (
        <>
          {outline({ left: 2, top: 5, width: 20, height: 14, borderRadius: 3 })}
          {outline({ left: 6, top: 2, width: 12, height: 12, borderTopWidth: 0, borderLeftWidth: 0, transform: [{ rotate: '45deg' }] })}
        </>
      );
      break;
    case 'faq':
      parts = (
        <>
          {outline({ left: 2, top: 2, width: 20, height: 20, borderRadius: 10 })}
          {outline({ left: 8, top: 6, width: 8, height: 7, borderRadius: 4, borderBottomWidth: 0, borderLeftWidth: 0 })}
          {line({ left: 11, top: 12, width: S, height: 3 })}
          {line({ left: 11, top: 17, width: S, height: S, borderRadius: 1 })}
        </>
      );
      break;
    case 'wallet':
      parts = (
        <>
          {outline({ left: 5, top: 2, width: 14, height: 7, borderBottomWidth: 0, borderTopLeftRadius: 2, borderTopRightRadius: 2 })}
          {outline({ left: 2, top: 6, width: 20, height: 15, borderRadius: 3, backgroundColor: bg })}
          {outline({ left: 14, top: 11, width: 8, height: 6, borderRightWidth: 0, borderTopLeftRadius: 3, borderBottomLeftRadius: 3 })}
          {line({ left: 16, top: 13, width: S, height: S, borderRadius: 1 })}
        </>
      );
      break;
    case 'headset':
      parts = (
        <>
          {outline({ left: 3, top: 2, width: 18, height: 18, borderRadius: 9, borderBottomColor: 'transparent' })}
          {line({ left: 2, top: 11, width: 5, height: 8, borderRadius: 2 })}
          {line({ left: 17, top: 11, width: 5, height: 8, borderRadius: 2 })}
          {line({ left: 17, top: 19, width: S, height: 3 })}
          {line({ left: 12, top: 21, width: 7, height: S, borderRadius: 1 })}
        </>
      );
      break;
    case 'wrench':
      parts = (
        <>
          {line({ left: 7, top: 8, width: S + 1, height: 15, borderRadius: 2, transform: [{ rotate: '45deg' }] })}
          {outline({ left: 11, top: 2, width: 11, height: 11, borderRadius: 6, backgroundColor: bg })}
          {line({ left: 16, top: 0, width: 5, height: 7, backgroundColor: bg, transform: [{ rotate: '45deg' }] })}
        </>
      );
      break;
    case 'toolbox':
      parts = (
        <>
          {outline({ left: 8, top: 3, width: 8, height: 6, borderBottomWidth: 0, borderTopLeftRadius: 2, borderTopRightRadius: 2 })}
          {outline({ left: 2, top: 8, width: 20, height: 13, borderRadius: 3 })}
          {line({ left: 2, top: 13, width: 20, height: S })}
          {line({ left: 10, top: 11, width: 4, height: 6, borderRadius: 1 })}
        </>
      );
      break;
    case 'crown':
      parts = (
        <>
          {outline({ left: 4, top: 11, width: 16, height: 8, borderTopWidth: 0, borderBottomLeftRadius: 2, borderBottomRightRadius: 2 })}
          {outline({ left: 2, top: 8, width: 7, height: 7, borderRightWidth: 0, borderBottomWidth: 0, transform: [{ rotate: '45deg' }] })}
          {outline({ left: 8.5, top: 4, width: 7, height: 7, borderRightWidth: 0, borderBottomWidth: 0, transform: [{ rotate: '45deg' }] })}
          {outline({ left: 15, top: 8, width: 7, height: 7, borderRightWidth: 0, borderBottomWidth: 0, transform: [{ rotate: '45deg' }] })}
          {line({ left: 4, top: 21, width: 16, height: S, borderRadius: 1 })}
        </>
      );
      break;
    case 'map':
      parts = (
        <>
          {outline({ left: 2, top: 4, width: 20, height: 16, borderRadius: 2 })}
          {line({ left: 8, top: 4, width: S, height: 16 })}
          {line({ left: 14, top: 4, width: S, height: 16 })}
          {outline({ left: 15, top: 7, width: 6, height: 6, borderTopLeftRadius: 3, borderTopRightRadius: 3, borderBottomLeftRadius: 3, backgroundColor: bg, transform: [{ rotate: '45deg' }] })}
        </>
      );
      break;
    case 'pencil':
      parts = (
        <>
          {outline({ left: 9, top: 1, width: 6, height: 20, borderRadius: 1, transform: [{ rotate: '45deg' }] })}
          {line({ left: 3, top: 19, width: 4, height: S })}
        </>
      );
      break;
    case 'car':
      parts = (
        <>
          {outline({ left: 5, top: 5, width: 14, height: 8, borderBottomWidth: 0, borderTopLeftRadius: 4, borderTopRightRadius: 4 })}
          {outline({ left: 2, top: 11, width: 20, height: 7, borderRadius: 3 })}
          {outline({ left: 4, top: 16, width: 5, height: 5, borderRadius: 3, backgroundColor: bg })}
          {outline({ left: 15, top: 16, width: 5, height: 5, borderRadius: 3, backgroundColor: bg })}
        </>
      );
      break;
    case 'shield':
      parts = (
        <>
          {outline({ left: 4, top: 2, width: 16, height: 14, borderBottomWidth: 0, borderTopLeftRadius: 3, borderTopRightRadius: 3 })}
          {outline({ left: 6, top: 9, width: 12, height: 12, borderTopWidth: 0, borderLeftWidth: 0, backgroundColor: bg, transform: [{ rotate: '45deg' }] })}
          {outline({ left: 8, top: 8, width: 8, height: 4, borderTopWidth: 0, borderRightWidth: 0, transform: [{ rotate: '-45deg' }] })}
        </>
      );
      break;
    case 'user':
      parts = (
        <>
          {outline({ left: 7, top: 2, width: 10, height: 10, borderRadius: 5 })}
          {outline({ left: 3, top: 14, width: 18, height: 12, borderTopLeftRadius: 9, borderTopRightRadius: 9, borderBottomWidth: 0 })}
        </>
      );
      break;
    case 'lock':
      parts = (
        <>
          {outline({ left: 7, top: 2, width: 10, height: 11, borderRadius: 5, borderBottomWidth: 0 })}
          {outline({ left: 4, top: 10, width: 16, height: 12, borderRadius: 3 })}
          {line({ left: 11, top: 14, width: S, height: 4, borderRadius: 1 })}
        </>
      );
      break;
    case 'eye':
    case 'eyeOff':
      parts = (
        <>
          {outline({ left: 1, top: 6, width: 22, height: 12, borderRadius: 11 })}
          {line({ left: 9, top: 9, width: 6, height: 6, borderRadius: 3 })}
          {name === 'eyeOff' ? line({ left: 2, top: 11, width: 20, height: S, transform: [{ rotate: '-40deg' }] }) : null}
        </>
      );
      break;
    case 'camera':
      parts = (
        <>
          {outline({ left: 2, top: 6, width: 20, height: 15, borderRadius: 3 })}
          {line({ left: 8, top: 3, width: 8, height: 4, borderTopLeftRadius: 2, borderTopRightRadius: 2 })}
          {outline({ left: 8, top: 9, width: 8, height: 8, borderRadius: 4 })}
        </>
      );
      break;
  }

  return (
    <View
      style={[styles.box, scale !== 1 && { transform: [{ scale }] }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {parts}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { width: 24, height: 24, overflow: 'hidden' },
});
