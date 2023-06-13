import { triggerToast } from '@/utils/toast';

export default function copy(toCopy: string, name?: string) {
  navigator.clipboard.writeText(toCopy).catch(() => {
    triggerToast('Error while copying');
  });

  if (!name) {
    return;
  }

  triggerToast(`${name} copied to clipboard`);
}
