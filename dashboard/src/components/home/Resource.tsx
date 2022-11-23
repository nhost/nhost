import { Text } from '@/ui/Text';
import Image from 'next/image';

interface ResourceProps {
  text: string;
  logo: string;
  link: string;
}

export function Resource({ text, logo, link }: ResourceProps) {
  return (
    <a
      href={link}
      target="_blank"
      rel="noreferrer"
      className="flex justify-between py-1 align-middle "
    >
      <div className="flex items-center align-middle">
        <Image src={`/logos/${logo}.svg`} alt={text} width={20} height={20} />

        <Text
          className="ml-2 inline-flex self-center align-middle font-medium"
          size="normal"
          color="greyscaleDark"
        >
          {text}
        </Text>
      </div>
      <div className="flex self-center">
        <Image
          src="/icons/ArrowSquareOut.svg"
          alt="Arrow pointing outwards"
          width={16}
          height={16}
        />
      </div>
    </a>
  );
}

export default Resource;
