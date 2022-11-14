import { Alert } from '@/ui/Alert';
import Button from '@/ui/v2/Button';
import Input from '@/ui/v2/Input';
import Text from '@/ui/v2/Text';
import { useState } from 'react';

type EnvModalProps = {
  onSubmit: (props: {
    name: string;
    prodValue: string;
    devValue: string;
  }) => Promise<void>;
  name?: string;
  prodValue?: string;
  devValue?: string;
  close: VoidFunction;
};

interface AddEnvVarModalVariablesError {
  hasError: boolean;
  message: string;
}

const DISABLED_START_ENV_VARIABLES = [
  'NHOST_',
  'HASURA_',
  'AUTH_',
  'STORAGE_',
  'POSTGRES_',
];

const DISABLED_ENV_VARIABLES = [
  'PATH',
  'NODE_PATH',
  'PYTHONPATH',
  'GEM_PATH',
  'HOSTNAME',
  'TERM',
  'NODE_VERSION',
  'YARN_VERSION',
  'NODE_ENV',
  'HOME',
];

export default function AddEnvVarModal({
  name: externalName,
  prodValue: externalProdValue,
  devValue: externalDevValue,
  close,
  onSubmit,
}: EnvModalProps) {
  const [name, setName] = useState(externalName || '');
  const [prodValue, setProdValue] = useState(externalProdValue || '');
  const [devValue, setDevValue] = useState(externalDevValue || '');
  const [error, setError] = useState<AddEnvVarModalVariablesError>({
    hasError: false,
    message: '',
  });

  const noError: AddEnvVarModalVariablesError = {
    hasError: false,
    message: '',
  };

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    setError({ hasError: false, message: '' });
    e.preventDefault();

    if (
      DISABLED_START_ENV_VARIABLES.some((envVar) =>
        name.toUpperCase().startsWith(envVar),
      )
    ) {
      setError({
        hasError: true,
        message:
          'The environment variable name cannot start with a value that is reserved for an internal environment variable.',
      });
      return;
    }

    if (
      DISABLED_ENV_VARIABLES.some((envVar) => envVar === name.toUpperCase())
    ) {
      setError({
        hasError: true,
        message:
          'The environment variable name cannot be a value that is reserved for internal use.',
      });
      return;
    }

    // only allow alphabet characters and underscores
    const onlyLettersWithNumbersStartsWithLetter = /^[a-zA-Z_]+[a-zA-Z0-9_]*$/;
    if (!onlyLettersWithNumbersStartsWithLetter.test(name)) {
      setError({
        hasError: true,
        message:
          'The name contains invalid characters. Only letters, digits, and underscores are allowed. Furthermore, the name should start with a letter.',
      });
      return;
    }

    if (!name) {
      setError({ hasError: true, message: 'Variable name is required.' });
      return;
    }

    if (!prodValue) {
      setError({ hasError: true, message: 'Production value is required.' });
      return;
    }

    if (!devValue) {
      setError({ hasError: true, message: 'Development value is required.' });
      return;
    }

    await onSubmit({
      name,
      prodValue,
      devValue,
    });
    close();
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="w-modal px-6 py-6 text-left">
        <div className="grid grid-flow-row gap-1">
          <Text variant="h3" component="h2">
            {name || 'EXAMPLE_NAME'}
          </Text>

          <Text variant="subtitle2">
            The default value will be available in all environments, unless you
            override it. All values are encrypted.
          </Text>

          <div className="my-2 grid grid-flow-row gap-2">
            <Input
              id="name"
              label="Name"
              autoFocus
              autoComplete="off"
              fullWidth
              placeholder="EXAMPLE_NAME"
              value={name}
              onChange={(event) => {
                setError(noError);
                setName(event.target.value);
              }}
              hideEmptyHelperText
            />

            <Input
              id="prodValue"
              label="Production Value"
              fullWidth
              placeholder="Enter a value"
              value={prodValue}
              onChange={(event) => {
                setError(noError);
                setProdValue(event.target.value);
              }}
              hideEmptyHelperText
            />

            <Input
              id="devValue"
              label="Development Value"
              fullWidth
              placeholder="Enter a value"
              value={devValue}
              onChange={(event) => {
                setError(noError);
                setDevValue(event.target.value);
              }}
              hideEmptyHelperText
            />
          </div>

          {error.hasError && (
            <Alert severity="warning" className="mb-2">
              <Text className="font-medium">Warning</Text>
              <Text>{error.message}</Text>
            </Alert>
          )}

          <div className="grid grid-flow-row gap-2">
            <Button type="submit">Add</Button>

            <Button onClick={close} variant="outlined" color="secondary">
              Close
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
