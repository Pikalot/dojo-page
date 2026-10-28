// Public content API. One function per resource, matching one backend endpoint each.
//
// Phase 1: each function returns the matching mock file from src/data/mock/.
// Phase 2: replace the body with a fetch, e.g.
//   export const getSchedule = () => request('/api/schedule');
// Components never import mock data directly, so nothing else has to change.
//
// Translatable fields come back as { en, vi }; useContent() picks the language.

import about from '../data/mock/about.json';
import subcontent from '../data/mock/subcontent.json';
import announcements from '../data/mock/announcements.json';
import contact from '../data/mock/contact.json';
import dojoPhotos from '../data/mock/dojoPhotos.js';
import fees from '../data/mock/fees.json';
import instructors from '../data/mock/instructors.json';
import location from '../data/mock/location.json';
import schedule from '../data/mock/schedule.json';

// Async on purpose, so the components already handle loading and errors the
// way they will with real network requests.
const mock = (data) => Promise.resolve(data);

export const getAbout = () => mock(about);
export const getLocation = () => mock(location);
export const getContact = () => mock(contact);
export const getAnnouncements = () => mock(announcements);
export const getSchedule = () => mock(schedule);
export const getFees = () => mock(fees);
export const getInstructors = () => mock(instructors);
export const getSubcontent = () => mock(subcontent);
export const getDojoPhotos = () => mock(dojoPhotos);
