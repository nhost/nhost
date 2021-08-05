import { gqlSdk } from './gqlSDK';

export const getUserByPhoneNumber = async ({
  phoneNumber,
}: {
  phoneNumber: string;
}) => {
  const { users } = await gqlSdk.users({
    where: {
      phoneNumber: {
        _eq: phoneNumber,
      },
    },
  });

  return users[0];
};
