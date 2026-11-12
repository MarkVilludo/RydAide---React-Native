import React, { forwardRef, useImperativeHandle, useRef } from 'react';
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
  /** Scroll so a Y offset inside the content is visible above the keyboard. */
  scrollTo: (options: { y: number; animated?: boolean }) => void;
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
        scrollTo: (options) => {
          scrollRef.current?.scrollTo({ x: 0, y: Math.max(0, options.y), animated: options.animated ?? true });
        },
      }),
      [],
    );

    const keyboardVerticalOffset =
      Platform.OS === 'ios' ? statusBarTopInset() + IOS_KEYBOARD_HEADER_OFFSET : 0;

    // Android uses softwareKeyboardLayoutMode: "resize" — avoid height-based KAV
    // (it fights window resize). iOS still needs padding behavior.
    const avoiding =
      Platform.OS === 'ios' ? (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior="padding"
          keyboardVerticalOffset={keyboardVerticalOffset}
        >
          <ScrollView
            ref={scrollRef}
            style={style}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            automaticallyAdjustKeyboardInsets
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              contentContainerStyle,
              extraBottomPadding > 0 && { paddingBottom: extraBottomPadding },
            ]}
            {...rest}
          />
        </KeyboardAvoidingView>
      ) : (
        <ScrollView
          ref={scrollRef}
          style={style}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            contentContainerStyle,
            extraBottomPadding > 0 && { paddingBottom: extraBottomPadding },
          ]}
          {...rest}
        />
      );

    return avoiding;
  },
);
