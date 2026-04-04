export interface PipelineRunInput {
  name: string;
  app_id: string;
  commit_sha: string;
  commit_user_name?: string;
  commit_user_avatar_url?: string;
  commit_message?: string;
}
