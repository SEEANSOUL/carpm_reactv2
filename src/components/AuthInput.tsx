import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  TextInputProps,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing } from '../theme/colors';

type Props = TextInputProps & {
  label: string;
  error?: string;
  isPassword?: boolean;
};

export function AuthInput({ label, error, isPassword, style, ...rest }: Props) {
  const [hidden, setHidden] = useState(!!isPassword);

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.field, error ? styles.fieldError : null]}>
        <TextInput
          {...rest}
          secureTextEntry={isPassword ? hidden : false}
          placeholderTextColor={colors.textDim}
          style={[styles.input, style]}
          autoCapitalize={rest.autoCapitalize ?? 'none'}
          autoCorrect={false}
        />
        {isPassword ? (
          <Pressable onPress={() => setHidden((v) => !v)} hitSlop={10}>
            <Ionicons
              name={hidden ? 'eye-outline' : 'eye-off-outline'}
              size={20}
              color={colors.textMuted}
            />
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    minHeight: 50,
  },
  fieldError: { borderColor: colors.accent },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    paddingVertical: 12,
  },
  error: { color: colors.accent, fontSize: 12, fontWeight: '600' },
});
