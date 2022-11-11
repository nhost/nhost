import { useRouter } from 'next/router';

export const useGetAppURL = (): {
  workspaceSlug: string;
  appSlug: string;
} => {
  const router = useRouter();

  const workspaceSlug = router.query.workspaceSlug as string;
  const appSlug = router.query.appSlug as string;

  return { workspaceSlug, appSlug };
};

export default useGetAppURL;
