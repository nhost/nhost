import { type ReactNode, useEffect, useRef, useState } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import { cn } from '@/lib/utils';

interface TextWithTooltipProps {
  text: string | number | ReactNode;
  className?: string;
  containerClassName?: string;
  slotProps?: {
    container?: React.HTMLAttributes<HTMLDivElement>;
  };
}

export default function TextWithTooltip({
  text,
  containerClassName,
  className,
  slotProps,
}: TextWithTooltipProps) {
  const [isTruncated, setIsTruncated] = useState<boolean>(false);
  const textRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkTruncation = () => {
      if (textRef.current) {
        const { scrollWidth, clientWidth } = textRef.current;
        setIsTruncated(scrollWidth > clientWidth);
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
  }, []);

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
