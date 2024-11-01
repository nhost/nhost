import { Box } from '@/components/ui/v2/Box';
import { Text } from '@/components/ui/v2/Text';
import { Label } from '@/components/ui/v3/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/v3/radio-group';
import { ImageField } from '@/features/orgs/projects/services/components/ServiceForm/components/ImageField';

interface ImageFormSectionProps {
  onImageTypeChange?: (value: 'public' | 'private' | 'nhost') => void;
  privateRegistryImage?: string;
  imageType?: 'public' | 'private' | 'nhost';
  initialImageTag?: string;
}

export default function ImageFormSection({
  privateRegistryImage,
  imageType,
  onImageTypeChange,
  initialImageTag,
}: ImageFormSectionProps) {
  return (
    <Box className="space-y-4 rounded border-1 p-4">
      <Box className="flex flex-row items-center space-x-2">
        <Text variant="h4" className="font-semibold">
          Image
        </Text>
      </Box>
      <RadioGroup
        className="flex flex-row space-x-2"
        defaultValue="public"
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
      <ImageField
        privateRegistryImage={privateRegistryImage}
        imageType={imageType}
        initialImageTag={initialImageTag}
      />
    </Box>
  );
}
