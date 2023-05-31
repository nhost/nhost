import { ArrowSquareOutIcon } from '@/components/ui/v2/icons/ArrowSquareOutIcon';
import { Text } from '@/components/ui/v2/Text';
import { useTheme } from '@mui/material';
import Image from 'next/image';

export interface ResourceProps {
  text: string;
  logo: string;
  link: string;
}

export default function Resource({ text, logo, link }: ResourceProps) {
  const theme = useTheme();

  return (
    <a
      href={link}
      target="_blank"
      rel="noreferrer"
      className="flex justify-between py-1 align-middle"
    >
      <div className="flex items-center align-middle">
        <Image
          src={
            theme.palette.mode === 'dark'
              ? `/logos/light/${logo}.svg`
              : `/logos/${logo}.svg`
          }
          alt={text}
          width={20}
          height={20}
        />

        <Text className="ml-2 inline-flex self-center align-middle font-medium">
          {text}
        </Text>
      </div>
      <div className="flex self-center">
        <ArrowSquareOutIcon className="h-4 w-4" />
      </div>
    </a>
  );
}
