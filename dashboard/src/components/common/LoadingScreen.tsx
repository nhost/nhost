import ActivityIndicator from '@/ui/v2/ActivityIndicator';
import Box from '@/ui/v2/Box';

export function LoadingScreen() {
  return (
    <Box className="absolute top-0 left-0 bottom-0 right-0 flex items-center justify-center z-50 h-full w-full">
      <ActivityIndicator circularProgressProps={{ className: 'w-5 h-5' }} />
    </Box>
  );
}

export default LoadingScreen;
