import { Avatar } from '@/components/ui/v2/Avatar';
import { Button } from '@/components/ui/v2/Button';
import { Input } from '@/components/ui/v2/Input';
import { Text } from '@/components/ui/v2/Text';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { useInsertFeedbackOneMutation } from '@/utils/__generated__/graphql';
import { useUserData } from '@nhost/nextjs';
import Image from 'next/image';
import type { DetailedHTMLProps, HTMLProps } from 'react';
import { useState } from 'react';
import { twMerge } from 'tailwind-merge';

export interface FeedbackFormProps
  extends DetailedHTMLProps<HTMLProps<HTMLDivElement>, HTMLDivElement> {}

// TODO: Use `react-hook-form` here instead of the custom form implementation
export default function FeedbackForm({
  className,
  ...props
}: FeedbackFormProps) {
  const { currentProject } = useCurrentWorkspaceAndProject();
  const [insertFeedback, { loading }] = useInsertFeedbackOneMutation();
  const user = useUserData();

  const [feedback, setFeedback] = useState('');
  const [feedbackSent, setFeedbackSent] = useState(false);

  function handleClose() {
    setTimeout(() => {
      setFeedbackSent(false);
    }, 500);
  }

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();

    const feedbackWithProjectInfo = [
      currentProject && `Project ID: ${currentProject.id}`,
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

  if (feedbackSent) {
    return (
      <div
        className={twMerge(
          'grid max-w-md grid-flow-row justify-center gap-4 py-4 px-5 text-center',
          className,
        )}
        {...props}
      >
        <Image
          src="/assets/FeedbackReceived.svg"
          alt="Light bulb with a checkmark"
          width={72}
          height={72}
        />

        <div className="grid grid-flow-row gap-2">
          <Text variant="h3" component="h2" className="text-center">
            Feedback Received
          </Text>

          <Text>
            Thanks for sending us your thoughts! Feel free to send more feedback
            as you explore the beta, and stay tuned for updates.
          </Text>
        </div>

        <Button
          variant="outlined"
          color="secondary"
          className="mt-2 text-sm+ font-normal"
          onClick={handleClose}
        >
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div
      className={twMerge(
        'grid max-w-md grid-flow-row gap-2 py-4 px-5',
        className,
      )}
      {...props}
    >
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
            alt={user?.displayName}
            src={user?.avatarUrl}
          >
            {user?.displayName}
          </Avatar>
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
