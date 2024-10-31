import { UpgradeToProBanner } from '@/components/common/UpgradeToProBanner';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Alert } from '@/components/ui/v2/Alert';
import { Box } from '@/components/ui/v2/Box';
import { ErrorToast } from '@/components/ui/v2/ErrorToast';
import { IconButton } from '@/components/ui/v2/IconButton';
import { ArrowUpIcon } from '@/components/ui/v2/icons/ArrowUpIcon';
import { Input } from '@/components/ui/v2/Input';
import { Link } from '@/components/ui/v2/Link';
import { Text } from '@/components/ui/v2/Text';
import { MessagesList } from '@/features/orgs/projects/ai/DevAssistant/components/MessagesList';
import {
  messagesState,
  projectMessagesState,
  sessionIDState,
} from '@/features/orgs/projects/ai/DevAssistant/state';
import { useIsGraphiteEnabled } from '@/features/orgs/projects/common/hooks/useIsGraphiteEnabled';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useAdminApolloClient } from '@/features/orgs/projects/hooks/useAdminApolloClient';
import { useOrgs } from '@/features/orgs/projects/hooks/useOrgs';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import {
  useSendDevMessageMutation,
  useStartDevSessionMutation,
  type SendDevMessageMutation,
} from '@/utils/__generated__/graphite.graphql';
import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil';

const MAX_THREAD_LENGTH = 50;

export type Message = Omit<
  SendDevMessageMutation['graphite']['sendDevMessage']['messages'][0],
  '__typename'
>;

export default function DevAssistant() {
  const isPlatform = useIsPlatform();
  const { project } = useProject();
  const { currentOrg } = useOrgs();

  const [loading, setLoading] = useState(false);
  const [userInput, setUserInput] = useState('');
  const setMessages = useSetRecoilState(messagesState);
  const messages = useRecoilValue(projectMessagesState(project?.id));
  const [storedSessionID, setStoredSessionID] = useRecoilState(sessionIDState);

  const { adminClient } = useAdminApolloClient();
  const [startDevSession] = useStartDevSessionMutation({ client: adminClient });
  const [sendDevMessage] = useSendDevMessageMutation({ client: adminClient });

  const { isGraphiteEnabled } = useIsGraphiteEnabled();

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

      const $messages = [
        ...messages,
        {
          id: String(new Date().getTime()),
          message: userInput,
          createdAt: null,
          role: 'user',
          projectId: project?.id,
        },
      ];

      setMessages($messages);

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
          message: userInput,
          sessionId: sessionID || '',
          prevMessageID: !hasBeenAnHourSinceLastMessage
            ? lastMessage?.id || ''
            : '',
        },
      });

      let thread = [
        // remove the temp messages of the user input while we wait for the dev assistant to respond
        ...$messages.filter((item) => item.createdAt),
        ...newMessages

          // remove empty messages
          .filter((item) => item.message)

          // add the currentProject.id to the new messages
          .map((item) => ({ ...item, projectId: project?.id })),
      ];

      if (thread.length > MAX_THREAD_LENGTH) {
        thread = thread.slice(thread.length - MAX_THREAD_LENGTH); // keep the thread at a max length of MAX_THREAD_LENGTH
      }

      setMessages(thread);
    } catch (error) {
      toast.custom(
        (t) => (
          <ErrorToast
            isVisible={t.visible}
            errorMessage="Failed to send the message. Please try again later."
            error={error}
            close={() => toast.dismiss()}
          />
        ),
        {
          duration: Number.POSITIVE_INFINITY,
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

  if (isPlatform && currentOrg?.plan?.isFree) {
    return (
      <Box className="p-4">
        <UpgradeToProBanner
          title="To unlock the DevAssistant, transfer this project to a Pro or Team organization."
          description=""
        />
      </Box>
    );
  }

  if (
    (isPlatform && !currentOrg?.plan?.isFree && !project?.config?.ai) ||
    !isGraphiteEnabled
  ) {
    return (
      <Box className="p-4">
        <Alert className="grid w-full grid-flow-col place-content-between items-center gap-2">
          <Text className="grid grid-flow-row justify-items-start gap-0.5">
            <Text component="span">
              To enable graphite, configure the service first in{' '}
              <Link
                href={`/orgs/${currentOrg?.slug}/projects/${project?.subdomain}/settings/ai`}
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
      <MessagesList loading={loading} />

      <form onSubmit={handleSubmit}>
        <Box className="relative flex w-full flex-row justify-between p-2">
          <Input
            value={userInput}
            onChange={(event) => {
              const { value } = event.target;
              setUserInput(value);
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
