import { Box } from '@/components/ui/v2/Box';
import { GraphiteIcon } from '@/components/ui/v2/icons/GraphiteIcon';
import { Text } from '@/components/ui/v2/Text';

export default function LoadingAssistantMessage() {
  return (
    <Box className="flex flex-col space-y-4 border-t p-4">
      <div className="flex items-center space-x-2">
        <GraphiteIcon />
        <Text className="font-bold">Assistant</Text>
      </div>
      <div className="flex space-x-1">
        <Box
          className="h-1.5 w-1.5 animate-blinking rounded-full"
          sx={{ backgroundColor: 'grey.600' }}
        />
        <Box
          className="h-1.5 w-1.5 animate-blinking rounded-full animate-delay-150"
          sx={{ backgroundColor: 'grey.600' }}
        />
        <Box
          className="h-1.5 w-1.5 animate-blinking rounded-full animate-delay-300"
          sx={{ backgroundColor: 'grey.600' }}
        />
      </div>
    </Box>
  );
}
