import { File } from 'expo-file-system';
import {
  type ImagePickerAsset,
  launchImageLibraryAsync,
  UIImagePickerPreferredAssetRepresentationMode,
} from 'expo-image-picker';
import { type ReactNode, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Button } from '@/components/ui/button';
import { useRefresh } from '@/components/useRefresh';
import { NETWORK_ERROR } from '@/lib/nhost/errors';
import { removeAvatar, uploadAvatar } from '@/screens/account/actions';
import {
  AVATAR_NOT_AN_IMAGE,
  AVATAR_TOO_LARGE,
  type AvatarFile,
  avatarTypeFromName,
  isAvatarType,
  MAX_AVATAR_BYTES,
} from '@/screens/account/avatar';
import { colors, fontSize } from '@/theme';

// The picker leaves out the type when the platform does not report it, so it
// comes from the name instead. The size is read from the file the picker wrote:
// Android reports the original's size, not the re-encoded copy's.
function avatarFileFrom(asset: ImagePickerAsset): AvatarFile {
  const name =
    asset.fileName || asset.uri.split('/').pop()?.split('?')[0] || 'avatar';

  return {
    uri: asset.uri,
    name,
    type: asset.mimeType || avatarTypeFromName(name),
    size: new File(asset.uri).size,
  };
}

/** The controls for the avatar, wrapped around the image itself. */
export default function AvatarForm({
  canRemove,
  children,
}: {
  canRemove: boolean;
  children: ReactNode;
}) {
  const refresh = useRefresh();
  const [error, setError] = useState<string | undefined>();
  const [isPending, setIsPending] = useState(false);
  // The library covers the screen while it is open, so picking disables the
  // controls without showing the spinner.
  const [isPicking, setIsPicking] = useState(false);

  const upload = async (file: AvatarFile): Promise<void> => {
    // Checked here so a file the action would refuse is never sent, and
    // again in the action for a caller that does not come through this.
    if (!isAvatarType(file.type)) {
      setError(AVATAR_NOT_AN_IMAGE);
      return;
    }

    if (file.size > MAX_AVATAR_BYTES) {
      setError(AVATAR_TOO_LARGE);
      return;
    }

    setIsPending(true);
    try {
      const result = await uploadAvatar(file);

      if (result.error) {
        setError(result.error);
        return;
      }

      // The image reads its URL from the auth service, so the screen is
      // loaded again rather than patched here.
      refresh();
    } catch (err) {
      console.error('Error uploading the avatar:', err);
      setError(NETWORK_ERROR);
    } finally {
      setIsPending(false);
    }
  };

  const handlePick = async (): Promise<void> => {
    setError(undefined);
    setIsPicking(true);
    try {
      const picked = await launchImageLibraryAsync({
        mediaTypes: ['images'],
        // iOS hands over a JPEG rather than the HEIC most photos are stored
        // as, which storage cannot resize.
        preferredAssetRepresentationMode:
          UIImagePickerPreferredAssetRepresentationMode.Compatible,
        // Below 1 the picker re-encodes a JPEG instead of handing over the
        // camera's original, which is often over 4 MB. The app never shows
        // an avatar wider than 192 px, so the loss is not visible.
        quality: 0.7,
      });
      const asset = picked.canceled ? undefined : picked.assets[0];

      if (asset) {
        await upload(avatarFileFrom(asset));
      }
    } catch (err) {
      console.error('Error picking the avatar:', err);
      setError('Could not open the photo library.');
    } finally {
      setIsPicking(false);
    }
  };

  const handleRemove = async (): Promise<void> => {
    setError(undefined);
    setIsPending(true);
    try {
      const result = await removeAvatar();

      if (result.error) {
        setError(result.error);
        return;
      }

      refresh();
    } catch (err) {
      console.error('Error removing the avatar:', err);
      setError(NETWORK_ERROR);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <View style={styles.form}>
      <View>
        {children}
        {isPending ? (
          <View style={styles.pending}>
            <ActivityIndicator
              color={colors.foreground}
              accessibilityLabel="Updating the avatar"
            />
          </View>
        ) : null}
        <Button
          variant="secondary"
          size="icon"
          disabled={isPending || isPicking}
          aria-label="Upload a new avatar"
          hitSlop={8}
          style={styles.upload}
          onPress={() => void handlePick()}
        >
          <Svg
            width={12}
            height={12}
            viewBox="0 0 24 24"
            fill="none"
            stroke={colors.foreground}
            strokeWidth={2.5}
            strokeLinecap="round"
          >
            <Path d="M12 5v14M5 12h14" />
          </Svg>
        </Button>
      </View>

      {canRemove ? (
        <Button
          title="Remove"
          variant="link"
          size="sm"
          disabled={isPending || isPicking}
          style={styles.remove}
          labelStyle={styles.removeLabel}
          onPress={() => void handleRemove()}
        />
      ) : null}

      {error ? (
        <Text role="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    alignItems: 'center',
    gap: 4,
    maxWidth: 120,
  },
  pending: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: 'rgba(29, 29, 29, 0.6)',
  },
  upload: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: colors.card,
  },
  remove: {
    height: 'auto',
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  removeLabel: {
    color: colors.mutedForeground,
    fontSize: fontSize.xs,
  },
  error: {
    color: colors.destructive,
    fontSize: fontSize.xs,
    textAlign: 'center',
  },
});
