// UI text for every supported language. Content that staff will edit later
// (announcements, schedule, FAQ, instructors) lives in src/data instead.
// Vietnamese strings are a first draft and should be reviewed by a native speaker.

export const LANGUAGES = [
  { code: 'en', label: 'EN', name: 'English' },
  { code: 'vi', label: 'VI', name: 'Tiếng Việt' },
];

export const DEFAULT_LANGUAGE = 'en';

export const strings = {
  en: {
    meta: {
      title: 'Tenshinkai Aikido Dojo',
    },
    nav: {
      label: 'Main',
      home: 'Tenshinkai Aikido home',
      about: 'About',
      announcements: 'Announcements',
      schedule: 'Schedule',
      instructors: 'Instructors',
      contact: 'Contact',
      faq: 'FAQ',
      openMenu: 'Open menu',
      closeMenu: 'Close menu',
      skipToContent: 'Skip to main content',
      language: 'Language',
    },
    search: {
      label: 'Jump to a section',
      placeholder: 'Search sections…',
      noResults: 'No matching sections',
      resultsCount: (n) => (n === 1 ? '1 result available.' : `${n} results available.`),
    },
    hero: {
      title: 'Tenshinkai Aikido',
      tagline: 'True victory is victory over oneself.',
      primaryCta: 'View schedule',
      secondaryCta: 'Contact us',
    },
    sections: {
      about: 'Tenshinkai Aikido San Jose',
      subcontent: '',
      whereWeTrain: 'Where we train',
      seeMap: 'See map and directions',
      announcements: 'News & Events',
      schedule: 'Schedule',
      instructors: 'Instructors',
      contact: 'Contact Us',
      faq: 'Frequently Asked Questions',
    },
    about: {
      photos: 'Dojo photos',
      previousPhoto: 'Previous photo',
      nextPhoto: 'Next photo',
      closePhoto: 'Close photo viewer',
    },
    schedule: {
      day: 'Day',
      time: 'Time',
      class: 'Class',
    },
    instructors: {
      previous: 'Scroll to previous instructors',
      next: 'Scroll to next instructors',
      listLabel: 'Instructor profiles',
      photoAlt: (name) => `Photo of ${name}`,
      close: 'Close',
      blackBelts: 'Black Belts',
    },
    contact: {
      address: 'Address',
      phone: 'Phone',
      email: 'Email',
      facebook: "Facebook",
      directions: 'Get directions',
      mapTitle: 'Map showing the dojo location',
      newTab: '(opens in a new tab)',
    },
    content: {
      loading: 'Loading…',
      error: 'Sorry, this section could not be loaded. Please try again later.',
    },
    footer: {
      rights: 'All rights reserved.',
      placeholderNotice: '',
    },
  },

  vi: {
    meta: {
      title: 'Võ đường Aikido Tenshinkai',
    },
    nav: {
      label: 'Chính',
      home: 'Trang chủ Aikido Tenshinkai',
      about: 'Giới thiệu',
      announcements: 'Tin tức & Sự kiện',
      schedule: 'Lịch tập',
      instructors: 'Huấn luyện viên',
      contact: 'Liên hệ',
      faq: 'Hỏi đáp',
      openMenu: 'Mở menu',
      closeMenu: 'Đóng menu',
      skipToContent: 'Chuyển đến nội dung chính',
      language: 'Ngôn ngữ',
    },
    search: {
      label: 'Chuyển đến mục',
      placeholder: 'Tìm mục…',
      noResults: 'Không tìm thấy mục phù hợp',
      resultsCount: (n) => `Có ${n} kết quả.`,
    },
    hero: {
      title: 'Aikido Tenshinkai',
      tagline: 'Hệ phái Aikido dành cho người Việt.',
      primaryCta: 'Xem lịch tập',
      secondaryCta: 'Liên hệ',
    },
    sections: {
      about: 'Aikido Tenshinkai San Jose',
      subcontent: '',
      whereWeTrain: 'Địa điểm tập luyện',
      seeMap: 'Xem bản đồ và chỉ đường',
      announcements: 'Thông tin & Thông báo',
      schedule: 'Lịch tập',
      instructors: 'Huấn luyện viên',
      contact: 'Liên hệ',
      faq: 'Câu hỏi thường gặp',
    },
    about: {
      photos: 'Ảnh võ đường',
      previousPhoto: 'Ảnh trước',
      nextPhoto: 'Ảnh tiếp theo',
      closePhoto: 'Đóng trình xem ảnh',
    },
    schedule: {
      day: 'Ngày',
      time: 'Giờ',
      class: 'Lớp',
    },
    instructors: {
      previous: 'Cuộn đến huấn luyện viên trước',
      next: 'Cuộn đến huấn luyện viên tiếp theo',
      listLabel: 'Hồ sơ huấn luyện viên',
      photoAlt: (name) => `Ảnh của ${name}`,
      close: 'Đóng',
      blackBelts: 'Đai đen',
    },
    contact: {
      address: 'Địa chỉ',
      phone: 'Điện thoại',
      email: 'Email',
      facebook: 'Facebook',
      directions: 'Chỉ đường',
      mapTitle: 'Bản đồ vị trí võ đường',
      newTab: '(mở trong thẻ mới)',
    },
    content: {
      loading: 'Đang tải…',
      error: 'Xin lỗi, không thể tải mục này. Vui lòng thử lại sau.',
    },
    footer: {
      rights: 'Bảo lưu mọi quyền.',
      placeholderNotice: 'Nội dung tạm thời: thông tin trên trang chưa chính thức.',
    },
  },
};
