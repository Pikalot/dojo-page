import { scrollToSection } from '../lib/scrollToSection.js';

/**
 * In-page link that also moves focus to the target section's heading.
 * Keeps a real href so it still works without JavaScript handlers and can be
 * opened or copied like any link.
 */
export function SectionLink({ to, onNavigate, children, ...rest }) {
  const handleClick = (event) => {
    // Let modified clicks (new tab, etc.) behave normally.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    scrollToSection(to);
    onNavigate?.();
  };

  return (
    <a href={`#${to}`} onClick={handleClick} {...rest}>
      {children}
    </a>
  );
}
