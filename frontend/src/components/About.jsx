import './About.css';
import { Divider } from './Divider.jsx';
import { Dojo } from './Dojo.jsx';
import { SubAbout } from './SubAbout.jsx';

export function About() {
  return (
    <div id="about" className="section about">
      <Dojo />
      <Divider />
      <SubAbout />
    </div>
  );
}
