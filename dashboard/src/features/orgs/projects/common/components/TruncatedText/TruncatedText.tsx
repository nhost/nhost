import { cn } from '@/lib/utils';

interface TruncatedTextProps {
  text: string;
  className?: string;
  tailLength?: number;
}

export default function TruncatedText({
  text,
  className,
  tailLength = 4,
}: TruncatedTextProps) {
  const startPart = text.slice(0, -tailLength);
  const endPart = text.slice(-tailLength);

  return (
    <div className={cn('flex min-w-0', className)}>
      <div className="truncate">{startPart}</div>
      <div className="shrink-0">{endPart}</div>
    </div>
  );
}
