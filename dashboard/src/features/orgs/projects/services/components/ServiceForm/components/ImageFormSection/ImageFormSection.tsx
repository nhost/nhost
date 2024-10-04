import { Box } from '@/components/ui/v2/Box';
import { ArrowSquareOutIcon } from '@/components/ui/v2/icons/ArrowSquareOutIcon';
import { InfoIcon } from '@/components/ui/v2/icons/InfoIcon';
import { Input } from '@/components/ui/v2/Input';
import { Link } from '@/components/ui/v2/Link';
import { Text } from '@/components/ui/v2/Text';
import { Tooltip } from '@/components/ui/v2/Tooltip';
import { Label } from '@/components/ui/v3/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/v3/radio-group';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { InfoCard } from '@/features/projects/overview/components/InfoCard';
import type { ServiceFormValues } from '@/features/services/components/ServiceForm/ServiceFormTypes';
import { useFormContext } from 'react-hook-form';

interface ImageFormSectionProps {
  serviceID?: string;
  onImageTypeChange?: (value: 'public' | 'private' | 'nhost') => void;
  privateRegistryImage?: string;
  imageType?: 'public' | 'private' | 'nhost';
}

export default function ImageFormSection({
  privateRegistryImage,
  imageType,
  onImageTypeChange,
  serviceID,
}: ImageFormSectionProps) {
  const {
    register,
    formState: { errors },
    watch,
  } = useFormContext<ServiceFormValues>();

  const image = watch('image');

  const isPlatform = useIsPlatform();

  return (
    <Box className="space-y-4 rounded border-1 p-4">
      <Box className="flex flex-row items-center space-x-2">
        <Text variant="h4" className="font-semibold">
          Image
        </Text>
        <Tooltip
          title={
            <span>
              Image to use, it can be hosted on any public registry or it can
              use the{' '}
              <a
                target="_blank"
                rel="noopener noreferrer"
                href="https://docs.nhost.io/guides/run/registry#registry"
                className="underline"
              >
                Nhost registry
              </a>
            </span>
          }
        >
          <InfoIcon aria-label="Info" className="h-4 w-4" color="primary" />
        </Tooltip>
      </Box>
      <RadioGroup
        className="flex flex-row space-x-2"
        defaultValue="option-one"
        value={imageType}
        onValueChange={onImageTypeChange}
      >
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="public" id="public" />
          <Label htmlFor="public">Public image</Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="private" id="private" />
          <Label htmlFor="private">Private registry</Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="nhost" id="nhost" />
          <Label htmlFor="nhost">Nhost registry</Label>
        </div>
      </RadioGroup>

      <Input
        {...register('image')}
        id="image"
        label={
          <Box className="flex flex-row items-center space-x-2">
            <Text>Image</Text>
            <Tooltip
              title={
                <span>
                  Image to use, it can be hosted on any public registry or it
                  can use the{' '}
                  <a
                    target="_blank"
                    rel="noopener noreferrer"
                    href="https://docs.nhost.io/run/registry"
                    className="underline"
                  >
                    Nhost registry
                  </a>
                  . Image needs to support arm.
                </span>
              }
            >
              <InfoIcon aria-label="Info" className="h-4 w-4" color="primary" />
            </Tooltip>
          </Box>
        }
        placeholder={
          imageType === 'private'
            ? 'myprivaterepo/myservice:1.0.1'
            : 'myimage:1.0.1'
        }
        hideEmptyHelperText
        error={!!errors.image}
        helperText={errors?.image?.message}
        fullWidth
        autoComplete="off"
      />

      {imageType === 'private' && (
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
          placeholder="Add the secret variable for pull credentials here. e.g. {{ secrets.CONTAINER_REGISTRY_CREDENTIALS }}"
          hideEmptyHelperText
          error={!!errors.pullCredentials}
          helperText={errors?.pullCredentials?.message}
          fullWidth
          autoComplete="off"
        />
      )}

      {imageType === 'nhost' || imageType === 'private' ? (
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
              Using your own private registry for images
              <ArrowSquareOutIcon className="ml-1 h-4 w-4" />
            </Link>
          </Text>
        </div>
      ) : null}

      {/* This shows only when trying to edit a service and when running against the nhost platform */}
      {imageType === 'nhost' && isPlatform && serviceID && image && (
        <InfoCard title="Private registry" value={privateRegistryImage} />
      )}
    </Box>
  );
}
