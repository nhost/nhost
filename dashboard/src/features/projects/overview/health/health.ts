import { ServiceState } from '@/utils/__generated__/graphql';

const serviceHealthToColor = new Map<ServiceState, string>([
  [ServiceState.Running, 'success.dark'],
  [ServiceState.Error, 'error.main'],
  [ServiceState.UpdateError, 'error.main'],
  [ServiceState.Updating, 'warning.dark'],
  [ServiceState.None, 'error.main'],
  [undefined, 'error.main'],
]);

export default serviceHealthToColor;
