const DEFAULT_LABEL = 'Remote schema';

export default function formatRemoteSchemaEndpoint(
  remoteSchema?: string,
  remoteFieldPath: string[] = [],
) {
  const schemaLabel = remoteSchema ?? DEFAULT_LABEL;

  if (remoteFieldPath.length === 0) {
    return `${schemaLabel} / Not specified`;
  }

  return `${schemaLabel} / ${remoteFieldPath.join('/')}`;
}
