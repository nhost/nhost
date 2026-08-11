import type { HTMLAttributes } from 'react';
import { OverviewCard } from '@/features/orgs/projects/overview/components/OverviewCard';
import type { CardProps } from '@/features/orgs/projects/overview/types/cards';

export interface OverviewDocumentationProps
  extends HTMLAttributes<HTMLDivElement> {
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
  return (
    <section {...props}>
      <div className="grid grid-flow-row gap-1">
        <h2 className="font-semibold text-lg">{title}</h2>
        <p className="text-muted-foreground">{description}</p>
      </div>

      <div className="mt-6 grid grid-flow-row xs:grid-cols-2 items-center gap-6 lg:gap-4 xl:grid-cols-4">
        {cardElements.map((cardElement) => (
          <OverviewCard key={cardElement.title} {...cardElement} />
        ))}
      </div>
    </section>
  );
}
