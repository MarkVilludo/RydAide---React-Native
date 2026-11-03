import React, { forwardRef, useRef, useImperativeHandle } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  type ScrollViewInstance,
  type ScrollViewProps,
} from 'react-native';
import { statusBarTopInset } from '../utils/screenInsets';

type Props = ScrollViewProps & {
  /** Extra scroll content padding when forms (e.g. review comment) sit at the bottom. */
  extraBottomPadding?: number;
};

/** Approximate stack header height under transparent nav bars (iOS keyboard offset). */
const IOS_KEYBOARD_HEADER_OFFSET = 44;

export type KeyboardAwareScrollViewRef = {
  scrollToEnd: (options?: { animated?: boolean }) => void;
};

export const KeyboardAwareScrollView = forwardRef<KeyboardAwareScrollViewRef, Props>(
  function KeyboardAwareScrollView(
  { style, contentContainerStyle, extraBottomPadding = 0, ...rest },
  ref,
) {
  const scrollRef = useRef<ScrollViewInstance | null>(null);
  useImperativeHandle(
    ref,
    () => ({
      scrollToEnd: (options) => {
        scrollRef.current?.scrollToEnd(options);
      },
    }),
    [],
  );

  const keyboardVerticalOffset =
    Platform.OS === 'ios' ? statusBarTopInset() + IOS_KEYBOARD_HEADER_OFFSET : 0;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={keyboardVerticalOffset}
    >
      <ScrollView
        ref={scrollRef}
        style={style}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={[
          contentContainerStyle,
          extraBottomPadding > 0 && { paddingBottom: extraBottomPadding },
        ]}
        {...rest}
      />
    </KeyboardAvoidingView>
  );
  },
);
