import { isSelfHosted } from '@/utils/env';

export default function useIsSelfHosted() {
  return isSelfHosted();
}
