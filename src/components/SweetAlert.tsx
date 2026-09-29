import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing } from '../theme/colors';

export type SweetAlertButton = {
  text?: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: (() => void) | (() => Promise<void>);
};

export type SweetAlertOptions = {
  title: string;
  message?: string;
  buttons?: SweetAlertButton[];
};

type AlertStyle = 'success' | 'error' | 'warning' | 'info';

type ShowFn = (opts: SweetAlertOptions) => void;

let showImpl: ShowFn | null = null;
const queue: SweetAlertOptions[] = [];

function enqueue(opts: SweetAlertOptions) {
  if (showImpl) {
    showImpl(opts);
  } else {
    queue.push(opts);
  }
}

/** RN Alert.alert ile aynı imza — SweetAlert modal gösterir */
export function sweetAlert(
  title: string,
  message?: string,
  buttons?: SweetAlertButton[],
): void {
  enqueue({
    title,
    message: message ?? undefined,
    buttons,
  });
}

export function registerSweetAlert(show: ShowFn | null) {
  showImpl = show;
  if (show) {
    while (queue.length) {
      const next = queue.shift();
      if (next) show(next);
    }
  }
}

function inferStyle(title: string, buttons?: SweetAlertButton[]): AlertStyle {
  const t = title.toLocaleLowerCase('tr-TR');
  if (
    t.includes('hata') ||
    t.includes('yetki') ||
    t.includes('üye değil') ||
    t.includes('yükleme')
  ) {
    return 'error';
  }
  if (
    t.includes('tamam') ||
    t.includes('kaydedildi') ||
    t.includes('paylaşıldı') ||
    t.includes('takip edildi') ||
    t.includes('takipten')
  ) {
    return 'success';
  }
  if (
    t.includes('eksik') ||
    t.includes('sil') ||
    t.includes('ayrıl') ||
    t.includes('çıkış')
  ) {
    return 'warning';
  }
  if (buttons?.some((b) => b.style === 'destructive')) return 'warning';
  return 'info';
}

const STYLE_META: Record<
  AlertStyle,
  { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string }
> = {
  success: {
    icon: 'checkmark-circle',
    color: colors.success,
    bg: 'rgba(34,197,94,0.15)',
  },
  error: {
    icon: 'close-circle',
    color: colors.accent,
    bg: colors.accentSoft,
  },
  warning: {
    icon: 'warning',
    color: colors.gold,
    bg: 'rgba(212,175,55,0.15)',
  },
  info: {
    icon: 'information-circle',
    color: colors.blue,
    bg: 'rgba(59,130,246,0.15)',
  },
};

export function SweetAlertHost() {
  const [visible, setVisible] = useState(false);
  const [current, setCurrent] = useState<SweetAlertOptions | null>(null);
  const pending = useRef<SweetAlertOptions[]>([]);
  const scale = useRef(new Animated.Value(0.86)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const busy = useRef(false);

  const present = useCallback(
    (opts: SweetAlertOptions) => {
      setCurrent(opts);
      setVisible(true);
      scale.setValue(0.86);
      opacity.setValue(0);
      Animated.parallel([
        Animated.spring(scale, {
          toValue: 1,
          friction: 7,
          tension: 80,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 160,
          useNativeDriver: true,
        }),
      ]).start();
    },
    [opacity, scale],
  );

  const show = useCallback(
    (opts: SweetAlertOptions) => {
      if (busy.current || visible) {
        pending.current.push(opts);
        return;
      }
      busy.current = true;
      present(opts);
    },
    [present, visible],
  );

  useEffect(() => {
    registerSweetAlert(show);
    return () => registerSweetAlert(null);
  }, [show]);

  const dismiss = useCallback(
    (after?: () => void) => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 120,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 0.92,
          duration: 120,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setVisible(false);
        setCurrent(null);
        busy.current = false;
        after?.();
        const next = pending.current.shift();
        if (next) {
          // küçük gecikme: modal kapanışından sonra
          setTimeout(() => {
            busy.current = true;
            present(next);
          }, 40);
        }
      });
    },
    [opacity, present, scale],
  );

  const alertStyle = useMemo(
    () => inferStyle(current?.title ?? '', current?.buttons),
    [current],
  );
  const meta = STYLE_META[alertStyle];

  const buttons = useMemo(() => {
    const list = current?.buttons?.filter((b) => b.text) ?? [];
    if (list.length === 0) {
      return [{ text: 'Tamam', style: 'default' as const }];
    }
    return list;
  }, [current]);

  async function onPressButton(btn: SweetAlertButton) {
    dismiss(() => {
      void Promise.resolve(btn.onPress?.()).catch(() => undefined);
    });
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={() => {
        const cancel = buttons.find((b) => b.style === 'cancel');
        if (cancel) void onPressButton(cancel);
        else dismiss();
      }}
    >
      <View style={styles.backdrop}>
        <Animated.View
          style={[
            styles.card,
            { opacity, transform: [{ scale }] },
          ]}
        >
          <View style={[styles.iconWrap, { backgroundColor: meta.bg }]}>
            <Ionicons name={meta.icon} size={42} color={meta.color} />
          </View>

          {current?.title ? (
            <Text style={styles.title}>{current.title}</Text>
          ) : null}
          {current?.message ? (
            <Text style={styles.message}>{current.message}</Text>
          ) : null}

          <ScrollView
            style={styles.btnScroll}
            contentContainerStyle={styles.btnCol}
            bounces={false}
            showsVerticalScrollIndicator={false}
          >
            {buttons.map((btn, i) => {
              const isCancel = btn.style === 'cancel';
              const isDestructive = btn.style === 'destructive';
              const isPrimary =
                buttons.length <= 2 &&
                !isCancel &&
                !isDestructive &&
                i === buttons.findIndex((b) => b.style !== 'cancel');

              return (
                <Pressable
                  key={`${btn.text}-${i}`}
                  style={[
                    styles.btn,
                    isPrimary && styles.btnPrimary,
                    isDestructive && styles.btnDestructive,
                    isCancel && styles.btnCancel,
                  ]}
                  onPress={() => void onPressButton(btn)}
                >
                  <Text
                    style={[
                      styles.btnText,
                      isPrimary && styles.btnTextPrimary,
                      isDestructive && styles.btnTextDestructive,
                      isCancel && styles.btnTextCancel,
                    ]}
                  >
                    {btn.text}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 6,
  },
  message: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  btnScroll: {
    width: '100%',
    maxHeight: 260,
    marginTop: spacing.sm,
  },
  btnCol: {
    gap: 8,
    width: '100%',
  },
  btn: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: radii.md,
    alignItems: 'center',
    backgroundColor: colors.cardSoft,
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnPrimary: {
    backgroundColor: colors.white,
    borderColor: colors.white,
  },
  btnDestructive: {
    backgroundColor: colors.accentSoft,
    borderColor: 'rgba(225,6,0,0.35)',
  },
  btnCancel: {
    backgroundColor: 'transparent',
    borderColor: colors.borderStrong,
  },
  btnText: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 15,
  },
  btnTextPrimary: {
    color: colors.black,
    fontWeight: '800',
  },
  btnTextDestructive: {
    color: colors.accent,
    fontWeight: '800',
  },
  btnTextCancel: {
    color: colors.textMuted,
  },
});
