import type { CardElement } from '@/components/overview/frameworks';
import OverviewCard from '@/components/overview/OverviewCard';
import Text from '@/ui/v2/Text';
import type { DetailedHTMLProps, HTMLProps } from 'react';

export interface OverviewDocumentationProps
  extends DetailedHTMLProps<HTMLProps<HTMLDivElement>, HTMLDivElement> {
  /**
   * The title of the documentation section.
   */
  title: string;
  /**
   * Description of the documentation section
   */
  description: string;
  /**
   * The elements to display in the card.
   */
  cardElements: CardElement[];
}

export default function OverviewDocumentation({
  title,
  description,
  cardElements,
  ...props
}: OverviewDocumentationProps) {
  return (
    <div {...props}>
      <Text variant="h3">{title}</Text>

      <Text variant="body1">{description}</Text>
      <div className="mt-6 grid grid-flow-row items-center gap-6 xs:grid-cols-2 lg:grid-cols-4 lg:gap-4">
        {cardElements.map(
          ({
            title: cardTitle,
            description: cardDescription,
            icon,
            iconIsComponent,
            disableIconBackground,
            link,
          }) => (
            <OverviewCard
              key={cardTitle}
              title={cardTitle}
              description={cardDescription}
              icon={icon}
              componentsProps={{
                iconWrapper: {
                  className: !disableIconBackground
                    ? 'border-gray-500 bg-white shadow-2xl justify-center rounded-full text-greyscaleGreyDark'
                    : 'inline-flex h-12 w-12 items-center text-greyscaleGreyDark',
                },
                imgIcon: {
                  width: !disableIconBackground ? 32 : 42,
                  height: !disableIconBackground ? 32 : 42,
                },
              }}
              link={link}
              iconIsComponent={iconIsComponent}
            />
          ),
        )}
      </div>
    </div>
  );
}
