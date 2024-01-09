import { persistAtom } from '@/utils/recoil';
import { atom } from 'recoil';

const sessionIDState = atom<string>({
  key: 'sessionID',
  default: '',
  effects: [persistAtom],
});

export default sessionIDState;
