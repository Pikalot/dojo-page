// Test-owned content, shaped like the responses from api/content.js and keyed by
// the API function that returns each one. Every value is generated, so tests
// never depend on what the real content says.
const translated = (label) => ({ en: `${label} en`, vi: `${label} vi` });
const list = (count, make) => Array.from({ length: count }, (_, i) => make(i + 1));
const paragraphs = (label, count) => ({
  en: list(count, (n) => `${label} en ${n}`).join('\n\n'),
  vi: list(count, (n) => `${label} vi ${n}`).join('\n\n'),
});
const pad = (n) => String(n).padStart(2, '0');

export function makeContent() {
  return {
    getAbout: { body: paragraphs('About paragraph', 2) },
    getLocation: {
      name: 'Location name',
      address: list(2, (n) => `Address line ${n}`).join('\n'),
      note: translated('Location note'),
    },
    getContact: {
      intro: paragraphs('Contact intro', 1),
      phone: '(000) 000-0000',
      email: 'contact@example.test',
      facebook: 'https://example.test/dojo',
    },
    getAnnouncements: list(3, (n) => ({
      id: `announcement-${n}`,
      date: `2000-01-${pad(n)}`,
      title: translated(`Announcement title ${n}`),
      body: paragraphs(`Announcement body ${n}`, 1),
    })),
    getSchedule: list(3, (n) => ({
      id: `class-${n}`,
      day: translated(`Day ${n}`),
      start: `${pad(10 + n)}:00`,
      end: `${pad(10 + n)}:30`,
      className: translated(`Class ${n}`),
    })),
    getSubcontent: { body: paragraphs('Subcontent paragraph', 1) },
    getFaq: list(3, (n) => ({
      id: `faq-${n}`,
      question: translated(`Question ${n}`),
      answer: paragraphs(`Answer ${n}`, 1),
    })),
    getInstructors: list(3, (n) => ({
      id: `instructor-${n}`,
      name: `Instructor ${n}`,
      // Optional: only the first instructor has a photo.
      ...(n === 1 && { photo: `/instructor-${n}.jpg` }),
      role: translated(`Role ${n}`),
      rank: translated(`Rank ${n}`),
      bio: paragraphs(`Bio ${n}`, 1),
    })),
    getDojoPhotos: list(3, (n) => ({
      id: `photo-${n}`,
      src: `/photo-${n}.jpg`,
      alt: translated(`Photo ${n}`),
    })),
  };
}

/** Points every function of a vi.mock()-ed api/content.js at the given content. */
export function serveContent(api, content) {
  for (const [name, data] of Object.entries(content)) {
    api[name].mockResolvedValue(data);
  }
}
