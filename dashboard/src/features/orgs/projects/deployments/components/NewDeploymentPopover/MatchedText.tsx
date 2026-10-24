import { splitHighlight } from '@/features/orgs/projects/deployments/utils/deploy-suggestions';

export default function MatchedText({
  text,
  query,
}: {
  text: string;
  query: string;
}) {
  return splitHighlight(text, query).map((part) =>
    part.highlighted ? (
      <mark
        key={part.start}
        className="bg-transparent font-medium text-primary"
      >
        {part.text}
      </mark>
    ) : (
      <span key={part.start}>{part.text}</span>
    ),
  );
}
