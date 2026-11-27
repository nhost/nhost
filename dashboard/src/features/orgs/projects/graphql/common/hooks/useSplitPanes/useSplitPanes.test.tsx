import { fireEvent, render, screen } from '@/tests/testUtils';
import useSplitPanes from './useSplitPanes';

const storage = {
  get: vi.fn<(key: string) => string | null>(),
  set: vi.fn(),
};

vi.mock('@graphiql/react', () => ({
  useGraphiQL: (selector: (state: { storage: typeof storage }) => unknown) =>
    selector({ storage }),
}));

function SplitPanes() {
  const panes = useSplitPanes({ storageKey: 'split', minPaneWidth: 100 });

  return (
    <div>
      <div data-testid="first" ref={panes.firstRef} style={panes.firstStyle} />
      <div data-testid="divider" {...panes.dividerProps} />
      <div
        data-testid="second"
        ref={panes.secondRef}
        style={panes.secondStyle}
      />
    </div>
  );
}

function rect(left: number, right: number) {
  return () => ({ left, right }) as DOMRect;
}

// The panes span 0 to 1016 px with a 16 px divider at 500: 1000 px to share.
function renderPanes() {
  render(<SplitPanes />);
  const divider = screen.getByTestId('divider');

  screen.getByTestId('first').getBoundingClientRect = rect(0, 500);
  screen.getByTestId('second').getBoundingClientRect = rect(516, 1016);
  divider.getBoundingClientRect = rect(500, 516);
  Object.defineProperty(divider, 'offsetWidth', { value: 16 });
  divider.setPointerCapture = vi.fn();
  divider.releasePointerCapture = vi.fn();

  return divider;
}

function drag(divider: HTMLElement, clientX: number) {
  fireEvent.pointerDown(divider, { pointerId: 1, clientX: 500 });
  fireEvent.pointerMove(divider, { pointerId: 1, clientX });
  fireEvent.pointerUp(divider, { pointerId: 1, clientX });
}

function firstFlex() {
  return screen.getByTestId('first').style.flex;
}

describe('useSplitPanes', () => {
  beforeEach(() => {
    storage.get.mockReset().mockReturnValue(null);
    storage.set.mockReset();
  });

  it('starts from the saved split', () => {
    storage.get.mockReturnValue('0.3');
    renderPanes();

    expect(firstFlex()).toBe('0.3 1 0%');
    expect(screen.getByTestId('second').style.flex).toBe('0.7 1 0%');
  });

  it('splits evenly when nothing valid is saved', () => {
    storage.get.mockReturnValue('hide-second');
    renderPanes();

    expect(firstFlex()).toBe('0.5 1 0%');
  });

  it('resizes the panes and saves the split when the drag ends', () => {
    const divider = renderPanes();

    drag(divider, 300);

    expect(firstFlex()).toBe('0.3 1 0%');
    expect(storage.set).toHaveBeenCalledWith('split', '0.3');
  });

  it('keeps both panes at least their minimum width', () => {
    const divider = renderPanes();

    drag(divider, 20);
    expect(firstFlex()).toBe('0.1 1 0%');

    drag(divider, 1010);
    expect(firstFlex()).toBe('0.9 1 0%');
  });

  it('splits evenly again on a double click', () => {
    storage.get.mockReturnValue('0.3');
    const divider = renderPanes();

    fireEvent.doubleClick(divider);

    expect(firstFlex()).toBe('0.5 1 0%');
    expect(storage.set).toHaveBeenCalledWith('split', '0.5');
  });
});
