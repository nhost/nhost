import { Text } from '@/components/ui/v2/Text';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/v3/table';
import { isHeaderWithEnvValue } from '@/features/orgs/projects/remote-schemas/utils/guards';
import type { RemoteSchemaInfoDefinitionHeadersItem } from '@/utils/hasura-api/generated/schemas';

export interface RemoteSchemaHeadersTableProps {
  headers?: RemoteSchemaInfoDefinitionHeadersItem[];
}

export default function RemoteSchemaHeadersTable({
  headers,
}: RemoteSchemaHeadersTableProps) {
  return (
    <div>
      <Text variant="h3" className="pb-2">
        Headers
      </Text>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">Name</TableHead>
            <TableHead>Type</TableHead>
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
    </div>
  );
}
