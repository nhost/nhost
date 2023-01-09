import { triggerToast } from './toast';

export function copy(toCopy: string, name: string) {
  navigator.clipboard.writeText(toCopy).catch(() => {
    triggerToast('Error while copying');
  });

  triggerToast(`${name} copied to clipboard`);
}

export default copy;
