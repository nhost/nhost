import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/v3/table';
import type { Headers } from '@/utils/hasura-api/generated/schemas';
import { isHeaderWithEnvValue } from '@/utils/hasura-api/guards';

export interface EventTriggerHeadersTableProps {
  headers: Headers;
}

export default function EventTriggerHeadersTable({
  headers,
}: EventTriggerHeadersTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[300px]">Name</TableHead>
          <TableHead className="w-[150px]">Type</TableHead>
          <TableHead>Value</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {headers?.map((header) => {
          if (isHeaderWithEnvValue(header)) {
            return (
              <TableRow key={header.name}>
                <TableCell className="font-medium">{header.name}</TableCell>
                <TableCell>From env var</TableCell>
                <TableCell>{header.value_from_env}</TableCell>
              </TableRow>
            );
          }

          return (
            <TableRow key={header.name}>
              <TableCell className="font-medium">{header.name}</TableCell>
              <TableCell>Value</TableCell>
              <TableCell>{header.value}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
