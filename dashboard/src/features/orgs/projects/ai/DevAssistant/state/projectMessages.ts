import { selectorFamily } from 'recoil';
import messagesState, {
  type ProjectMessage,
} from '@/features/orgs/projects/ai/DevAssistant/state/messages';

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
