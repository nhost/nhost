import { InfoIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { CopyToClipboardButton } from '@/components/presentational/CopyToClipboardButton';
import { Input } from '@/components/ui/v3/input';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/v3/input-group';
import { Label } from '@/components/ui/v3/label';
import { TextLink } from '@/components/ui/v3/text-link';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import type { ServiceFormValues } from '@/features/orgs/projects/services/components/ServiceForm/ServiceFormTypes';
import { cn } from '@/lib/utils';

interface ImageFieldProps {
  privateRegistryImage: string;
  imageType: 'private' | 'nhost' | 'public';
  initialImageTag?: string;
  serviceID?: string;
}

export default function ImageField({
  privateRegistryImage,
  imageType,
  initialImageTag,
  serviceID,
}: ImageFieldProps) {
  const {
    register,
    formState: { errors },
    setValue,
  } = useFormContext<ServiceFormValues>();

  const [imageTag, setImageTag] = useState(initialImageTag || '');
  const isExistingService = !!serviceID;

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
          <Label htmlFor="imageTagField">Image</Label>

          <InputGroup
            className={cn({
              'border-destructive': errors.image,
            })}
          >
            <InputGroupAddon
              align="inline-start"
              className="max-w-[70%] justify-start font-normal"
            >
              {isExistingService && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex shrink-0">
                      <CopyToClipboardButton
                        aria-label="Copy registry"
                        textToCopy={privateRegistryImage}
                        title="Nhost registry"
                      />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>Copy registry</TooltipContent>
                </Tooltip>
              )}
              <span className="min-w-0 truncate">{privateRegistryImage}:</span>
            </InputGroupAddon>
            <InputGroupInput
              value={imageTag}
              onChange={(event) => setImageTag(event.target.value)}
              id="imageTagField"
              placeholder="latest"
              aria-invalid={!!errors.image}
              autoComplete="off"
            />
          </InputGroup>
          {errors.image?.message && (
            <p className="text-destructive text-sm">{errors.image.message}</p>
          )}
        </div>

        <div className="grid w-full grid-flow-col justify-start gap-x-1 self-center align-middle">
          <p className="text-sm">
            Learn more about{' '}
            <TextLink
              href="https://docs.nhost.io/products/run/registry#creating-a-private-repository-for-your-image"
              external
              className="font-medium"
            >
              using Nhost registry for images
            </TextLink>
          </p>
        </div>
      </>
    );
  }

  if (imageType === 'private') {
    return (
      <>
        <div className="space-y-2">
          <Label htmlFor="image">Image</Label>
          <Input
            {...register('image')}
            id="image"
            placeholder="myprivaterepo/myservice:1.0.1"
            className={cn({ 'border-destructive': errors.image })}
            aria-invalid={!!errors.image}
            autoComplete="off"
          />
          {errors.image?.message && (
            <p className="text-destructive text-sm">{errors.image.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex flex-row items-center space-x-2">
            <Label htmlFor="pullCredentials">Pull credentials</Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" aria-label="Info" className="flex">
                  <InfoIcon className="h-4 w-4 text-primary" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                If you are publishing your images in your own private registry
                you can add pull credentials to your Run configuration so the
                image can be pulled successfully.
              </TooltipContent>
            </Tooltip>
          </div>
          <Input
            {...register('pullCredentials')}
            id="pullCredentials"
            placeholder="Enter your pull credentials here"
            className={cn({ 'border-destructive': errors.pullCredentials })}
            aria-invalid={!!errors.pullCredentials}
            autoComplete="off"
          />
          {errors.pullCredentials?.message && (
            <p className="text-destructive text-sm">
              {errors.pullCredentials.message}
            </p>
          )}
        </div>

        <div className="grid w-full grid-flow-col justify-start gap-x-1 self-center align-middle">
          <p className="text-sm">
            Learn more about{' '}
            <TextLink
              href="https://docs.nhost.io/products/run/registry#using-your-own-private-registry"
              external
              className="font-medium"
            >
              using your own private registry for images
            </TextLink>
          </p>
        </div>
      </>
    );
  }

  if (imageType === 'public') {
    return (
      <div className="space-y-2">
        <Label htmlFor="image">Image</Label>
        <Input
          {...register('image')}
          id="image"
          placeholder="myimage:1.0.1"
          className={cn({ 'border-destructive': errors.image })}
          aria-invalid={!!errors.image}
          autoComplete="off"
        />
        {errors.image?.message && (
          <p className="text-destructive text-sm">{errors.image.message}</p>
        )}
      </div>
    );
  }
  return null;
}
