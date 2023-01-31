import Button from '@/ui/v2/Button';
import Text from '@/ui/v2/Text';
import Image from 'next/image';

export function FeedbackReceived({ setFeedbackSent, close }: any) {
  function handleSubmit() {
    close();

    setTimeout(() => {
      setFeedbackSent(false);
    }, 500);
  }

  return (
    <div className="grid grid-flow-row items-center gap-4 text-center">
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
        onClick={handleSubmit}
      >
        Go Back
      </Button>
    </div>
  );
}

export default FeedbackReceived;
