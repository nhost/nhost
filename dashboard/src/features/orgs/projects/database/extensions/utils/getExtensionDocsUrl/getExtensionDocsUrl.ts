import { EXTENSIONS_DOCS_URL } from '@/features/orgs/projects/database/extensions/constants';
import { getExtensionDisplayName } from '@/features/orgs/projects/database/extensions/utils/getExtensionDisplayName';

export default function getExtensionDocsUrl(name: string): string {
  return `${EXTENSIONS_DOCS_URL}#${encodeURIComponent(getExtensionDisplayName(name))}`;
}
