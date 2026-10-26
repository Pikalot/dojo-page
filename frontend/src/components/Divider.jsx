import logo from '../assets/aikikai-logo.png';
import './Divider.css';

/**
 * Decorative separator: two hairlines that fade out toward the edges, with a
 * small muted mark in the middle (the dojo logo by default). Hidden from
 * screen readers, since it carries no meaning.
 */
export function Divider({ src = logo }) {
  return (
    <div className="divider" aria-hidden="true">
      <img className="divider__mark" src={src} alt="" width="32" height="32" />
    </div>
  );
}
