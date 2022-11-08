import DialogActions from './DialogActions';
import DialogContent from './DialogContent';
import DialogContentText from './DialogContentText';
import DialogRoot from './DialogRoot';
import DialogTitle from './DialogTitle';

export { default as BaseDialog } from './Dialog';
export * from './DialogActions';
export { default as DialogActions } from './DialogActions';
export * from './DialogContent';
export { default as DialogContent } from './DialogContent';
export * from './DialogRoot';
export { default as DialogRoot } from './DialogRoot';
export * from './DialogTitle';
export { default as DialogTitle } from './DialogTitle';

export const Dialog = {
  Root: DialogRoot,
  Title: DialogTitle,
  Content: DialogContent,
  Actions: DialogActions,
  ContentText: DialogContentText,
};
