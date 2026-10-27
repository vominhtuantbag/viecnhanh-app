import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Colors, Shadow } from '@/constants/colors';

function GoogleMark({ size }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <Path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <Path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <Path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571.001-.001.002-.001.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </Svg>
  );
}

function AppleMark({ size }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill="#111111"
        d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"
      />
    </Svg>
  );
}

function FacebookMark({ size }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill="#1877F2"
        d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"
      />
    </Svg>
  );
}

const PROVIDERS = [
  { key: 'google', label: 'Đăng nhập với Google', scale: 1, Mark: GoogleMark },
  { key: 'apple', label: 'Đăng nhập với Apple', scale: 0.86, Mark: AppleMark },
  { key: 'facebook', label: 'Đăng nhập với Facebook', scale: 0.92, Mark: FacebookMark },
];

export default function SocialLoginRow({ busy, disabled, onGoogle, onApple, onFacebook }) {
  const [cardSize, setCardSize] = useState(0);
  const actions = { google: onGoogle, apple: onApple, facebook: onFacebook };
  const iconBox = Math.round((cardSize || 80) * 0.42);

  return (
    <View style={styles.socialContainer}>
      {PROVIDERS.map((provider) => {
        const loading = busy === provider.key;
        const Mark = provider.Mark;
        return (
          <Pressable
            key={provider.key}
            accessibilityRole="button"
            accessibilityLabel={provider.label}
            accessibilityState={{ disabled: disabled || loading, busy: loading }}
            disabled={disabled}
            onPress={actions[provider.key]}
            onLayout={(event) => {
              const next = Math.round(event.nativeEvent.layout.width);
              setCardSize((current) => (Math.abs(current - next) <= 1 ? current : next));
            }}
            style={({ pressed, hovered }) => [
              styles.socialButton,
              (pressed || hovered) && styles.socialPressed,
              disabled && styles.disabled,
            ]}>
            {loading ? (
              <ActivityIndicator color={Colors.text} />
            ) : (
              <Mark size={Math.max(24, Math.round(iconBox * provider.scale))} />
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  socialContainer: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    marginVertical: 16,
  },
  socialButton: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    aspectRatio: 1,
    maxWidth: 96,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 20,
    ...Shadow.soft,
  },
  socialPressed: {
    backgroundColor: '#F8FAFC',
    borderColor: '#D0D5DD',
    transform: [{ scale: 0.96 }],
    shadowOpacity: 0.14,
    elevation: 5,
  },
  disabled: {
    opacity: 0.7,
  },
});
