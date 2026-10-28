import { useHeaderHeight } from '@react-navigation/elements';
import React, { forwardRef } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  type ScrollViewProps,
} from 'react-native';

type Props = ScrollViewProps & {
  /** Extra scroll content padding when forms (e.g. review comment) sit at the bottom. */
  extraBottomPadding?: number;
};

export const KeyboardAwareScrollView = forwardRef<ScrollView, Props>(function KeyboardAwareScrollView(
  { style, contentContainerStyle, extraBottomPadding = 0, ...rest },
  ref,
) {
  const headerHeight = useHeaderHeight();

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? headerHeight : 0}
    >
      <ScrollView
        ref={ref}
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
});
