import { Avatar } from '@/components/ui/v2/Avatar';
import { Box } from '@/components/ui/v2/Box';
import { IconButton } from '@/components/ui/v2/IconButton';
import { CopyIcon } from '@/components/ui/v2/icons/CopyIcon';
import { GraphiteIcon } from '@/components/ui/v2/icons/GraphiteIcon';
import { Text } from '@/components/ui/v2/Text';
import { type Message } from '@/features/ai/DevAssistant';
import { copy } from '@/utils/copy';
import { useTheme } from '@mui/material';
import { useUserData } from '@nhost/nextjs';
import { onlyText } from 'react-children-utilities';
import Markdown, { type ExtraProps } from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkGFM from 'remark-gfm';
import { twMerge } from 'tailwind-merge';

import { type ClassAttributes, type HTMLAttributes } from 'react';

function PreComponent(
  props: ClassAttributes<HTMLElement> &
    HTMLAttributes<HTMLElement> &
    ExtraProps,
) {
  const { children } = props;

  return (
    <div className="relative group">
      <pre>{children}</pre>
      <IconButton
        sx={{
          minWidth: 0,
          padding: 0.5,
          backgroundColor: 'grey.100',
        }}
        color="warning"
        variant="contained"
        className="absolute hidden top-2 right-2 group-hover:flex"
        onClick={(e) => {
          e.stopPropagation();
          copy(onlyText(children), 'Snippet');
        }}
      >
        <CopyIcon className="w-5 h-5" />
      </IconButton>
    </div>
  );
}

export default function MessageBox({ message }: { message: Message }) {
  const theme = useTheme();
  const user = useUserData();
  const isUserMessage = message.role === 'user';

  return (
    <Box
      className="flex flex-col p-4 space-y-4 border-t first:border-t-0"
      sx={{
        backgroundColor: isUserMessage && 'background.default',
      }}
    >
      <div className="flex items-center space-x-2">
        {message.role === 'assistant' ? (
          <>
            <GraphiteIcon />
            <Text className="font-bold">Assistant</Text>
          </>
        ) : (
          <>
            <Avatar
              className="rounded-full h-7 w-7"
              alt={user?.displayName}
              src={user?.avatarUrl}
            >
              {user?.displayName || 'local'}
            </Avatar>
            <Text className="font-bold">
              {user?.displayName || 'local'} (You)
            </Text>
          </>
        )}
      </div>

      <Markdown
        className={twMerge(
          'prose',
          theme.palette.mode === 'dark' && 'prose-invert',
        )}
        rehypePlugins={[rehypeHighlight]}
        remarkPlugins={[remarkGFM]}
        components={{
          pre: PreComponent,
        }}
      >
        {message.message}
      </Markdown>
    </Box>
  );
}
