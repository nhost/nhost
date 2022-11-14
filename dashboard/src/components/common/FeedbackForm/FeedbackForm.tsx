import { FeedbackReceived } from '@/components/home/FeedbackReceived';
import { SendFeedback } from '@/components/home/SendFeedback';
import type { DetailedHTMLProps, HTMLProps } from 'react';
import { useState } from 'react';
import { twMerge } from 'tailwind-merge';

export interface FeedbackFormProps
  extends DetailedHTMLProps<HTMLProps<HTMLDivElement>, HTMLDivElement> {}

// TODO: Use `react-hook-form` here instead of the custom solution
export default function FeedbackForm({
  className,
  ...props
}: FeedbackFormProps) {
  const [feedback, setFeedback] = useState('');
  const [feedbackSent, setFeedbackSent] = useState(false);

  return (
    <div className={twMerge('max-w-md py-4 px-5', className)} {...props}>
      {!feedbackSent ? (
        <SendFeedback
          setFeedbackSent={setFeedbackSent}
          feedback={feedback}
          setFeedback={setFeedback}
        />
      ) : (
        <FeedbackReceived setFeedbackSent={setFeedbackSent} close={() => {}} />
      )}
    </div>
  );
}
