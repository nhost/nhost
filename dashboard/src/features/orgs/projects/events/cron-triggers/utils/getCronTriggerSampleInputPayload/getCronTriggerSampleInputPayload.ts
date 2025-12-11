import { isNotEmptyValue } from '@/lib/utils';
import { v4 as uuidv4 } from 'uuid';

export default function getCronTriggerSampleInputPayload(payload?: string) {
  const obj = {
    name: 'testName',
    comment: 'testComment',
    id: uuidv4(),
    scheduled_time: '2024-12-23T22:00:00.000Z',
    payload: isNotEmptyValue(payload) ? JSON.parse(payload) : {},
  };
  return JSON.stringify(obj, null, 2);
}
