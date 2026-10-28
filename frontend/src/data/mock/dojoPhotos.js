// Dojo photo carousel, in display order. JS rather than JSON so Vite can
// fingerprint the image files. With a backend, `src` becomes the photo's URL.
import dojo from '../../assets/dojo/dojo.jpg';
import hero0 from '../../assets/dojo/Hero0.jpg';
import hero1 from '../../assets/dojo/hero1.jpg';
import hero2 from '../../assets/dojo/Hero2.jpg';
import hero3 from '../../assets/dojo/Hero3.jpg';

export default [
  {
    id: 'dojo-ceremony',
    src: dojo,
    alt: {
      en: 'Tenshinkai Aikido members in hakama holding their rank certificates in the dojo',
      vi: 'Các môn sinh Tenshinkai Aikido mặc hakama, cầm giấy chứng nhận đẳng cấp tại võ đường',
    },
  },
  {
    id: 'dojo-handshake',
    src: hero0,
    alt: {
      en: 'A senior instructor shakes hands with a student while presenting a rank certificate',
      vi: 'Huấn luyện viên cao cấp bắt tay và trao giấy chứng nhận đẳng cấp cho một môn sinh',
    },
  },
  {
    id: 'dojo-demonstration',
    src: hero1,
    alt: {
      en: 'Two aikidoka in hakama demonstrate a technique on the mat while others watch',
      vi: 'Hai võ sinh mặc hakama biểu diễn kỹ thuật trên thảm trong khi mọi người theo dõi',
    },
  },
  {
    id: 'dojo-seiza',
    src: hero2,
    alt: {
      en: 'Two instructors kneeling in seiza exchange a rank certificate',
      vi: 'Hai huấn luyện viên quỳ theo tư thế seiza, trao nhận giấy chứng nhận đẳng cấp',
    },
  },
  {
    id: 'dojo-kids',
    src: hero3,
    alt: {
      en: 'Two young students practice a technique on the dojo mat',
      vi: 'Hai môn sinh nhỏ tuổi luyện tập kỹ thuật trên thảm võ đường',
    },
  },
];
