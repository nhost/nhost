type FunctionRequest = {
  headers: Record<string, string | string[] | undefined>;
  body: { question?: string };
};

type FunctionResponse = {
  status: (code: number) => FunctionResponse;
  send: (body: string) => FunctionResponse;
};

declare const process: { env: Record<string, string | undefined> };

export default (
  req: FunctionRequest,
  res: FunctionResponse,
): FunctionResponse => {
  const webhookSecret = process.env.AI_WEBHOOK_SECRET;
  if (req.headers['x-ai-webhook-secret'] !== webhookSecret) {
    return res.status(401).send('Unauthorized');
  }

  if (req.body.question?.match(/(world|life|universe)/i)) {
    return res.status(200).send('42');
  }

  return res.status(200).send("I don't know");
};
