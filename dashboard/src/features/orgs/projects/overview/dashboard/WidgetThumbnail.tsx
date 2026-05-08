import { useLayoutEffect, useRef, useState } from 'react';
import type {
  WidgetConfig,
  WidgetType,
} from '@/features/orgs/projects/overview/dashboard/types';
import { WIDGET_RENDERERS } from '@/features/orgs/projects/overview/dashboard/widgets';

const COL_WIDTH = 90;
const ROW_HEIGHT = 76;

type WidgetThumbnailProps = {
  type: WidgetType;
  cfg: WidgetConfig;
  size: { w: number; h: number };
};

export default function WidgetThumbnail({
  type,
  cfg,
  size,
}: WidgetThumbnailProps) {
  const Renderer = WIDGET_RENDERERS[type];
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  const naturalWidth = size.w * COL_WIDTH;
  const naturalHeight = size.h * ROW_HEIGHT;

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) {
      return undefined;
    }
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect) {
        return;
      }
      setScale(
        Math.min(rect.width / naturalWidth, rect.height / naturalHeight),
      );
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [naturalWidth, naturalHeight]);

  const scaledWidth = naturalWidth * scale;
  const scaledHeight = naturalHeight * scale;

  return (
    <div className="aspect-[16/9] overflow-hidden rounded-md border bg-background-default p-2">
      <div ref={ref} className="relative h-full w-full">
        <div
          className="pointer-events-none absolute origin-top-left select-none"
          style={{
            width: naturalWidth,
            height: naturalHeight,
            transform: `scale(${scale})`,
            left: `calc(50% - ${scaledWidth / 2}px)`,
            top: `calc(50% - ${scaledHeight / 2}px)`,
          }}
        >
          <Renderer cfg={cfg} />
        </div>
      </div>
    </div>
  );
}
