import { recoilPersist } from 'recoil-persist';

const { persistAtom } = recoilPersist({
  key: 'devAssistant',
});

export default persistAtom;
