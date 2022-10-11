import { hasuraAuthMetadataPatch } from '@/metadata';
import { HasuraMetadataV3, patchMetadataObject } from '@/utils';
import { EMPTY_METADATA } from './empty-metadata';
import { NHOST_PROJECT_METADATA } from './nhost-project-metadata';

describe('metadata operations', () => {
  it('should patch metadata from an empty project', () => {
    const metadata: HasuraMetadataV3 = { ...EMPTY_METADATA };
    patchMetadataObject(metadata, hasuraAuthMetadataPatch);
    expect(metadata).toMatchSnapshot();
  });

  it('should not change the metadata when hasura-auth already applied its metadata', () => {
    const metadata: HasuraMetadataV3 = { ...NHOST_PROJECT_METADATA };
    patchMetadataObject(metadata, hasuraAuthMetadataPatch);
    expect(metadata).toMatchObject(NHOST_PROJECT_METADATA);
  });

  describe('fix broken metadata', () => {
    it('should track back an untracked table', () => {
      const metadata: HasuraMetadataV3 = { ...NHOST_PROJECT_METADATA };
      metadata.sources[0].tables = metadata.sources[0].tables.filter(
        ({ table: { name, schema } }) =>
          !(name === 'users' && schema === 'auth')
      );
      patchMetadataObject(metadata, hasuraAuthMetadataPatch);
      expect(metadata).toMatchObject(NHOST_PROJECT_METADATA);
    });

    it('should track back a missing relationship', () => {
      const metadata: HasuraMetadataV3 = { ...NHOST_PROJECT_METADATA };
      metadata.sources[0].tables
        .find(
          ({ table: { name, schema } }) => name === 'users' && schema === 'auth'
        )
        ?.array_relationships?.pop();
      patchMetadataObject(metadata, hasuraAuthMetadataPatch);
      expect(metadata).toMatchObject(NHOST_PROJECT_METADATA);
    });
  });
});
