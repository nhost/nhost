export const getProjectHint = (
  orgName: string | undefined,
  projectName: string | undefined,
  appSubdomain: string | undefined,
) => {
  if (!appSubdomain) {
    return orgName;
  }

  return [
    orgName,
    projectName ? `${projectName} (${appSubdomain})` : appSubdomain,
  ]
    .filter(Boolean)
    .join(' / ');
};
