import { isDevOrStaging } from '@/utils/helpers';

/**
 * This function sends content via a Discord Webhook to the console logging channel.
 * @param content {string} This string to log on the particular channel.
 */
const discordAnnounce = async (content: string) => {
  if (!process.env.NEXT_PUBLIC_DISCORD_LOGGING) {
    return;
  }

  const username = isDevOrStaging() ? 'console-next(dev)' : 'console-next';

  const params = {
    username,
    content,
  };

  await fetch(process.env.NEXT_PUBLIC_DISCORD_LOGGING, {
    method: 'POST',
    headers: {
      'Content-type': 'application/json',
    },
    body: JSON.stringify(params),
  });
};

export default discordAnnounce;
