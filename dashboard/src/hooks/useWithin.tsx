import { nhost } from '@/utils/nhost';

export function useWithin() {
  const user = nhost.auth.getUser();

  if (!user) {
    return { within: false };
  }

  const userCreatedDate = new Date(user.createdAt).getTime();
  const currentDate = new Date().getTime();
  const CHECK_AMOUNT = 30000;
  const within = userCreatedDate + CHECK_AMOUNT > currentDate;
  return { within };
}

export default useWithin;
