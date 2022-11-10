import { Button } from '@/ui/Button';
import { Text } from '@/ui/Text';
import { Transition } from '@headlessui/react';
import { Fragment } from 'react';

type FormSaverProps = {
  show: boolean;
  onCancel: () => void;
  onSave: () => void;
  loading: boolean;
};

export function FormSaver({ show, onCancel, onSave, loading }: FormSaverProps) {
  return (
    <Transition
      show={show}
      as={Fragment}
      enter="transition ease-out duration-100"
      enterFrom="transform opacity-0 scale-95"
      enterTo="transform opacity-100 scale-100"
      leave="transition ease-in duration-75"
      leaveFrom="transform opacity-100 scale-100"
      leaveTo="transform opacity-0 scale-95"
    >
      <div className="fixed bottom-6 right-6 z-10 flex w-98 place-content-between self-center rounded bg-greyscaleDark px-2 py-2 text-white">
        <Text size="normal" className="ml-4 self-center font-medium">
          You have unsaved settings
        </Text>
        <div className="flex flex-row">
          <Button
            transparent
            border
            className="px-2 text-white"
            onClick={onCancel}
          >
            Discard
          </Button>
          <Button
            className="mx-2"
            variant="primary"
            onClick={onSave}
            loading={loading}
          >
            {!loading ? 'Save' : ''}
          </Button>
        </div>
      </div>
    </Transition>
  );
}

export default FormSaver;
