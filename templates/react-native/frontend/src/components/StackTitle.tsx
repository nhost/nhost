import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import NhostLogo from '@/components/NhostLogo';
import ReactNativeLogo from '@/components/ReactNativeLogo';
import { colors, fontSize } from '@/theme';

const LOGO_SIZE = 64;
const WORD_LINE = 36;

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
      <Text aria-hidden style={styles.word}>
        {name}
      </Text>
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
    <View style={styles.title}>
      <LogoColumn logo={backend} />
      <View style={styles.column}>
        <Text aria-hidden style={styles.word}>
          +
        </Text>
      </View>
      <LogoColumn logo={framework} />
      {/* The heading covers the line of words only: VoiceOver reaches
          nothing inside an accessible element, so it can't hold the links. */}
      <View
        accessible
        role="heading"
        aria-label={`${backend.name} + ${framework.name}`}
        style={styles.heading}
      />
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
    lineHeight: WORD_LINE,
    fontWeight: '600',
    letterSpacing: -0.5,
  },
  heading: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: WORD_LINE,
    pointerEvents: 'none',
  },
});
