import { offset, useFloating } from '@floating-ui/react';
import { useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/v3/popover';
import ColumnCustomizer from './ColumnCustomizer';
import DataGridCustomizerTrigger from './DataGridCustomizerTrigger';
import RowDensityCustomizer from './RowDensityCustomizer';

function DataGridTableViewConfigurationPopover() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Need to reset the popup styles beacuse they use transform
  // and makes the drag and drop list not work correctly
  const { floatingStyles, refs } = useFloating({
    transform: false,
    strategy: 'fixed',
    placement: 'bottom-end',
    middleware: [offset(12)],
  });

  // NOTE: this will remove a warning from the hello-pangea/dnd package
  const portaledContainer = createPortal(
    <div
      id="reset-popper-content-wrapper-styles"
      ref={containerRef}
      style={{ overflow: 'unset' }}
    />,
    document.body,
  );

  return (
    <>
      {portaledContainer}
      <Popover>
        <PopoverTrigger asChild ref={refs.setReference}>
          <DataGridCustomizerTrigger />
        </PopoverTrigger>
        <PopoverContent
          container={containerRef.current}
          ref={refs.setFloating}
          style={floatingStyles}
          className="box flex flex-col gap-6 p-4 md:w-[30rem] md:max-w-[30rem]"
          align="end"
        >
          <h2>Customize Table View </h2>
          <RowDensityCustomizer />
          <ColumnCustomizer />
        </PopoverContent>
      </Popover>
    </>
  );
}

export default DataGridTableViewConfigurationPopover;
