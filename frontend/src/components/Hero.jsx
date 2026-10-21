import { useLanguage } from '../i18n/LanguageContext.jsx';
import hero640Jpg from '../assets/hero/hero-640.jpg';
import hero640Webp from '../assets/hero/hero-640.webp';
import hero1024Jpg from '../assets/hero/hero-1024.jpg';
import hero1024Webp from '../assets/hero/hero-1024.webp';
import hero1600Jpg from '../assets/hero/hero-1600.jpg';
import hero1600Webp from '../assets/hero/hero-1600.webp';
import { SectionLink } from './SectionLink.jsx';
import './Hero.css';

// Generated from assets-src/hero-background.png by `npm run images`.
const WEBP_SRCSET = `${hero640Webp} 640w, ${hero1024Webp} 1024w, ${hero1600Webp} 1600w`;
const JPG_SRCSET = `${hero640Jpg} 640w, ${hero1024Jpg} 1024w, ${hero1600Jpg} 1600w`;

export function Hero() {
  const { t } = useLanguage();

  return (
    <section id="top" className="hero" aria-labelledby="hero-title">
      {/* Decorative backdrop: the heading carries the meaning, so alt is empty. */}
      <picture className="hero__media">
        <source type="image/webp" srcSet={WEBP_SRCSET} sizes="100vw" />
        <img
          src={hero1024Jpg}
          srcSet={JPG_SRCSET}
          sizes="100vw"
          alt=""
          width="1672"
          height="941"
          fetchPriority="high"
          decoding="async"
        />
      </picture>
      <div className="hero__overlay" aria-hidden="true" />

      <div className="hero__content container">
        <h1 id="hero-title" className="hero__title">
          {t.hero.title}
        </h1>
        <p className="hero__tagline">{t.hero.tagline}</p>
        <div className="hero__actions">
          <SectionLink to="schedule" className="button button--primary">
            {t.hero.primaryCta}
          </SectionLink>
          <SectionLink to="contact" className="button button--ghost">
            {t.hero.secondaryCta}
          </SectionLink>
        </div>
      </div>
    </section>
  );
}
