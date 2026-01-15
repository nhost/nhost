import { describe, expect, it } from '@jest/globals';
import { createClient } from '@nhost/nhost-js';

describe('Nhost Client - Decode User Session', () => {
  const nhost = createClient({
    subdomain: 'local',
    region: 'local',
  });

  it('should decode user session with processed timestamps and claims', () => {
    const accessToken =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3NTA0MTUzNjEsImh0dHBzOi8vaGFzdXJhLmlvL2p3dC9jbGFpbXMiOnsieC1oYXN1cmEtYWxsb3dlZC1yb2xlcyI6WyJ1c2VyIl0sIngtaGFzdXJhLWRlZmF1bHQtcm9sZSI6InVzZXIiLCJ4LWhhc3VyYS1kZXBhcnRtZW50LW1hbmFnZXIiOiJ7fSIsIngtaGFzdXJhLWRlcGFydG1lbnRzIjoie1wiMjRlOWI4ZGItYWNmOC00MzlmLTlkNjMtN2Y4M2RlNTIzZmIzXCIsXCJkY2Q1MjUxOC01OGQwLTQ4MzQtOTY4My1iYTZkZWUzMzgzM2ZcIn0iLCJ4LWhhc3VyYS11c2VyLWlkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMDQ0IiwieC1oYXN1cmEtdXNlci1pcy1hbm9ueW1vdXMiOiJmYWxzZSJ9LCJpYXQiOjE3NTA0MTUyOTYsImlzcyI6Imhhc3VyYS1hdXRoIiwic3ViIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMDQ0In0.8T6SnN99O5E_5yk8exZtoVW5y2C7-DkkIC8cKfWA9-o';

    nhost.sessionStorage.set({
      accessToken,
      accessTokenExpiresIn: 3600,
      refreshToken: 'refresh-token-placeholder',
      refreshTokenId: 'refresh-token-id-placeholder',
    });

    const session = nhost.getUserSession();

    expect(session).toBeTruthy();
    expect(session?.decodedToken.exp).toBe(1750415361000);
    expect(session?.decodedToken.iat).toBe(1750415296000);
    expect(session?.decodedToken.iss).toBe('hasura-auth');
    expect(session?.decodedToken.sub).toBe(
      '550e8400-e29b-41d4-a716-446655440044',
    );

    const hasuraClaims = session?.decodedToken['https://hasura.io/jwt/claims'];
    expect(hasuraClaims).toBeTruthy();
    expect(hasuraClaims?.['x-hasura-allowed-roles']).toEqual(['user']);
    expect(hasuraClaims?.['x-hasura-default-role']).toBe('user');
    expect(hasuraClaims?.['x-hasura-user-id']).toBe(
      '550e8400-e29b-41d4-a716-446655440044',
    );
    expect(hasuraClaims?.['x-hasura-user-is-anonymous']).toBe('false');
    expect(hasuraClaims?.['x-hasura-department-manager']).toEqual([]);
    expect(hasuraClaims?.['x-hasura-departments']).toEqual([
      '24e9b8db-acf8-439f-9d63-7f83de523fb3',
      'dcd52518-58d0-4834-9683-ba6dee33833f',
    ]);
  });
});
