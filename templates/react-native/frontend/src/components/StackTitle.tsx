import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import NhostLogo from '@/components/NhostLogo';
import ReactNativeLogo from '@/components/ReactNativeLogo';
import { colors, fontSize } from '@/theme';

const LOGO_SIZE = 64;

const logos = [
  {
    href: 'https://nhost.io',
    name: 'Nhost',
    Logo: NhostLogo,
  },
  {
    href: 'https://reactnative.dev',
    name: 'React Native',
    Logo: ReactNativeLogo,
  },
] as const;

function LogoColumn({
  logo: { href, name, Logo },
}: {
  logo: (typeof logos)[number];
}) {
  return (
    <View style={styles.column}>
      <Link href={href} asChild>
        <Pressable role="link" aria-label={name}>
          <Logo size={LOGO_SIZE} />
        </Pressable>
      </Link>
      <Text style={styles.word}>{name}</Text>
    </View>
  );
}

/**
 * The home screen's title, with each mark centred over its own name and
 * linking to its project.
 */
export default function StackTitle() {
  const [backend, framework] = logos;

  return (
    <View
      accessible
      role="heading"
      aria-label={`${backend.name} + ${framework.name}`}
      style={styles.title}
    >
      <LogoColumn logo={backend} />
      <View style={styles.column}>
        <Text style={styles.word}>+</Text>
      </View>
      <LogoColumn logo={framework} />
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 12,
  },
  column: {
    alignItems: 'center',
    gap: 28,
  },
  word: {
    color: colors.foreground,
    fontSize: fontSize['3xl'],
    fontWeight: '600',
    letterSpacing: -0.5,
  },
});
