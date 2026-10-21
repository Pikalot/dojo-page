// PLACEHOLDER CONTENT. Every value here is temporary and must be replaced with
// real dojo information. The address and map currently point at SJSU.
//
// The shape mirrors what the Phase 2 API is expected to return, so components
// will not need to change when this module is swapped for real requests.
// Translatable fields are { en, vi } objects; getSiteContent() resolves them.

const LOREM_SHORT = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.';
const LOREM_MEDIUM =
  'Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.';
const LOREM_LONG =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.';

const same = (text) => ({ en: text, vi: text });

const content = {
  dojo: {
    name: 'Tenshinkai Aikido',
  },

  about: {
    paragraphs: [same(LOREM_LONG), same(LOREM_MEDIUM)],
  },

  location: {
    name: 'San José State University (placeholder)',
    addressLines: ['1 Washington Square', 'San Jose, CA 95192'],
    // Query-based embed needs no API key. Replace the query with the real address.
    mapQuery: '1 Washington Square, San Jose, CA 95192',
    note: same(LOREM_SHORT),
  },

  contact: {
    intro: same(LOREM_MEDIUM),
    phone: '(000) 000-0000',
    email: 'info@example.com',
  },

  announcements: [
    { id: 'a1', date: '2026-11-01', title: same('Lorem ipsum dolor sit'), body: same(LOREM_MEDIUM) },
    { id: 'a2', date: '2026-11-15', title: same('Consectetur adipiscing'), body: same(LOREM_SHORT) },
    { id: 'a3', date: '2026-12-06', title: same('Sed do eiusmod tempor'), body: same(LOREM_MEDIUM) },
  ],

  schedule: [
    { id: 's1', day: { en: 'Monday', vi: 'Thứ Hai' }, start: '19:00', end: '20:30', className: { en: 'Adults (all levels)', vi: 'Người lớn (mọi trình độ)' } },
    { id: 's2', day: { en: 'Wednesday', vi: 'Thứ Tư' }, start: '19:00', end: '20:30', className: { en: 'Adults (all levels)', vi: 'Người lớn (mọi trình độ)' } },
    { id: 's3', day: { en: 'Friday', vi: 'Thứ Sáu' }, start: '18:00', end: '19:00', className: { en: 'Beginners', vi: 'Người mới' } },
    { id: 's4', day: { en: 'Saturday', vi: 'Thứ Bảy' }, start: '10:00', end: '11:30', className: { en: 'Weapons (bokken / jō)', vi: 'Vũ khí (bokken / jō)' } },
  ],

  fees: [
    { id: 'f1', plan: { en: 'Monthly membership', vi: 'Hội phí hàng tháng' }, price: '$XX', period: { en: 'per month', vi: 'mỗi tháng' } },
    { id: 'f2', plan: { en: 'Drop-in class', vi: 'Buổi tập lẻ' }, price: '$XX', period: { en: 'per class', vi: 'mỗi buổi' } },
    { id: 'f3', plan: { en: 'Student / family', vi: 'Sinh viên / gia đình' }, price: '$XX', period: { en: 'per month', vi: 'mỗi tháng' } },
    { id: 'f4', plan: { en: 'Annual federation dues', vi: 'Phí liên đoàn hàng năm' }, price: '$XX', period: { en: 'per year', vi: 'mỗi năm' } },
  ],
  feesNote: same(LOREM_SHORT),

  instructors: [
    { id: 'i1', name: 'Dojo Head', role: { en: 'Dojo Head', vi: 'Trưởng võ đường' }, rank: { en: 'Xth Dan', vi: 'X đẳng' }, bio: same(LOREM_MEDIUM) },
    { id: 'i2', name: 'Instructor A', role: { en: 'Instructor', vi: 'Huấn luyện viên' }, rank: { en: 'Xth Dan', vi: 'X đẳng' }, bio: same(LOREM_SHORT) },
    { id: 'i3', name: 'Instructor B', role: { en: 'Instructor', vi: 'Huấn luyện viên' }, rank: { en: 'Xth Dan', vi: 'X đẳng' }, bio: same(LOREM_MEDIUM) },
    { id: 'i4', name: 'Instructor C', role: { en: 'Instructor', vi: 'Huấn luyện viên' }, rank: { en: 'Xth Dan', vi: 'X đẳng' }, bio: same(LOREM_SHORT) },
    { id: 'i5', name: 'Instructor D', role: { en: 'Instructor', vi: 'Huấn luyện viên' }, rank: { en: 'Xth Dan', vi: 'X đẳng' }, bio: same(LOREM_MEDIUM) },
    { id: 'i6', name: 'Instructor E', role: { en: 'Assistant instructor', vi: 'Trợ giảng' }, rank: { en: 'Xth Dan', vi: 'X đẳng' }, bio: same(LOREM_SHORT) },
  ],
};

function isTranslation(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && 'en' in value && 'vi' in value;
}

// Recursively replaces every { en, vi } object with the string for `language`.
export function localize(value, language) {
  if (isTranslation(value)) return value[language] ?? value.en;
  if (Array.isArray(value)) return value.map((item) => localize(item, language));
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, localize(v, language)]));
  }
  return value;
}

export function getSiteContent(language) {
  return localize(content, language);
}
