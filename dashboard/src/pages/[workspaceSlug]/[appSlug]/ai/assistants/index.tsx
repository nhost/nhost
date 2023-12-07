import AILayout from '@/components/layout/AILayout/AILayout';
import { Container } from '@/components/layout/Container';
import { type ReactElement } from 'react';

export default function AssistantsPage() {
  return (
    <Container>
      <span>Assistants</span>
    </Container>
  );
}

AssistantsPage.getLayout = function getLayout(page: ReactElement) {
  return <AILayout>{page}</AILayout>;
};
