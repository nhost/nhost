import Loading from '@/ui/Loading';
import Box from '@/ui/v2/Box';
import { useTheme } from '@mui/material';

export function LoadingScreen() {
  const theme = useTheme();

  return (
    <Box className="absolute top-0 left-0 z-50 block h-full w-full">
      <span className="top50percent relative top-1/2 mx-auto my-0 block h-0 w-0">
        <Loading color={theme.palette.mode === 'dark' ? 'white' : 'dark'} />
      </span>
    </Box>
  );
}

export default LoadingScreen;
