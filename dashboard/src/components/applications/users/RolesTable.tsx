import { CreateUserRoleModal } from '@/components/applications/users/roles/CreateRoleModal';
import { EditUserRoleModal } from '@/components/applications/users/roles/EditUserRoleModal';
import Lock from '@/components/icons/Lock';
import type { GetRolesQuery } from '@/generated/graphql';
import { Modal } from '@/ui';
import { Text } from '@/ui/Text';
import { ChevronRightIcon } from '@heroicons/react/solid';
import clsx from 'clsx';
import type { Dispatch, MouseEvent, MouseEventHandler } from 'react';
import { useReducer } from 'react';

function RolesTableHead() {
  return (
    <thead>
      <tr>
        <th className="w-64 py-3 text-left font-medium text-base">
          <Text className="text-xs font-bold text-greyscaleDark">Role</Text>
        </th>
      </tr>
    </thead>
  );
}

interface UserRoleProps {
  role: string;
  isSystemRole: boolean;
  onClick?: MouseEventHandler<HTMLTableRowElement>;
}

function UserRole({ role, isSystemRole, onClick }: UserRoleProps) {
  return (
    <tr
      className={clsx(isSystemRole ? 'cursor-not-allowed' : 'cursor-pointer')}
      onClick={onClick}
    >
      <td className="py-2">
        <Text
          size="normal"
          className={clsx(
            isSystemRole ? 'text-greyscaleGrey' : 'text-greyscaleDark',
            'pl-1 font-medium',
          )}
        >
          {role}
        </Text>
      </td>
      <td className="text-right">
        {isSystemRole ? (
          <div className="inline-flex pr-1">
            <Text
              size="tiny"
              className=" font-mono text-xs font-medium uppercase tracking-wide text-greyscaleGrey"
            >
              System Role
            </Text>
            <Lock className="ml-1 h-5 w-5 text-greyscaleGrey" />
          </div>
        ) : (
          <div className="inline-flex self-center py-2 pr-1.5">
            <ChevronRightIcon className="h-4.5 w-4.5 text-greyscaleDark" />
          </div>
        )}
      </td>
    </tr>
  );
}

export type UserRoleDetails = {
  name: string;
  isSystemRole: boolean;
};

export const getUserRoles = (data): UserRoleDetails[] => {
  const authUserDefaultAllowedRoles =
    data.app.authUserDefaultAllowedRoles.split(',');

  return authUserDefaultAllowedRoles.map((role: string) => ({
    name: role,
    isSystemRole: ['user', 'me'].includes(role),
  }));
};

type ModalState = {
  visible: boolean;
  type: 'create' | 'edit';
  payload: UserRoleDetails;
};

type ModalAction = {
  type: 'OPEN_CREATE_MODAL' | 'OPEN_EDIT_MODAL' | 'CLOSE_MODAL';
  payload?: UserRoleDetails;
};

function modalStateReducer(state: ModalState, action: ModalAction): ModalState {
  switch (action.type) {
    case 'OPEN_CREATE_MODAL':
      return { ...state, visible: true, type: 'create', payload: null };
    case 'OPEN_EDIT_MODAL':
      return { ...state, visible: true, type: 'edit', payload: action.payload };
    case 'CLOSE_MODAL':
      return { ...state, visible: false };
    default:
      throw new Error(`Action type ${action.type} is not supported.`);
  }
}

function AddNewUserRole({ dispatch }: { dispatch: Dispatch<ModalAction> }) {
  return (
    <tr className="cursor-pointer border-y-1 border-solid border-gray-300">
      <td className="p-2">
        <button
          type="button"
          onClick={() => dispatch({ type: 'OPEN_CREATE_MODAL' })}
        >
          <Text className="text-sm+ font-medium text-blue">
            Create New Role
          </Text>
        </button>
      </td>
      <td />
    </tr>
  );
}

function RolesTableBody({ data }: { data: GetRolesQuery }) {
  const userRoles = getUserRoles(data);
  const [
    { visible: modalVisible, type: modalType, payload: modalPayload },
    dispatch,
  ] = useReducer(modalStateReducer, {
    visible: false,
    type: null,
    payload: null,
  });

  function handleRoleEdit(event: MouseEvent<HTMLTableRowElement>, role: any) {
    dispatch({ type: 'OPEN_EDIT_MODAL', payload: role });
  }

  return (
    <>
      <Modal
        showModal={modalVisible}
        close={() => dispatch({ type: 'CLOSE_MODAL' })}
      >
        {modalType === 'create' ? (
          <CreateUserRoleModal
            onClose={() => dispatch({ type: 'CLOSE_MODAL' })}
          />
        ) : (
          <EditUserRoleModal
            onClose={() => dispatch({ type: 'CLOSE_MODAL' })}
            payload={modalPayload}
          />
        )}
      </Modal>
      <tbody className="divide-y-1 border-t-1 border-b-1 border-solid border-gray-300 ">
        {userRoles.map((role) => (
          <UserRole
            key={role.name}
            role={role.name}
            isSystemRole={role.isSystemRole}
            onClick={
              role.isSystemRole
                ? undefined
                : (event) => handleRoleEdit(event, role)
            }
          />
        ))}
        <AddNewUserRole dispatch={dispatch} />
      </tbody>
    </>
  );
}

export function RolesTable({ data }: { data: GetRolesQuery }) {
  return (
    <table className="w-full table-fixed overflow-x-auto">
      <RolesTableHead />
      <RolesTableBody data={data} />
    </table>
  );
}
