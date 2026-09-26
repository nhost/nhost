import { afterEach, beforeAll, describe, expect, it } from '@jest/globals';
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { NhostDevToolbar } from '../react';

const roots: Root[] = [];

function render(node: ReactNode) {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  act(() => {
    root.render(node);
  });
  return container;
}

beforeAll(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
});

afterEach(() => {
  while (roots.length > 0) {
    const root = roots.pop();
    act(() => {
      root?.unmount();
    });
  }
  document.body.replaceChildren();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe('NhostDevToolbar', () => {
  it('mounts the toolbar', () => {
    render(<NhostDevToolbar />);
    expect(document.querySelector('.ndt-root')).not.toBeNull();
  });

  // It renders nothing of its own: the toolbar goes into document.body from an
  // effect, so a server render has no markup to mismatch on.
  it('renders no markup where it is placed', () => {
    const container = render(<NhostDevToolbar />);
    expect(container.innerHTML).toBe('');
  });

  it('passes the backend through to the toolbar', () => {
    render(<NhostDevToolbar subdomain="myapp" />);
    expect(document.querySelector('.ndt-root a')?.getAttribute('href')).toBe(
      'https://myapp.dashboard.local.nhost.run',
    );
  });

  it('shows nothing against a deployed backend', () => {
    render(<NhostDevToolbar subdomain="abcdef" region="eu-central-1" />);
    expect(document.querySelector('.ndt-root')).toBeNull();
  });

  it('takes the toolbar away when it unmounts', () => {
    render(<NhostDevToolbar />);
    expect(document.querySelector('.ndt-root')).not.toBeNull();

    const root = roots.pop();
    act(() => {
      root?.unmount();
    });
    expect(document.querySelector('.ndt-root')).toBeNull();
  });

  // Changing the backend has to tear the old toolbar down rather than leave a
  // second one behind pointing at the previous project.
  it('replaces the toolbar when the backend changes', () => {
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    roots.push(root);

    act(() => {
      root.render(<NhostDevToolbar subdomain="first" />);
    });
    act(() => {
      root.render(<NhostDevToolbar subdomain="second" />);
    });

    const links = document.querySelectorAll('.ndt-handle');
    expect(links).toHaveLength(1);
    expect(links[0]?.getAttribute('href')).toBe(
      'https://second.dashboard.local.nhost.run',
    );
  });
});
