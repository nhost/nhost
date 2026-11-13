const HIGHLIGHT_MS = 1500;
const timeouts = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * Scrolls to a section of the Authentication page and lights its card up for
 * a moment. The cards sit close together, so the page may barely move: the
 * highlight shows where a header link took you, even on a repeat click.
 */
export default function highlightSection(id: string) {
  const section = document.getElementById(id);
  if (!section) {
    return;
  }

  section.scrollIntoView({ block: 'start' });
  section.setAttribute('data-highlighted', 'true');

  clearTimeout(timeouts.get(id));
  timeouts.set(
    id,
    setTimeout(() => {
      section.removeAttribute('data-highlighted');
      timeouts.delete(id);
    }, HIGHLIGHT_MS),
  );
}
