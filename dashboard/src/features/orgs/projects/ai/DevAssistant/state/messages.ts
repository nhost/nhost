import { atom } from 'recoil';
import type { Message } from '@/features/orgs/projects/ai/DevAssistant';
import { persistAtom } from '@/utils/recoil';

export interface ProjectMessage extends Message {
  projectId?: string;
}

const messagesState = atom<ProjectMessage[]>({
  key: 'messages',
  default: [
    {
      id: '0',
      message:
        "Hi, I'm your personal Nhost AI assistant. I'm here to help answer questions, assist with tasks, provide information, or just have a conversation about GraphQL!",
      role: 'assistant',
      createdAt: new Date().toISOString(),
    },
  ],
  effects: [persistAtom],
});

export default messagesState;
