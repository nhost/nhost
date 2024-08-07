import { Box } from '@/components/ui/v2/Box';
import { DatabaseMigrateLogsModalText } from '@/features/database/settings/components/DatabaseMigrateLogsModalText';

export default function DatabaseMigrateLogsModal() {
  return (
    <Box className="pt-2">
      <Box
        className="min-h-80 p-4"
        sx={{
          backgroundColor: (theme) =>
            theme.palette.mode === 'dark' ? 'grey.300' : 'grey.700',
        }}
      >
        <DatabaseMigrateLogsModalText />
      </Box>
    </Box>
  );
}
