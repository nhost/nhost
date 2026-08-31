DO $$
DECLARE
  referenced_agents bigint;
BEGIN
  SELECT count(*) INTO referenced_agents
  FROM ai.agents
  WHERE provider = 'openai_compatible';

  IF referenced_agents > 0 THEN
    RAISE EXCEPTION
      'cannot remove openai_compatible agent provider: % agent(s) still reference it',
      referenced_agents;
  END IF;
END
$$;

DELETE FROM ai.agent_providers
WHERE value = 'openai_compatible';
