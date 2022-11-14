import Loading from '@/ui/Loading';

export function LoadingScreen() {
  return (
    <div className="absolute top-0 left-0 z-50 block h-full w-full bg-white">
      <span className="top50percent relative top-1/2 mx-auto my-0 block h-0 w-0">
        <Loading />
      </span>
    </div>
  );
}

export default LoadingScreen;
