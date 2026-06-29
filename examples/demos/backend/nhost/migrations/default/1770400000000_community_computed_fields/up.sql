CREATE OR REPLACE FUNCTION public.community_is_member(
  community_row public.communities,
  user_session json
)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.community_members
    WHERE community_members.community_id = community_row.id
      AND community_members.user_id = (user_session ->> 'x-hasura-user-id')::uuid
  );
$$;

CREATE OR REPLACE FUNCTION public.community_my_joined_at(
  community_row public.communities,
  user_session json
)
RETURNS timestamptz
LANGUAGE sql
STABLE
AS $$
  SELECT joined_at
  FROM public.community_members
  WHERE community_members.community_id = community_row.id
    AND community_members.user_id = (user_session ->> 'x-hasura-user-id')::uuid
  LIMIT 1;
$$;
