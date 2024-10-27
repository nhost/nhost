import { Box } from '@/components/ui/v2/Box';
import { ArrowSquareOutIcon } from '@/components/ui/v2/icons/ArrowSquareOutIcon';
import { InfoIcon } from '@/components/ui/v2/icons/InfoIcon';
import { Input } from '@/components/ui/v2/Input';
import { Link } from '@/components/ui/v2/Link';
import { Text } from '@/components/ui/v2/Text';
import { Tooltip } from '@/components/ui/v2/Tooltip';
import type { ServiceFormValues } from '@/features/services/components/ServiceForm/ServiceFormTypes';
import { inputBaseClasses } from '@mui/material';
import { useTheme } from '@mui/system';
import { useEffect, useState } from 'react';
import { useFormContext } from 'react-hook-form';

interface ImageFieldProps {
  privateRegistryImage: string;
  imageType: 'private' | 'nhost' | 'public';
  initialImageTag?: string;
}

export default function ImageField({
  privateRegistryImage,
  imageType,
  initialImageTag,
}: ImageFieldProps) {
  const {
    register,
    formState: { errors },
    setValue,
  } = useFormContext<ServiceFormValues>();

  const theme = useTheme();

  const [imageTag, setImageTag] = useState(initialImageTag || '');

  useEffect(() => {
    if (imageType === 'nhost' && privateRegistryImage) {
      const newImage = imageTag
        ? `${privateRegistryImage}:${imageTag}`
        : privateRegistryImage;
      setValue('image', newImage);
    }
  }, [imageTag, privateRegistryImage, imageType, setValue]);

  if (imageType === 'nhost') {
    return (
      <>
        <div className="flex flex-col gap-1">
          <Box className="flex flex-row items-center space-x-2">
            <Text>Image</Text>
          </Box>

          <Box className="flex flex-col gap-1 md:flex-row md:gap-0">
            <Text
              as="span"
              className="mt-0 py-2 pl-[10px] pr-1 md:whitespace-nowrap"
              sx={{
                color: theme.palette.grey[600],
                borderColor: theme.palette.grey[400],
                backgroundColor: theme.palette.grey[200],
                borderTopLeftRadius: theme.shape.borderRadius,
                borderBottomLeftRadius: theme.shape.borderRadius,
              }}
            >
              {privateRegistryImage}:
            </Text>
            <Input
              value={imageTag}
              onChange={(e) => setImageTag(e.target.value)}
              id="imageTagField"
              className="pl-0"
              sx={{
                [`& .${inputBaseClasses.input}`]: {
                  paddingLeft: '4px',
                },
              }}
              placeholder="latest"
              hideEmptyHelperText
              error={!!errors.image}
              fullWidth
              autoComplete="off"
            />
          </Box>
        </div>

        <div className="grid w-full grid-flow-col justify-start gap-x-1 self-center align-middle">
          <Text>
            Learn more about{' '}
            <Link
              href="https://docs.nhost.io/guides/run/registry#creating-a-private-repository-for-your-image"
              target="_blank"
              rel="noopener noreferrer"
              underline="hover"
              className="font-medium"
            >
              using Nhost registry for images
              <ArrowSquareOutIcon className="ml-1 h-4 w-4" />
            </Link>
          </Text>
        </div>
      </>
    );
  }

  if (imageType === 'private') {
    return (
      <>
        <Input
          {...register('image')}
          id="image"
          className="pl-0"
          label={
            <Box className="flex flex-row items-center space-x-2">
              <Text>Image</Text>
            </Box>
          }
          placeholder="myprivaterepo/myservice:1.0.1"
          hideEmptyHelperText
          error={!!errors.image}
          helperText={errors?.image?.message}
          fullWidth
          autoComplete="off"
        />

        <Input
          {...register('pullCredentials')}
          id="pullCredentials"
          label={
            <Box className="flex flex-row items-center space-x-2">
              <Text>Pull credentials</Text>
              <Tooltip
                title={
                  <span>
                    If you are publishing your images in your own private
                    registry you can add pull credentials to your Run
                    configuration so the image can be pulled successfully.
                  </span>
                }
              >
                <InfoIcon
                  aria-label="Info"
                  className="h-4 w-4"
                  color="primary"
                />
              </Tooltip>
            </Box>
          }
          placeholder="Enter your pull credentials here"
          hideEmptyHelperText
          error={!!errors.pullCredentials}
          helperText={errors?.pullCredentials?.message}
          fullWidth
          autoComplete="off"
        />

        <div className="grid w-full grid-flow-col justify-start gap-x-1 self-center align-middle">
          <Text>
            Learn more about{' '}
            <Link
              href="https://docs.nhost.io/guides/run/registry#using-your-own-private-registry"
              target="_blank"
              rel="noopener noreferrer"
              underline="hover"
              className="font-medium"
            >
              using your own private registry for images
              <ArrowSquareOutIcon className="ml-1 h-4 w-4" />
            </Link>
          </Text>
        </div>
      </>
    );
  }
  if (imageType === 'public') {
    return (
      <Input
        {...register('image')}
        id="image"
        className="pl-0"
        label={
          <Box className="flex flex-row items-center space-x-2">
            <Text>Image</Text>
          </Box>
        }
        placeholder="myimage:1.0.1"
        hideEmptyHelperText
        error={!!errors.image}
        helperText={errors?.image?.message}
        fullWidth
        autoComplete="off"
      />
    );
  }
  return null;
}
