import Text from '@/ui/v2/Text';
import type { ImageProps } from 'next/image';
import Image from 'next/image';
import type { DetailedHTMLProps, HTMLProps } from 'react';
import { twMerge } from 'tailwind-merge';

export interface ProjectStatusInfoProps
  extends Omit<
    DetailedHTMLProps<HTMLProps<HTMLDivElement>, HTMLDivElement>,
    'title'
  > {
  /**
   * Title of the project state.
   */
  title: string;
  /**
   * Description of the project state.
   */
  description: string;
  /**
   * Props for the image component.
   */
  imageProps?: Partial<ImageProps>;
}

/**
 * Component to display the project state.
 *
 * @example
 *
 * import ProjectStatusInfo from '@/components/project/ProjectStatusInfo';
 *
 * export default function MyComponent() {
 *   return (
 *    <ProjectStatusInfo
 *      className="mx-auto max-w-md"
 *      title="Application migrating to new version"
 *      description="Your application is currently migrating to a new version. This may take a few minutes. Please try again later."
 *      imageProps={{
 *        src: '/Migrating.png',
 *        alt: 'Application Migrating',
 *      }}
 *    />
 *  )
 * }
 */
export default function ProjectStatusInfo({
  title,
  description,
  className,
  imageProps,
  ...props
}: ProjectStatusInfoProps) {
  return (
    <div
      className={twMerge(
        'mt-8 grid w-full place-content-center gap-2 text-center',
        className,
      )}
      {...props}
    >
      <div className="mx-auto">
        <Image
          src="/terminal-text.svg"
          width="72"
          height="72"
          alt="Application Status"
          priority
          {...imageProps}
        />
      </div>

      <Text variant="h3" className="font-medium">
        {title}
      </Text>
      <Text className="font-normal">{description}</Text>
    </div>
  );
}
