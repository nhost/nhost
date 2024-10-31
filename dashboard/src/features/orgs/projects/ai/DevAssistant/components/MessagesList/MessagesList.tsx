import { Box } from '@/components/ui/v2/Box';
import { MessageBox } from '@/features/ai/DevAssistant/components/MessageBox';
import { LoadingAssistantMessage } from '@/features/orgs/projects/ai/DevAssistant/components/LoadingAssistantMessage';
import { projectMessagesState } from '@/features/orgs/projects/ai/DevAssistant/state';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { memo, useEffect, useRef } from 'react';
import { useRecoilValue } from 'recoil';

interface MessagesListProps {
  loading: boolean;
}

function MessagesList({ loading }: MessagesListProps) {
  const { project } = useProject();
  const bottomElement = useRef(null);
  const messages = useRecoilValue(projectMessagesState(project?.id));

  const scrollToBottom = () =>
    bottomElement?.current?.scrollIntoView({ behavior: 'instant' });

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  return (
    <Box className="flex grow flex-col overflow-auto border-y">
      {messages.map((message) => (
        <MessageBox key={message.id} message={message} />
      ))}
      {loading && <LoadingAssistantMessage />}
      <div ref={bottomElement} />
    </Box>
  );
}

export default memo(MessagesList);
