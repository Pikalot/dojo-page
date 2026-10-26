import './About.css';
import { Divider } from './Divider.jsx';
import { Dojo } from './Dojo.jsx';
import { SubAbout } from './SubAbout.jsx';

export function About() {
  return (
    <section id="about" className="section about" aria-labelledby="about-title">
      <Dojo />
      <Divider />
      <SubAbout />
    </section>
  );
}
