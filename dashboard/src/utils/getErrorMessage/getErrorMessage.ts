import {
  INSUFFICIENT_PERMISSIONS,
  INSUFFICIENT_PERMISSIONS_MESSAGE,
  UNIQUENESS_ERROR,
} from '@/utils/constants/common';
import type { ApolloError } from '@apollo/client';

function constructErrorMessage(type: string | undefined) {
  switch (type) {
    case 'application':
    case 'project':
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

  if (error.message.includes(INSUFFICIENT_PERMISSIONS)) {
    return INSUFFICIENT_PERMISSIONS_MESSAGE;
  }

  return error.message;
}
