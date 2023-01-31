import { useInsertFeedbackOneMutation } from '@/generated/graphql';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import { Avatar } from '@/ui/Avatar';
import Button from '@/ui/v2/Button';
import Input from '@/ui/v2/Input';
import Text from '@/ui/v2/Text';
import { useUserData } from '@nhost/nextjs';
import * as React from 'react';

export function SendFeedback({ setFeedbackSent, feedback, setFeedback }: any) {
  const { currentApplication } = useCurrentWorkspaceAndApplication();
  const [insertFeedback, { loading }] = useInsertFeedbackOneMutation();
  const user = useUserData();

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();

    const feedbackWithProjectInfo = [
      currentApplication && `Project ID: ${currentApplication.id}`,
      typeof window !== 'undefined' && `URL: ${window.location.href}`,
      feedback,
    ]
      .filter(Boolean)
      .join('\n\n');

    try {
      await insertFeedback({
        variables: {
          feedback: {
            feedback: feedbackWithProjectInfo,
          },
        },
      });
      setFeedbackSent(true);
      setFeedback('');
    } catch (error) {
      // TODO: Display error to user and use a logging solution
    }
  }
  return (
    <div className="grid grid-flow-row gap-2">
      <Text variant="h3" component="h2">
        Leave Feedback
      </Text>

      <Text>
        Nhost is still in beta and not everything is in place yet, but we&apos;d
        love to know what you think of it so far.
      </Text>

      <form onSubmit={handleSubmit} className="grid grid-flow-row gap-2">
        <div className="grid grid-flow-col place-content-between gap-2">
          <Text className="font-medium">
            What do you think we should improve?
          </Text>

          <Avatar
            className="h-6 w-6 rounded-full"
            name={user?.displayName}
            avatarUrl={user?.avatarUrl}
          />
        </div>

        <Input
          multiline
          value={feedback}
          onChange={(event) => setFeedback(event.target.value)}
          placeholder="Your feedback"
          rows={6}
          required
          fullWidth
          hideEmptyHelperText
        />

        <Button type="submit" disabled={!feedback} loading={loading}>
          Send Feedback
        </Button>
      </form>
    </div>
  );
}

export default SendFeedback;
