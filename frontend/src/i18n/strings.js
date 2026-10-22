// UI text for every supported language. Content that staff will edit later
// (announcements, schedule, fees, instructors) lives in src/data instead.
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
      fees: 'Fees',
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
      tagline: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
      primaryCta: 'View schedule',
      secondaryCta: 'Contact us',
    },
    sections: {
      about: 'Tenshinkai Aikido San Jose',
      whereWeTrain: 'Where we train',
      seeMap: 'See map and directions',
      announcements: 'Info & Announcements',
      schedule: 'Schedule',
      instructors: 'Instructors',
      contact: 'Contact Us',
      fees: 'Fees',
    },
    about: {
      photoAlt: 'Tenshinkai Aikido members in hakama holding their rank certificates in the dojo',
    },
    schedule: {
      day: 'Day',
      time: 'Time',
      class: 'Class',
    },
    fees: {
      plan: 'Plan',
      price: 'Price',
    },
    instructors: {
      previous: 'Scroll to previous instructors',
      next: 'Scroll to next instructors',
      listLabel: 'Instructor profiles',
      photoPlaceholder: (name) => `Placeholder photo for ${name}`,
    },
    contact: {
      address: 'Address',
      phone: 'Phone',
      email: 'Email',
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
      placeholderNotice: 'Placeholder content: details on this page are not final.',
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
      announcements: 'Thông báo',
      schedule: 'Lịch tập',
      instructors: 'Huấn luyện viên',
      contact: 'Liên hệ',
      fees: 'Học phí',
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
      tagline: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
      primaryCta: 'Xem lịch tập',
      secondaryCta: 'Liên hệ',
    },
    sections: {
      about: 'Tenshinkai Aikido San Jose',
      whereWeTrain: 'Địa điểm tập luyện',
      seeMap: 'Xem bản đồ và chỉ đường',
      announcements: 'Thông tin & Thông báo',
      schedule: 'Lịch tập',
      instructors: 'Huấn luyện viên',
      contact: 'Liên hệ',
      fees: 'Học phí',
    },
    about: {
      photoAlt: 'Các môn sinh Tenshinkai Aikido mặc hakama, cầm giấy chứng nhận đẳng cấp tại võ đường',
    },
    schedule: {
      day: 'Ngày',
      time: 'Giờ',
      class: 'Lớp',
    },
    fees: {
      plan: 'Gói',
      price: 'Giá',
    },
    instructors: {
      previous: 'Cuộn đến huấn luyện viên trước',
      next: 'Cuộn đến huấn luyện viên tiếp theo',
      listLabel: 'Hồ sơ huấn luyện viên',
      photoPlaceholder: (name) => `Ảnh tạm thời của ${name}`,
    },
    contact: {
      address: 'Địa chỉ',
      phone: 'Điện thoại',
      email: 'Email',
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
