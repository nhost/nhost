import Image from 'next/image';

export default function ApplicationPausedSymbol({
  isLocked,
}: {
  isLocked?: boolean;
}) {
  if (isLocked) {
    return (
      <Image src="/assets/LockedApp.svg" alt="Lock" width={72} height={72} />
    );
  }

  // paused
  return (
    <Image
      src="/assets/PausedApp.svg"
      alt="Closed Eye"
      width={72}
      height={72}
    />
  );
}
