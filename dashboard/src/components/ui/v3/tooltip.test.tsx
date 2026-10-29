import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip';

function renderOpenTooltip(interactive?: boolean) {
  render(
    <Tooltip open interactive={interactive}>
      <TooltipTrigger>Trigger</TooltipTrigger>
      <TooltipContent>Label</TooltipContent>
    </Tooltip>,
  );

  return screen.getByText('Label', { selector: '[data-slot=tooltip-content]' });
}

describe('Tooltip', () => {
  it('lets clicks through its content by default, so it never blocks a button', () => {
    expect(renderOpenTooltip()).toHaveClass('pointer-events-none');
  });

  it('can be clicked when interactive, for tooltips with a link inside', () => {
    const content = renderOpenTooltip(true);

    expect(content).toHaveClass('pointer-events-auto');
    expect(content).not.toHaveClass('pointer-events-none');
  });
});
