import messagesState, {
  type ProjectMessage,
} from '@/features/ai/DevAssistant/state/messages';
import { selectorFamily } from 'recoil';

const projectMessagesState = selectorFamily<ProjectMessage[], string>({
  key: 'projectMessages',
  get:
    (projectId) =>
    ({ get }) => {
      const messages = get(messagesState);

      return messages.filter(
        (message) =>
          message.projectId === projectId || message.projectId === undefined,
      );
    },
});

export default projectMessagesState;
