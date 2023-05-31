import {
  CONSTRAINT_ERROR,
  INSUFFICIENT_PERMISSIONS,
  INSUFFICIENT_PERMISSIONS_MESSAGE,
  REMOVE_APPLICATIONS_ERROR_MESSAGE,
  UNIQUENESS_ERROR,
  WORKSPACE_CONTAINS_APPLICATIONS,
  WORKSPACE_OWNERS_ERROR_MESSAGE,
} from '@/utils/constants/common';
import type { ApolloError } from '@apollo/client';

function constructErrorMessage(type: string | undefined) {
  switch (type) {
    case 'application' || 'project':
      return 'A project with that name already exists.';
    case 'invite':
      return 'An invitation to that user already exists.';
    default:
      return `A ${type} with that name already exists.`;
  }
}

export default function getErrorMessage(
  error: ApolloError | Error,
  type?: string,
) {
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
