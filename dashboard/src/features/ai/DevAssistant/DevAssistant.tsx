import { UpgradeToProBanner } from '@/components/common/UpgradeToProBanner';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Alert } from '@/components/ui/v2/Alert';
import { Avatar } from '@/components/ui/v2/Avatar';
import { Box } from '@/components/ui/v2/Box';
import { IconButton } from '@/components/ui/v2/IconButton';
import { ArrowUpIcon } from '@/components/ui/v2/icons/ArrowUpIcon';
import { GraphiteIcon } from '@/components/ui/v2/icons/GraphiteIcon';
import { Input } from '@/components/ui/v2/Input';
import { Link } from '@/components/ui/v2/Link';
import { Text } from '@/components/ui/v2/Text';
import {
  messagesState,
  projectMessagesState,
  sessionIDState,
} from '@/features/ai/DevAssistant/state';
import { useAdminApolloClient } from '@/features/projects/common/hooks/useAdminApolloClient';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { getToastStyleProps } from '@/utils/constants/settings';
import {
  useSendDevMessageMutation,
  useStartDevSessionMutation,
  type SendDevMessageMutation,
} from '@/utils/__generated__/graphite.graphql';
import { useTheme } from '@mui/material';
import { useUserData } from '@nhost/nextjs';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import Markdown from 'react-markdown';
import { useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil';
import rehypeHighlight from 'rehype-highlight';
import remarkGFM from 'remark-gfm';
import { twMerge } from 'tailwind-merge';

const MAX_THREAD_LENGTH = 50;

export type Message = Omit<
  SendDevMessageMutation['graphite']['sendDevMessage']['messages'][0],
  '__typename'
>;

function MessageBox({ message }: { message: Message }) {
  const user = useUserData();
  const isUserMessage = message.role === 'user';
  const theme = useTheme();

  return (
    <Box
      className="flex flex-col space-y-4 border-t p-4 first:border-t-0"
      sx={{
        backgroundColor: isUserMessage && 'background.default',
      }}
    >
      <div className="flex items-center space-x-2">
        {message.role === 'assistant' ? (
          <>
            <GraphiteIcon />
            <Text className="font-bold">Assistant</Text>
          </>
        ) : (
          <>
            <Avatar
              className="h-7 w-7 rounded-full"
              alt={user?.displayName}
              src={user?.avatarUrl}
            >
              {user?.displayName || 'local'}
            </Avatar>
            <Text className="font-bold">
              {user?.displayName || 'local'} (You)
            </Text>
          </>
        )}
      </div>

      <Markdown
        className={twMerge(
          'prose',
          theme.palette.mode === 'dark' && 'prose-invert',
        )}
        rehypePlugins={[rehypeHighlight]}
        remarkPlugins={[remarkGFM]}
      >
        {message.message}
      </Markdown>
    </Box>
  );
}

function LoadingAssistantMessage({ userMessage }: { userMessage: string }) {
  return (
    <Box className="flex grow flex-col border-t">
      <MessageBox
        message={{
          id: String(new Date().getTime()),
          createdAt: new Date(),
          role: 'user',
          message: userMessage,
        }}
      />
      <Box className="flex flex-col space-y-4 border-t p-4">
        <div className="flex items-center space-x-2">
          <GraphiteIcon />
          <Text className="font-bold">Assistant</Text>
        </div>
        <div className="flex space-x-1">
          <Box
            className="h-1.5 w-1.5 animate-blinking rounded-full"
            sx={{ backgroundColor: 'grey.600' }}
          />
          <Box
            className="h-1.5 w-1.5 animate-blinking rounded-full animate-delay-150"
            sx={{ backgroundColor: 'grey.600' }}
          />
          <Box
            className="h-1.5 w-1.5 animate-blinking rounded-full animate-delay-300"
            sx={{ backgroundColor: 'grey.600' }}
          />
        </div>
      </Box>
    </Box>
  );
}

export default function DevAssistant() {
  const { currentProject, currentWorkspace } = useCurrentWorkspaceAndProject();

  const bottomElement = useRef(null);
  const [loading, setLoading] = useState(false);
  const [userInput, setUserInput] = useState('');
  const [userMessage, setUserMessage] = useState('');
  const setMessages = useSetRecoilState(messagesState);
  const messages = useRecoilValue(projectMessagesState(currentProject.id));
  const [storedSessionID, setStoredSessionID] = useRecoilState(sessionIDState);

  const { adminClient } = useAdminApolloClient();
  const [startDevSession] = useStartDevSessionMutation({ client: adminClient });
  const [sendDevMessage] = useSendDevMessageMutation({ client: adminClient });

  const scrollToBottom = () =>
    bottomElement?.current?.scrollIntoView({ behavior: 'instant' });

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      setLoading(true);
      setUserInput('');

      let sessionID = storedSessionID;
      const lastMessage = messages.slice(1).pop(); // The first message is a welcome message, so we exclude it

      let hasBeenAnHourSinceLastMessage = false;
      if (lastMessage) {
        hasBeenAnHourSinceLastMessage =
          new Date().getTime() - new Date(lastMessage.createdAt).getTime() >
          60 * 60 * 1000;
      }

      if (!sessionID || hasBeenAnHourSinceLastMessage) {
        const sessionRes = await startDevSession({ client: adminClient });
        sessionID = sessionRes?.data?.graphite?.startDevSession?.sessionID;
        setStoredSessionID(sessionID);
      }

      if (!sessionID) {
        throw new Error('Failed to start a new session');
      }

      const {
        data: {
          graphite: { sendDevMessage: { messages: newMessages } = {} } = {},
        } = {},
      } = await sendDevMessage({
        variables: {
          message: userMessage,
          sessionId: sessionID || '',
          prevMessageID: !hasBeenAnHourSinceLastMessage
            ? lastMessage?.id || ''
            : '',
        },
      });

      let thread = [
        ...messages,
        ...newMessages
          .filter((item) => item.message) // remove empty messages
          .map((item) => ({ ...item, projectId: currentProject.id })), // add the currentProject.id to the new messages
      ];

      if (thread.length > MAX_THREAD_LENGTH) {
        thread = thread.slice(thread.length - MAX_THREAD_LENGTH); // keep the thread at a max length of MAX_THREAD_LENGTH
      }

      setMessages(thread);
    } catch (error) {
      toast.error(
        'Failed to send the message to graphite. Please try again later.',
        {
          style: getToastStyleProps().style,
          ...getToastStyleProps().error,
        },
      );
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      const form = event.currentTarget.closest('form');
      if (form) {
        form.dispatchEvent(
          new Event('submit', { bubbles: true, cancelable: true }),
        );
      }
    }
  };

  if (currentProject.plan.isFree) {
    return (
      <Box className="p-4">
        <UpgradeToProBanner
          title="Upgrade to Nhost Pro."
          description={
            <Text>
              Graphite is an addon to the Pro plan. To unlock it, please upgrade
              to Pro first.
            </Text>
          }
        />
      </Box>
    );
  }

  if (!currentProject.plan.isFree && !currentProject.config?.ai) {
    return (
      <Box className="p-4">
        <Alert className="grid w-full grid-flow-col place-content-between items-center gap-2">
          <Text className="grid grid-flow-row justify-items-start gap-0.5">
            <Text component="span">
              To enable graphite, configure the service first in{' '}
              <Link
                href={`/${currentWorkspace.slug}/${currentProject.slug}/settings/ai`}
                target="_blank"
                rel="noopener noreferrer"
                underline="hover"
              >
                AI Settings
              </Link>
              .
            </Text>
          </Text>
        </Alert>
      </Box>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-auto">
      <Box className="flex grow flex-col overflow-auto border-y">
        {messages.map((message) => (
          <MessageBox key={message.id} message={message} />
        ))}
        {loading && userMessage && (
          <LoadingAssistantMessage userMessage={userMessage} />
        )}
        <div ref={bottomElement} />
      </Box>

      <form onSubmit={handleSubmit}>
        <Box className="relative flex w-full flex-row justify-between p-2">
          <Input
            value={userInput}
            onChange={(event) => {
              const { value } = event.target;
              setUserInput(value);
              setUserMessage(value);
            }}
            onKeyPress={handleKeyPress}
            placeholder="Ask graphite anything!"
            className="w-full"
            required
            slotProps={{
              input: { className: 'w-full rounded-none border-none' },
            }}
            multiline
            maxRows={7}
          />

          <IconButton
            disabled={!userInput || loading}
            color="primary"
            aria-label="Send"
            type="submit"
            className="absolute right-2 h-10 w-12 self-end rounded-xl"
          >
            {loading ? <ActivityIndicator /> : <ArrowUpIcon />}
          </IconButton>
        </Box>
      </form>
    </div>
  );
}
