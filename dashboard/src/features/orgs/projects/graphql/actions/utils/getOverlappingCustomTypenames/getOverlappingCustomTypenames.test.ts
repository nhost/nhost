import type { CustomTypes } from '@/utils/hasura-api/generated/schemas';
import getOverlappingCustomTypenames from './getOverlappingCustomTypenames';

describe('getOverlappingCustomTypenames', () => {
  const existingCustomTypes: CustomTypes = {
    objects: [
      { name: 'SampleOutput', fields: [{ name: 'id', type: 'ID!' }] },
      { name: 'OtherOutput', fields: [{ name: 'id', type: 'ID!' }] },
    ],
  };

  it('reports types that already exist and are not used by the action', () => {
    const overlapping = getOverlappingCustomTypenames(
      `type SampleOutput {
        accessToken: String!
      }

      type OtherOutput {
        id: ID!
      }`,
      existingCustomTypes,
      ['SampleOutput'],
    );

    expect(overlapping).toEqual(['OtherOutput']);
  });

  it('returns an empty list when the SDL is invalid', () => {
    expect(
      getOverlappingCustomTypenames('type {', existingCustomTypes, []),
    ).toEqual([]);
  });
});
