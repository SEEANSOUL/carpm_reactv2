import React, { useEffect, useState, type ReactNode, type RefObject } from 'react';
import {
  Keyboard,
  Platform,
  View,
  StyleSheet,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {
  KeyboardAwareScrollView,
  KeyboardStickyView,
} from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Klavye yüksekliği — geriye uyumluluk / manuel lift */
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (e) => {
      setHeight(e.endCoordinates?.height ?? 0);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => setHeight(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return height;
}

type FormProps = {
  children: ReactNode;
  contentContainerStyle?: ScrollViewProps['contentContainerStyle'];
  style?: StyleProp<ViewStyle>;
  /** Sabit alt bar — klavyenin üstüne yapışır */
  footer?: ReactNode;
  extraBottom?: number;
  bottomOffset?: number;
  scrollRef?: RefObject<unknown>;
} & Pick<ScrollViewProps, 'showsVerticalScrollIndicator' | 'refreshControl'>;

/**
 * Form ekranları — focus’lanan input’u otomatik klavyenin üstüne kaydırır.
 */
export function KeyboardForm({
  children,
  contentContainerStyle,
  style,
  footer,
  extraBottom = 0,
  bottomOffset,
  scrollRef,
  ...scrollProps
}: FormProps) {
  const insets = useSafeAreaInsets();
  const offset = bottomOffset ?? (footer ? 100 : 28) + Math.max(insets.bottom, 0);

  return (
    <View style={[{ flex: 1 }, style]}>
      <KeyboardAwareScrollView
        ref={scrollRef as never}
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.grow,
          contentContainerStyle,
          { paddingBottom: 40 + (footer ? 96 : 0) + extraBottom },
        ]}
        keyboardShouldPersistTaps="handled"
        bottomOffset={offset}
        showsVerticalScrollIndicator={scrollProps.showsVerticalScrollIndicator ?? false}
        refreshControl={scrollProps.refreshControl}
        extraKeyboardSpace={24}
      >
        {children}
      </KeyboardAwareScrollView>

      {footer ? (
        <KeyboardStickyView>
          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
            {footer}
          </View>
        </KeyboardStickyView>
      ) : null}
    </View>
  );
}

type SheetProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  footer: ReactNode;
};

/** Liste + alt input (yorumlar) — composer klavye ile yükselir */
export function KeyboardSheet({ children, footer, style }: SheetProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[{ flex: 1 }, style]}>
      <View style={{ flex: 1 }}>{children}</View>
      <KeyboardStickyView>
        <View style={{ paddingBottom: Math.max(insets.bottom, 0) }}>{footer}</View>
      </KeyboardStickyView>
    </View>
  );
}

const styles = StyleSheet.create({
  grow: { flexGrow: 1 },
  footer: {
    backgroundColor: 'transparent',
  },
});
