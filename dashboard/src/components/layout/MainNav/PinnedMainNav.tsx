import { useRouter } from 'next/router';
import { useEffect, useRef } from 'react';
import NavTree from '@/components/layout/MainNav/NavTree';

export default function PinnedMainNav() {
  const {
    asPath,
    query: { orgSlug },
  } = useRouter();

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let observer: MutationObserver;

    const scrollToElement = () => {
      const element = document.querySelector(`a[href="${asPath}"]`);
      if (element) {
        element.scrollIntoView({ block: 'center' });
        observer.disconnect();
      }
    };

    if (scrollContainerRef.current) {
      observer = new MutationObserver(scrollToElement);

      observer.observe(scrollContainerRef.current, {
        childList: true,
        subtree: true,
        attributeFilter: ['class'],
      });
    }

    return () => {
      if (observer) {
        observer.disconnect();
      }
    };
  }, [asPath]);

  if (!orgSlug) {
    return null;
  }

  return (
    <div className="flex h-full w-full flex-shrink-0 flex-col border-r p-0 sm:max-w-[304px]">
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-auto pt-2 pb-12 [scrollbar-gutter:stable]"
      >
        <div className="flex flex-col gap-1 pr-6 pl-12">
          <NavTree />
        </div>
      </div>
    </div>
  );
}
