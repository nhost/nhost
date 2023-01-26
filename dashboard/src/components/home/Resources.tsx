import { Resource } from '@/components/home/Resource';
import Text from '@/ui/v2/Text';

export default function Resources() {
  return (
    <div>
      <Text color="disabled">Resources</Text>
      <div className="mt-4 flex flex-col space-y-1">
        <Resource
          text="Documentation"
          logo="Question"
          link="https://docs.nhost.io"
        />
        <Resource
          text="Javascript Client"
          logo="js"
          link="https://docs.nhost.io/reference/javascript/"
        />
        <Resource
          text="Nhost CLI"
          logo="CLI"
          link="https://docs.nhost.io/platform/cli"
        />
      </div>
    </div>
  );
}
