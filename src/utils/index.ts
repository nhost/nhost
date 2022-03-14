const generateRedirectUrl = (
  redirectTo: string,
  queryParameters: { [key: string]: string },
  hashTag?: string
): string => {
  let finalRedirectTo = redirectTo;

  // add query paramters
  // add first ? or & depending on of there are already query parameters
  if (redirectTo.includes('&')) {
    finalRedirectTo += '&';
  } else {
    finalRedirectTo += '?';
  }

  const nrOfKeys = Object.keys(queryParameters).length;

  // add query paramters
  for (const [i, key] of Object.keys(queryParameters).entries()) {
    // add & if not the last key
    if (i !== nrOfKeys - 1) {
      finalRedirectTo += key + '=' + queryParameters[key] + '&';
    } else {
      finalRedirectTo += key + '=' + queryParameters[key];
    }
  }

  // add hash tag
  if (hashTag) {
    finalRedirectTo += '#' + hashTag;
  }

  return finalRedirectTo;
};
export { generateRedirectUrl };
