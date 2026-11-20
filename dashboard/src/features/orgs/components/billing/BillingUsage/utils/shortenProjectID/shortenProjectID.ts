const SHORT_ID_HEAD_LENGTH = 8;
const SHORT_ID_TAIL_LENGTH = 4;

export default function shortenProjectID(projectID: string): string {
  return `${projectID.slice(0, SHORT_ID_HEAD_LENGTH)}…${projectID.slice(-SHORT_ID_TAIL_LENGTH)}`;
}
