import { Text } from '@/components/ui/v2/Text';
import { OverviewCard } from '@/features/projects/overview/components/OverviewCard';
import type { CardProps } from '@/features/projects/overview/types/cards';
import { useTheme } from '@mui/material';
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
  cardElements: CardProps[];
}

export default function OverviewDocumentation({
  title,
  description,
  cardElements,
  ...props
}: OverviewDocumentationProps) {
  const theme = useTheme();

  return (
    <div {...props}>
      <div className="grid grid-flow-row gap-1">
        <Text variant="h3">{title}</Text>
        <Text color="secondary">{description}</Text>
      </div>

      <div className="mt-6 grid grid-flow-row items-center gap-6 xs:grid-cols-2 lg:gap-4 xl:grid-cols-4">
        {cardElements.map(
          ({
            title: cardTitle,
            description: cardDescription,
            icon,
            lightIcon,
            iconIsComponent,
            disableIconBackground,
            link,
          }) => (
            <OverviewCard
              key={cardTitle}
              title={cardTitle}
              description={cardDescription}
              icon={theme.palette.mode === 'dark' ? lightIcon || icon : icon}
              slotProps={{
                iconWrapper: {
                  sx: {
                    backgroundColor: disableIconBackground
                      ? 'transparent'
                      : 'background.paper',
                    borderColor: 'grey.300',
                    borderWidth: disableIconBackground ? 0 : 1,
                  },
                  className: !disableIconBackground
                    ? 'shadow-2xl justify-center rounded-full'
                    : 'inline-flex h-12 w-12 items-center',
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
