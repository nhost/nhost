import type { NextApiRequest, NextApiResponse } from 'next';

interface DockerHubImage {
  architecture: string;
  digest: string;
  features: string;
  os: string;
  os_features: string;
  size: number;
  variant: string;
  last_pulled: string;
  last_pushed: string;
  status: string;
}

interface DockerHubResult {
  content_type: string;
  creator: number;
  digest: string;
  full_size: number;
  id: number;
  images: DockerHubImage[];
  last_updated: string;
  last_updater: number;
  last_updater_username: string;
  media_type: string;
  name: string;
  repository: number;
  tag_last_pulled: string;
  tag_last_pushed: string;
  tag_status: string;
  v2: boolean;
}

interface DockerHubResponse {
  count: number;
  next: string;
  previous: string;
  results: DockerHubResult[];
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'GET' && req.method !== 'OPTIONS') {
    return res.status(405).json({ error: { message: 'Method not allowed' } });
  }

  if (!req.query?.image) {
    return res
      .status(400)
      .json({ error: { message: 'Missing "image" query parameter' } });
  }

  const response = await fetch(
    `https://hub.docker.com/v2/repositories/${req.query.image}/tags?page_size=1000`,
  );
  const payload = await response.json();

  if (!response.ok) {
    return res
      .status(500)
      .json({ error: { message: 'Internal server error', payload } });
  }

  const dockerHubResponse = payload as DockerHubResponse;

  const results = dockerHubResponse.results
    .filter((result) => /^(v)?(\d+\.)?\d+\.\d+(-ce)?$/i.test(result.name))
    .map((result) => result.name);

  return res.status(200).json(results);
}
