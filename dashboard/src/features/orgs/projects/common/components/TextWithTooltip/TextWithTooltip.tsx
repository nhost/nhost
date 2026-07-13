import { useEffect, useRef, useState } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import { cn } from '@/lib/utils';

interface TextWithTooltipProps {
  text: string;
  className?: string;
  containerClassName?: string;
  truncateMode?: 'end' | 'middle';
  tailLength?: number;
  maxLines?: number;
  slotProps?: {
    container?: React.HTMLAttributes<HTMLDivElement>;
  };
}

export default function TextWithTooltip({
  text,
  containerClassName,
  className,
  truncateMode = 'end',
  tailLength = 4,
  maxLines,
  slotProps,
}: TextWithTooltipProps) {
  const [isTruncated, setIsTruncated] = useState<boolean>(false);
  const textRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkTruncation = () => {
      if (textRef.current) {
        const { scrollWidth, clientWidth, scrollHeight, clientHeight } =
          textRef.current;
        setIsTruncated(
          maxLines != null
            ? scrollHeight > clientHeight
            : scrollWidth > clientWidth,
        );
      }
    };

    const resizeObserver = new ResizeObserver(() => {
      checkTruncation();
    });

    if (textRef.current) {
      resizeObserver.observe(textRef.current);
    }

    checkTruncation();

    return () => {
      resizeObserver.disconnect();
    };
  }, [maxLines]);

  if (maxLines != null) {
    return (
      <div className={containerClassName} {...slotProps?.container}>
        <Tooltip>
          <TooltipTrigger disabled={!isTruncated} asChild>
            <div
              ref={textRef}
              className={cn(!isTruncated && 'pointer-events-none', className)}
              style={{
                display: '-webkit-box',
                WebkitBoxOrient: 'vertical',
                WebkitLineClamp: maxLines,
                overflow: 'hidden',
              }}
            >
              {text}
            </div>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs break-words">
            {text}
          </TooltipContent>
        </Tooltip>
      </div>
    );
  }

  const isMiddle = truncateMode === 'middle' && text.length > tailLength;

  if (isMiddle) {
    const startPart = text.slice(0, -tailLength);
    const endPart = text.slice(-tailLength);

    return (
      <div className={containerClassName} {...slotProps?.container}>
        <Tooltip>
          <TooltipTrigger disabled={!isTruncated} asChild>
            <div
              className={cn(
                'flex min-w-0 overflow-x-auto',
                !isTruncated && 'pointer-events-none',
                className,
              )}
            >
              <div ref={textRef} className="truncate">
                {startPart}
              </div>
              <div className="shrink-0">{endPart}</div>
            </div>
          </TooltipTrigger>
          <TooltipContent>{text}</TooltipContent>
        </Tooltip>
      </div>
    );
  }

  return (
    <div className={containerClassName} {...slotProps?.container}>
      <Tooltip>
        <TooltipTrigger disabled={!isTruncated} asChild>
          <div
            ref={textRef}
            className={cn(
              'truncate',
              !isTruncated && 'pointer-events-none',
              className,
            )}
          >
            {text}
          </div>
        </TooltipTrigger>
        <TooltipContent>{text}</TooltipContent>
      </Tooltip>
    </div>
  );
}
