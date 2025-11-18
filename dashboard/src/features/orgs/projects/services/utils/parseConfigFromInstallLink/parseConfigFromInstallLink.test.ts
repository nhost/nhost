import { describe, expect, it } from 'vitest';
import parseConfigFromInstallLink from './parseConfigFromInstallLink';

describe('parseConfigFromInstallLink', () => {
  it('pghero config without autoscaler should be formatted correctly', () => {
    const pgheroBase64Config =
      'eyJuYW1lIjoicGdoZXJvIiwiaW1hZ2UiOnsiaW1hZ2UiOiJkb2NrZXIuaW8vYW5rYW5lL3BnaGVybzpsYXRlc3QifSwiY29tbWFuZCI6W10sInJlc291cmNlcyI6eyJjb21wdXRlIjp7ImNwdSI6MTI1LCJtZW1vcnkiOjI1Nn0sInN0b3JhZ2UiOltdLCJyZXBsaWNhcyI6MX0sImVudmlyb25tZW50IjpbeyJuYW1lIjoiREFUQUJBU0VfVVJMIiwidmFsdWUiOiJwb3N0Z3JlczovL3Bvc3RncmVzOltQQVNTV09SRF1AcG9zdGdyZXMtc2VydmljZTo1NDMyL1tTVUJET01BSU5dP3NzbG1vZGU9ZGlzYWJsZSJ9LHsibmFtZSI6IlBHSEVST19VU0VSTkFNRSIsInZhbHVlIjoiW1VTRVJdIn0seyJuYW1lIjoiUEdIRVJPX1BBU1NXT1JEIiwidmFsdWUiOiJbUEFTU1dPUkRdIn1dLCJwb3J0cyI6W3sicG9ydCI6ODA4MCwidHlwZSI6Imh0dHAiLCJwdWJsaXNoIjp0cnVlfV19';

    const config = parseConfigFromInstallLink(pgheroBase64Config);

    const expected = {
      name: 'pghero',
      image: 'docker.io/ankane/pghero:latest',
      command: [],
      resources: {
        compute: {
          cpu: 125,
          memory: 256,
        },
        storage: [],
        replicas: 1,
      },
      environment: [
        {
          name: 'DATABASE_URL',
          value:
            'postgres://postgres:[PASSWORD]@postgres-service:5432/[SUBDOMAIN]?sslmode=disable',
        },
        {
          name: 'PGHERO_USERNAME',
          value: '[USER]',
        },
        {
          name: 'PGHERO_PASSWORD',
          value: '[PASSWORD]',
        },
      ],
      ports: [
        {
          port: 8080,
          type: 'http',
          publish: true,
        },
      ],
      autoscaler: null,
      compute: {
        cpu: 125,
        memory: 256,
      },
      replicas: 1,
      storage: [],
    };

    expect(config).toEqual(expected);
  });

  it('antivirus config without autoscaler should be formatted correctly', () => {
    const antivirusBase64Config =
      'eyJuYW1lIjoiY2xhbWF2IiwiaW1hZ2UiOnsiaW1hZ2UiOiJkb2NrZXIuaW8vbmhvc3QvY2xhbWF2OjAuMS4xIn0sImNvbW1hbmQiOltdLCJyZXNvdXJjZXMiOnsiY29tcHV0ZSI6eyJjcHUiOjEwMDAsIm1lbW9yeSI6MjA0OH0sInN0b3JhZ2UiOltdLCJyZXBsaWNhcyI6MX0sImVudmlyb25tZW50IjpbXSwicG9ydHMiOlt7InBvcnQiOiIzMzEwIiwidHlwZSI6InRjcCIsInB1Ymxpc2giOmZhbHNlfV19';

    const config = parseConfigFromInstallLink(antivirusBase64Config);

    const expected = {
      name: 'clamav',
      image: 'docker.io/nhost/clamav:0.1.1',
      command: [],
      resources: {
        compute: {
          cpu: 1000,
          memory: 2048,
        },
        storage: [],
        replicas: 1,
      },
      environment: [],
      ports: [
        {
          port: '3310',
          type: 'tcp',
          publish: false,
        },
      ],
      autoscaler: null,
      compute: {
        cpu: 1000,
        memory: 2048,
      },
      replicas: 1,
      storage: [],
    };
    expect(config).toEqual(expected);
  });

  it('invalid config should throw an error', () => {
    const invalidBase64Config = 'invalid';

    expect(() => parseConfigFromInstallLink(invalidBase64Config)).toThrow();
  });

  it('pghero config with autoscaler should be formatted correctly', () => {
    const pgheroWithAutoscalerBase64 =
      'eyJuYW1lIjoicGdoZXJvIiwiaW1hZ2UiOnsiaW1hZ2UiOiJkb2NrZXIuaW8vYW5rYW5lL3BnaGVybzpsYXRlc3QifSwiY29tbWFuZCI6W10sInJlc291cmNlcyI6eyJjb21wdXRlIjp7ImNwdSI6MTI1LCJtZW1vcnkiOjI1Nn0sInN0b3JhZ2UiOltdLCJyZXBsaWNhcyI6MSwiYXV0b3NjYWxlciI6eyJtYXhSZXBsaWNhcyI6MTF9fSwiZW52aXJvbm1lbnQiOlt7Im5hbWUiOiJEQVRBQkFTRV9VUkwiLCJ2YWx1ZSI6InBvc3RncmVzOi8vcG9zdGdyZXM6W1BBU1NXT1JEXUBwb3N0Z3Jlcy1zZXJ2aWNlOjU0MzIvW1NVQkRPTUFJTl0/c3NsbW9kZT1kaXNhYmxlIn0seyJuYW1lIjoiUEdIRVJPX1VTRVJOQU1FIiwidmFsdWUiOiJbVVNFUl0ifSx7Im5hbWUiOiJQR0hFUk9fUEFTU1dPUkQiLCJ2YWx1ZSI6IltQQVNTV09SRF0ifV0sInBvcnRzIjpbeyJwb3J0Ijo4MDgwLCJ0eXBlIjoiaHR0cCIsInB1Ymxpc2giOnRydWUsInJhdGVMaW1pdCI6bnVsbH1dLCJoZWFsdGhDaGVjayI6bnVsbH0=';

    const config = parseConfigFromInstallLink(pgheroWithAutoscalerBase64);

    const expected = {
      name: 'pghero',
      image: 'docker.io/ankane/pghero:latest',
      command: [],
      resources: {
        compute: {
          cpu: 125,
          memory: 256,
        },
        storage: [],
        replicas: 1,
        autoscaler: {
          maxReplicas: 11,
        },
      },
      environment: [
        {
          name: 'DATABASE_URL',
          value:
            'postgres://postgres:[PASSWORD]@postgres-service:5432/[SUBDOMAIN]?sslmode=disable',
        },
        {
          name: 'PGHERO_USERNAME',
          value: '[USER]',
        },
        {
          name: 'PGHERO_PASSWORD',
          value: '[PASSWORD]',
        },
      ],
      ports: [
        {
          port: 8080,
          type: 'http',
          publish: true,
        },
      ],
      autoscaler: {
        maxReplicas: 11,
      },
      compute: {
        cpu: 125,
        memory: 256,
      },
      replicas: 1,
      storage: [],
    };

    expect(config).toEqual(expected);
  });
});
