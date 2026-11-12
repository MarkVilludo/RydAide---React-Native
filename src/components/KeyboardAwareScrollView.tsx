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
  /**
   * avoid (default): iOS KeyboardAvoidingView + inset adjust (can lift the page).
   * scroll: do not shift the layout — screens scroll the focused field into view themselves.
   */
  keyboardMode?: 'avoid' | 'scroll';
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
    { style, contentContainerStyle, extraBottomPadding = 0, keyboardMode = 'avoid', ...rest },
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

    const scrollView = (
      <ScrollView
        ref={scrollRef}
        style={style}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets={keyboardMode === 'avoid'}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          contentContainerStyle,
          extraBottomPadding > 0 && { paddingBottom: extraBottomPadding },
        ]}
        {...rest}
      />
    );

    if (keyboardMode === 'scroll' || Platform.OS !== 'ios') {
      // Android uses softwareKeyboardLayoutMode: "resize". Auth screens use scroll mode
      // so the form is not lifted — only the ScrollView moves the focused field.
      return scrollView;
    }

    const keyboardVerticalOffset = statusBarTopInset() + IOS_KEYBOARD_HEADER_OFFSET;

    return (
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
        keyboardVerticalOffset={keyboardVerticalOffset}
      >
        {scrollView}
      </KeyboardAvoidingView>
    );
  },
);
