import { fireEvent, render, screen } from '@testing-library/react-native';
import { File } from 'expo-file-system';
import type { ImagePickerAsset, ImagePickerOptions } from 'expo-image-picker';
import { View } from 'react-native';
import AvatarForm from '@/screens/account/AvatarForm';
import {
  AVATAR_NOT_AN_IMAGE,
  AVATAR_TOO_LARGE,
  MAX_AVATAR_BYTES,
} from '@/screens/account/avatar';

const mockRefresh = jest.fn();
const mockUploadAvatar = jest.fn();
const mockRemoveAvatar = jest.fn();
const mockLaunch = jest.fn();

jest.mock('@/components/useRefresh', () => ({
  useRefresh: () => mockRefresh,
}));
jest.mock('@/screens/account/actions', () => ({
  uploadAvatar: (file: unknown) => mockUploadAvatar(file),
  removeAvatar: () => mockRemoveAvatar(),
}));
jest.mock('expo-image-picker', () => ({
  ...jest.requireActual('expo-image-picker'),
  launchImageLibraryAsync: (options: ImagePickerOptions) => mockLaunch(options),
}));

const URI = 'file:///cache/ImagePicker/me.jpg';

const picked = (asset: Partial<ImagePickerAsset>) => ({
  canceled: false,
  assets: [{ uri: URI, width: 1, height: 1, ...asset }],
});

const upload = () =>
  fireEvent.press(screen.getByRole('button', { name: 'Upload a new avatar' }));

// A stand-in for the image, which the screen renders and passes in.
async function renderForm(canRemove = true): Promise<void> {
  await render(
    <AvatarForm canRemove={canRemove}>
      <View testID="the-image" />
    </AvatarForm>,
  );
}

beforeEach(() => {
  mockRefresh.mockReset();
  mockUploadAvatar.mockReset();
  mockRemoveAvatar.mockReset();
  mockLaunch.mockReset();
});

describe('avatar control', () => {
  // Picking the image is the whole gesture: there is no second press.
  it('uploads as soon as an image is picked and loads the screen again', async () => {
    mockLaunch.mockResolvedValueOnce(
      picked({ fileName: 'me.jpg', mimeType: 'image/jpeg', fileSize: 8 }),
    );
    mockUploadAvatar.mockResolvedValueOnce({ success: true });
    await renderForm();

    await upload();

    expect(mockLaunch).toHaveBeenCalledWith({
      mediaTypes: ['images'],
      preferredAssetRepresentationMode: 'compatible',
    });
    expect(mockUploadAvatar).toHaveBeenCalledWith({
      uri: URI,
      name: 'me.jpg',
      type: 'image/jpeg',
      size: 8,
    });
    expect(mockRefresh).toHaveBeenCalled();
  });

  it('does nothing when the library is closed without a pick', async () => {
    mockLaunch.mockResolvedValueOnce({ canceled: true, assets: null });
    await renderForm();

    await upload();

    expect(mockUploadAvatar).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  // Android can leave out the type and the size the picker reports.
  it('reads a missing type from the name and a missing size from the file', async () => {
    const size = jest.fn(() => 2048);
    Object.defineProperty(File.prototype, 'size', {
      get: size,
      configurable: true,
    });
    mockLaunch.mockResolvedValueOnce(picked({ fileName: null }));
    mockUploadAvatar.mockResolvedValueOnce({ success: true });
    await renderForm();

    try {
      await upload();
    } finally {
      delete (File.prototype as { size?: number }).size;
    }

    expect(mockUploadAvatar).toHaveBeenCalledWith({
      uri: URI,
      name: 'me.jpg',
      type: 'image/jpeg',
      size: 2048,
    });
  });

  it('refuses an oversized image without calling the action', async () => {
    mockLaunch.mockResolvedValueOnce(
      picked({ mimeType: 'image/png', fileSize: MAX_AVATAR_BYTES + 1 }),
    );
    await renderForm();

    await upload();

    expect(screen.getByRole('alert')).toHaveTextContent(AVATAR_TOO_LARGE);
    expect(mockUploadAvatar).not.toHaveBeenCalled();
  });

  // Storage cannot resize a GIF or a HEIC, so either would upload and never
  // display.
  it.each(['image/gif', 'image/heic', 'video/mp4'])(
    'refuses %s without calling the action',
    async (mimeType) => {
      mockLaunch.mockResolvedValueOnce(picked({ mimeType, fileSize: 8 }));
      await renderForm();

      await upload();

      expect(screen.getByRole('alert')).toHaveTextContent(AVATAR_NOT_AN_IMAGE);
      expect(mockUploadAvatar).not.toHaveBeenCalled();
    },
  );

  it('says why the upload failed', async () => {
    mockLaunch.mockResolvedValueOnce(
      picked({ mimeType: 'image/jpeg', fileSize: 8 }),
    );
    mockUploadAvatar.mockResolvedValueOnce({
      error: 'The storage service did not keep the file.',
    });
    await renderForm();

    await upload();

    expect(screen.getByRole('alert')).toHaveTextContent(
      'The storage service did not keep the file.',
    );
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it('removes the avatar and loads the screen again', async () => {
    mockRemoveAvatar.mockResolvedValueOnce({ success: true });
    await renderForm();

    await fireEvent.press(screen.getByRole('button', { name: 'Remove' }));

    expect(mockRemoveAvatar).toHaveBeenCalledTimes(1);
    expect(mockRefresh).toHaveBeenCalled();
  });

  it('offers no removal without an avatar', async () => {
    await renderForm(false);

    expect(screen.queryByRole('button', { name: 'Remove' })).toBeNull();
  });
});
