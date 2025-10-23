export interface DeleteEventTriggerOptions {
  appUrl: string;
  adminSecret: string;
}

export interface DeleteEventTriggerVariables {
  args: DeleteEventTriggerArgs;
}

interface DeleteEventTriggerArgs {
  name: string;
}

export async function deleteEventTrigger({
  appUrl,
  adminSecret,
  args,
}: DeleteEventTriggerOptions & DeleteEventTriggerVariables) {
  const mypromise = new Promise((resolve) => {
    setTimeout(() => {
      resolve([{ message: 'success' }]);
    }, 2000);
  });

  const result = await mypromise;
  result;
}
