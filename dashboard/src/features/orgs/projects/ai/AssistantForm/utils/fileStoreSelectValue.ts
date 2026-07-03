export const NO_FILE_STORE_SELECT_VALUE = 'none';

export function toFileStoreSelectValue(value?: string | null): string {
  return value || NO_FILE_STORE_SELECT_VALUE;
}

export function toFileStoreFormValue(value: string): string {
  return value === NO_FILE_STORE_SELECT_VALUE ? '' : value;
}

export const fileStoreFieldTransform = {
  in: toFileStoreSelectValue,
  out: toFileStoreFormValue,
};
