import { DialogHeader, DialogTitle } from '@/components/ui/v3/dialog';
import { Skeleton } from '@/components/ui/v3/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/v3/table';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/v3/tabs';

export default function InvocationLogDetailsDialogSkeleton() {
  const skeletonRowKeys = ['row-1', 'row-2', 'row-3'];
  const renderSkeletonTableRows = () =>
    skeletonRowKeys.map((key) => (
      <TableRow key={key}>
        <TableCell className="font-mono text-foreground">
          <Skeleton className="h-4 w-24" />
        </TableCell>
        <TableCell className="font-mono text-muted-foreground">
          <Skeleton className="h-4 w-40" />
        </TableCell>
      </TableRow>
    ));

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-foreground">
          Invocation Log Details
        </DialogTitle>
      </DialogHeader>
      <div className="grid grid-cols-2 gap-4 rounded border p-4">
        <div className="space-y-2">
          <div className="flex justify-between gap-1">
            <span className="font-medium text-muted-foreground text-sm">
              ID:
            </span>
            <Skeleton className="h-4 w-48" />
          </div>
          <div className="flex justify-between gap-1">
            <span className="font-medium text-muted-foreground text-sm">
              Event ID:
            </span>
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between gap-1">
            <span className="font-medium text-muted-foreground text-sm">
              HTTP Status:
            </span>
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="flex justify-between gap-1">
            <span className="font-medium text-muted-foreground text-sm">
              Created:
            </span>
            <Skeleton className="h-4 w-40" />
          </div>
        </div>
      </div>
      <Tabs defaultValue="request" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="request">Request</TabsTrigger>
          <TabsTrigger value="response">Response</TabsTrigger>
        </TabsList>
        <TabsContent value="request" className="space-y-4">
          <div>
            <h4 className="mb-2 font-medium text-foreground">Headers</h4>
            <div className="rounded border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>{renderSkeletonTableRows()}</TableBody>
              </Table>
            </div>
          </div>
          <div>
            <h4 className="mb-2 font-medium text-foreground">Payload</h4>
            <Skeleton className="h-32 w-full" />
          </div>
        </TabsContent>
        <TabsContent value="response" className="space-y-4">
          <div className="flex items-center gap-4 text-sm">
            <div>
              <span className="font-medium">Status: </span>
              <Skeleton className="h-4 w-16" />
            </div>
            <div>
              <span className="font-medium">Type: </span>
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
          <div>
            <h4 className="mb-2 font-medium">Headers</h4>
            <div className="rounded border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>{renderSkeletonTableRows()}</TableBody>
              </Table>
            </div>
          </div>
          <div>
            <h4 className="mb-2 font-medium">Response Body</h4>
            <Skeleton className="h-32 w-full" />
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}
