import { Separator } from '@/components/ui/v3/separator';
import { ExportMetadataSection } from './sections/ExportMetadataSection';
import { ImportMetadataSection } from './sections/ImportMetadataSection';

export default function ImportExportMetadataCard() {
  return (
    <div className="flex flex-col gap-1 rounded-lg border bg-paper p-4">
      <h3 className="mb-4 font-medium text-foreground text-lg">
        Import & Export Metadata
      </h3>

      <div className="flex flex-col gap-2 lg:flex-row">
        <ImportMetadataSection />
        <Separator orientation="horizontal" className="lg:hidden" />
        <Separator orientation="vertical" className="hidden lg:block" />
        <ExportMetadataSection />
      </div>
    </div>
  );
}
