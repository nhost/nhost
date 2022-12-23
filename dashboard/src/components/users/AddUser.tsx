import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import { Alert } from '@/ui/Alert';
import { Modal } from '@/ui/Modal';
import Button from '@/ui/v2/Button';
import Input from '@/ui/v2/Input';
import Text from '@/ui/v2/Text';
import generateAppServiceUrl from '@/utils/common/generateAppServiceUrl';
import { triggerToast } from '@/utils/toast';
import { useApolloClient } from '@apollo/client';
import axios from 'axios';
import { useState } from 'react';
import validator from 'validator';

export function AddUserModal({ modalIsOpen, setModalIsOpen }: any) {
  const { currentApplication } = useCurrentWorkspaceAndApplication();

  const client = useApolloClient();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [formState, setFormState] = useState<{
    loading: boolean;
    error: Error | null;
  }>({
    loading: false,
    error: null,
  });

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();

    setFormState({
      loading: true,
      error: null,
    });

    if (!validator.isEmail(email)) {
      setFormState({
        loading: false,
        error: new Error('Not an email'),
      });
      return;
    }

    const signUpUrl = `${generateAppServiceUrl(
      currentApplication?.subdomain,
      currentApplication?.region.awsName,
      'auth',
    )}/signup/email-password`;

    try {
      await axios.post(signUpUrl, {
        email,
        password,
      });
    } catch (error) {
      setFormState({
        loading: false,
        error,
      });
      return;
    }

    setModalIsOpen(false);

    setEmail('');
    setPassword('');
    setFormState({
      loading: false,
      error: null,
    });
    triggerToast(`User ${email} added successfully`);
    client.refetchQueries({ include: ['remoteAppGetUsers'] });
  };
  return (
    <Modal showModal={modalIsOpen} close={() => setModalIsOpen(false)}>
      <div className="w-modal2 px-4 py-4 text-left">
        <div className="grid grid-flow-row gap-2">
          <Text variant="h3" component="h2" className="text-center">
            Add New User
          </Text>

          <Text className="text-center">
            Insert an email and password to create a new user. It will have the
            same properties as if registered through the remote app.
          </Text>

          <form
            onSubmit={handleSubmit}
            autoComplete="off"
            autoCorrect="off"
            className="grid grid-flow-row gap-2"
          >
            <Input
              id="email"
              type="email"
              label="User Email"
              placeholder="User Email"
              fullWidth
              hideEmptyHelperText
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />

            <Input
              id="password"
              label="User Password"
              placeholder="User Password"
              fullWidth
              hideEmptyHelperText
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              inputProps={{
                min: 8,
                max: 32,
              }}
              required
            />

            {formState.error && (
              <Alert severity="error">{formState.error.message}</Alert>
            )}

            <Button type="submit" loading={formState.loading}>
              Add User
            </Button>

            <Button
              variant="outlined"
              color="secondary"
              loading={formState.loading}
              onClick={() => setModalIsOpen(false)}
            >
              Cancel
            </Button>
          </form>
        </div>
      </div>
    </Modal>
  );
}

export function AddUser() {
  const [modalIsOpen, setModalIsOpen] = useState(false);

  return (
    <>
      <AddUserModal modalIsOpen={modalIsOpen} setModalIsOpen={setModalIsOpen} />

      <Button
        variant="outlined"
        color="secondary"
        className="ml-2 w-full"
        onClick={() => setModalIsOpen(true)}
      >
        Add User
      </Button>
    </>
  );
}
