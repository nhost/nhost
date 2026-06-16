import { describe, expect, it } from 'vitest';
import buildActionSdlPrompt from './buildActionSdlPrompt';

const actionDefinitionSdl = `type Mutation {
  login(email: String!, password: String!): LoginResponse
}`;

const typesSdl = `type LoginResponse {
  accessToken: String!
}`;

describe('buildActionSdlPrompt', () => {
  it('builds a prompt targeting the Action Definition field', () => {
    const prompt = buildActionSdlPrompt({
      target: 'definition',
      actionDefinitionSdl,
      typesSdl,
    });

    expect(prompt).toContain('Help me write the Action Definition');
    expect(prompt).toContain('Write the **Action Definition**');
    expect(prompt).toContain(actionDefinitionSdl);
    expect(prompt).toContain(typesSdl);
    expect(prompt).toContain('## What I want');
    expect(prompt).toContain('```graphql');
  });

  it('builds a prompt targeting the Type Configuration field', () => {
    const prompt = buildActionSdlPrompt({
      target: 'types',
      actionDefinitionSdl,
      typesSdl,
    });

    expect(prompt).toContain('Help me write the Type Configuration');
    expect(prompt).toContain('Write the **Type Configuration**');
  });

  it('marks empty editors as (empty)', () => {
    const prompt = buildActionSdlPrompt({
      target: 'definition',
      actionDefinitionSdl: '',
      typesSdl: '   ',
    });

    expect(prompt).toContain(
      '## Current Action Definition\n```graphql\n(empty)\n```',
    );
    expect(prompt).toContain(
      '## Current Type Configuration\n```graphql\n(empty)\n```',
    );
  });

  it('does not name the underlying engine', () => {
    const prompt = buildActionSdlPrompt({
      target: 'types',
      actionDefinitionSdl,
      typesSdl,
    });

    expect(prompt).not.toMatch(/Hasura/);
  });
});
