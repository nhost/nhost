import { darken, styled } from '@mui/material';

const OptionBase = styled('li')(({ theme }) => ({
  listStyle: 'none',
  padding: theme.spacing(1, 1.5),
  backgroundColor: 'transparent',
  width: '100%',
  minHeight: 36,
  display: 'grid',
  alignItems: 'center',
  justifyContent: 'start',
  cursor: 'default',
  fontSize: '0.9375rem',
  lineHeight: '1.375rem',
  transition: theme.transitions.create(['background-color'], { duration: 100 }),
  '&[aria-selected="true"]': {
    backgroundColor:
      theme.palette.mode === 'dark'
        ? `${darken(theme.palette.action.hover, 0.1)} !important`
        : `${darken(theme.palette.action.hover, 0.05)} !important`,
  },
  '&.Mui-focused[aria-selected="true"], &[aria-selected="true"]:hover': {
    backgroundColor:
      theme.palette.mode === 'dark'
        ? `${darken(theme.palette.action.hover, 0.25)} !important`
        : `${darken(theme.palette.action.hover, 0.075)} !important`,
  },
  '&.Mui-focused, &:hover': {
    backgroundColor:
      theme.palette.mode === 'dark'
        ? `${darken(theme.palette.action.hover, 0.15)} !important`
        : `${theme.palette.action.hover} !important`,
  },
  '&.Mui-focusVisible:hover': {
    backgroundColor:
      theme.palette.mode === 'dark'
        ? `${darken(theme.palette.action.hover, 0.15)} !important`
        : `${theme.palette.action.hover} !important`,
  },
  '&:disabled': {
    color: theme.palette.text.disabled,
  },
}));

OptionBase.displayName = 'NhostOptionBase';

export default OptionBase;
