import { Box } from '@/components/ui/v2/Box';
import { LoadingAssistantMessage } from '@/features/ai/DevAssistant/components/LoadingAssistantMessage';
import { MessageBox } from '@/features/ai/DevAssistant/components/MessageBox';
import { projectMessagesState } from '@/features/ai/DevAssistant/state';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { memo, useEffect, useRef } from 'react';
import { useRecoilValue } from 'recoil';

interface MessagesListProps {
  loading: boolean;
}

function MessagesList({ loading }: MessagesListProps) {
  const bottomElement = useRef(null);
  const { currentProject } = useCurrentWorkspaceAndProject();
  const messages = useRecoilValue(projectMessagesState(currentProject.id));

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
