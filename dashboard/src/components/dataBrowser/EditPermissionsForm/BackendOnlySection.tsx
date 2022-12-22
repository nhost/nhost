import ControlledSwitch from '@/components/common/ControlledSwitch';
import Text from '@/ui/v2/Text';

export default function BackendOnlySection() {
  return (
    <section className="bg-white border-y-1 border-gray-200">
      <Text
        component="h2"
        className="px-6 py-3 font-bold border-b-1 border-gray-200"
      >
        Backend only
      </Text>

      <div className="grid grid-flow-row gap-4 items-center px-6 py-4">
        <Text variant="subtitle1">
          When enabled, this mutation is accessible only via &apos;trusted
          backends&apos;.
        </Text>

        <ControlledSwitch
          name="backendOnly"
          label={
            <Text variant="subtitle1" component="span">
              Allow from backends only
            </Text>
          }
        />
      </div>
    </section>
  );
}
