import type { ApolloError } from '@apollo/client';
import type { SetStateAction } from 'react';
import {
  CONSTRAINT_ERROR,
  INSUFFICIENT_PERMISSIONS,
  INSUFFICIENT_PERMISSIONS_MESSAGE,
  REMOVE_APPLICATIONS_ERROR_MESSAGE,
  UNIQUENESS_ERROR,
  WORKSPACE_CONTAINS_APPLICATIONS,
  WORKSPACE_OWNERS_ERROR_MESSAGE,
} from './CONSTANTS';

export function constructErrorMessage(type: string | undefined) {
  switch (type) {
    case 'application' || 'project':
      return 'A project with that name already exists.';
    case 'invite':
      return 'An invitation to that user already exists.';
    default:
      return `A ${type} with that name already exists.`;
  }
}

export function getErrorMessage(error: ApolloError | Error, type?: string) {
  if (error.message.includes(UNIQUENESS_ERROR)) {
    return constructErrorMessage(type);
  }

  if (error.message.includes(WORKSPACE_CONTAINS_APPLICATIONS)) {
    return REMOVE_APPLICATIONS_ERROR_MESSAGE;
  }

  if (error.message.includes(CONSTRAINT_ERROR)) {
    return WORKSPACE_OWNERS_ERROR_MESSAGE;
  }

  if (error.message.includes(INSUFFICIENT_PERMISSIONS)) {
    return INSUFFICIENT_PERMISSIONS_MESSAGE;
  }

  return error.message;
}

export function inputErrorMessages(
  e: string,
  setName: {
    (value: SetStateAction<string>): void;
    (value: SetStateAction<string>): void;
    (arg0: any): void;
  },
  setNameError: {
    (value: SetStateAction<string>): void;
    (value: SetStateAction<string>): void;
    (arg0: string): void;
  },
  type?,
): boolean {
  if (e.length > 32) {
    setNameError(`${type} name too long.`);
    return false;
  }
  if (e.length < 4) {
    setNameError(`The ${type} name is too short.`);
    setName(e);
    return false;
  }
  if (e.length === 0) {
    setNameError(`The ${type} name cannot be empty.`);
    setName(e);
    return false;
  }
  setNameError('');
  setName(e);
  return true;
}
