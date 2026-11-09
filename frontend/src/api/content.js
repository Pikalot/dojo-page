// Public content API. One function per resource, matching one backend endpoint each.
//
// By default each function returns the matching mock file from src/data/mock/.
// With VITE_USE_API=true, the ones the backend serves fetch from it instead.
// about, subcontent, contact and location have no database tables yet, so they
// stay on mock data either way. Components never import mock data directly, so
// nothing else has to change.
//
// Translatable fields come back as { en, vi }; useContent() picks the language.

import { shareResult } from './shared.js';
import about from '../data/mock/about.json';
import subcontent from '../data/mock/subcontent.json';
import announcements from '../data/mock/announcements.json';
import contact from '../data/mock/contact.json';
import faq from '../data/mock/faq.json';
import dojoPhotos from '../data/mock/dojoPhotos.json';
import instructors from '../data/mock/instructors.json';
import location from '../data/mock/location.json';
import schedule from '../data/mock/schedule.json';

// Async on purpose, so the components already handle loading and errors the
// way they will with real network requests.
const mock = (data) => Promise.resolve(data);

async function request(path) {
  const response = await fetch(path, { headers: { Accept: 'application/json' } });
  // fetch only rejects on network failure; useContent() shows the error message
  // for anything that rejects, so a 500 has to reject too.
  if (!response.ok) throw new Error(`${path} responded with ${response.status}`);
  return response.json();
}

// Read when called rather than once at startup, so tests can switch it.
const useApi = () => import.meta.env.VITE_USE_API === 'true';
const fromApi = (path, fallback) => (useApi() ? request(path) : mock(fallback));

export const getAbout = () => mock(about);
export const getLocation = () => mock(location);
export const getContact = () => mock(contact);
export const getSubcontent = () => mock(subcontent);
export const getAnnouncements = () => fromApi('/api/announcements', announcements);
export const getSchedule = () => fromApi('/api/schedule', schedule);
export const getFaq = () => fromApi('/api/faq', faq);
// Used by both the Instructors section and the search box, so they share one request.
export const getInstructors = () =>
  useApi() ? shareResult('/api/instructors', () => request('/api/instructors')) : mock(instructors);
export const getDojoPhotos = () => fromApi('/api/dojo-photos', dojoPhotos);
