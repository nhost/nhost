import { atom } from 'recoil';
import { persistAtom } from '@/utils/recoil';

const sessionIDState = atom<string>({
  key: 'sessionID',
  default: '',
  effects: [persistAtom],
});

export default sessionIDState;
