// Single source of truth for page sections: drives the navbar links and the
// section search. `id` is the anchor on the page; `navKey` looks up the label
// in strings.nav. Keywords let people find a section by related words.
export const SECTIONS = [
  {
    id: 'about',
    navKey: 'about',
    keywords: {
      en: ['aikido', 'tenshinkai', 'history', 'dojo', 'location', 'address', 'where'],
      vi: ['lịch sử', 'võ đường', 'địa điểm', 'địa chỉ', 'ở đâu'],
    },
  },
  {
    id: 'announcements',
    navKey: 'announcements',
    keywords: {
      en: ['info', 'news', 'events', 'updates', 'seminar'],
      vi: ['thông tin', 'tin tức', 'sự kiện', 'cập nhật'],
    },
  },
  {
    id: 'schedule',
    navKey: 'schedule',
    keywords: {
      en: ['classes', 'times', 'hours', 'timetable', 'calendar'],
      vi: ['giờ tập', 'lớp học', 'thời gian', 'thời khóa biểu'],
    },
  },
  {
    id: 'instructors',
    navKey: 'instructors',
    keywords: {
      en: ['teachers', 'sensei', 'dojo head', 'staff', 'rank'],
      vi: ['thầy', 'võ sư', 'giáo viên', 'trưởng võ đường', 'đẳng cấp'],
    },
  },
  {
    id: 'contact',
    navKey: 'contact',
    keywords: {
      en: ['email', 'phone', 'message', 'map', 'directions', 'address', 'location'],
      vi: ['email', 'điện thoại', 'tin nhắn', 'bản đồ', 'chỉ đường', 'địa chỉ'],
    },
  },
  {
    id: 'fees',
    navKey: 'fees',
    keywords: {
      en: ['price', 'pricing', 'cost', 'membership', 'tuition', 'dues'],
      vi: ['giá', 'phí', 'hội phí', 'chi phí'],
    },
  },
];
