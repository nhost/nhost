import { Text } from '@/ui/Text';

interface ErrorComponentProps {
  message: string;
}

function ErrorComponent({ message }: ErrorComponentProps) {
  return (
    <div className="my-4 rounded-md bg-warning px-4 py-2 text-dark">
      <Text className="font-medium text-textOrange">Error</Text>
      <Text className="pt-2 font-medium text-dimBlack" size="normal">
        {message}
      </Text>
    </div>
  );
}
export default ErrorComponent;
