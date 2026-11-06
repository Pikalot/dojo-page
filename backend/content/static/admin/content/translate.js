// Fills the other language when an editor leaves a field. Text a person typed is
// never overwritten: they get a button instead. A failure only shows a note, and
// saving always works with one language. The server enforces all the real rules.
(function () {
  const ENDPOINT = '/admin/translate/';
  const NAMES = { en: 'English', vi: 'Vietnamese' };
  // How long a save waits for a translation in progress before going ahead.
  const SAVE_WAIT_MS = 6000;
  const pending = new Set();

  function csrfToken() {
    return document.querySelector('[name=csrfmiddlewaretoken]')?.value ?? '';
  }

  async function requestTranslation(text, source, target) {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      credentials: 'same-origin',
      redirect: 'manual',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken() },
      body: JSON.stringify({ text, source, target }),
    });
    if (!response.ok) throw new Error(String(response.status));
    return (await response.json()).translation;
  }

  function createNote(field) {
    const note = document.createElement('div');
    note.className = 'help';
    note.setAttribute('role', 'status');
    // Room is reserved up front. Otherwise the note appearing when someone clicks
    // Save moves the button away between press and release, and the click misses.
    note.style.minHeight = '2.5rem';
    field.after(note);
    return note;
  }

  function attach(english, vietnamese) {
    const fields = { en: english, vi: vietnamese };
    const notes = { en: createNote(english), vi: createNote(vietnamese) };
    // What the machine last wrote in each field. If the field still holds exactly
    // that, a person hasn't touched it and it's safe to replace.
    const machineText = { en: null, vi: null };
    const latestRequest = { en: 0, vi: 0 };

    async function fill(source, target, { replace = false } = {}) {
      const sourceField = fields[source];
      const targetField = fields[target];
      const note = notes[target];
      const text = sourceField.value;
      const targetBefore = targetField.value;
      latestRequest[target] += 1;
      const thisRequest = latestRequest[target];

      note.textContent = `Translating to ${NAMES[target]}…`;
      const work = requestTranslation(text, source, target);
      pending.add(work);
      try {
        const translation = await work;
        // A newer edit makes this answer out of date.
        if (thisRequest !== latestRequest[target] || sourceField.value !== text) return;
        if (targetField.value !== targetBefore && !replace) {
          note.textContent = '';
          return;
        }
        targetField.value = translation;
        machineText[target] = translation;
        note.textContent = 'Translated automatically. Please check it before saving.';
      } catch {
        if (thisRequest !== latestRequest[target]) return;
        note.textContent = `Couldn't translate automatically. You can type the ${NAMES[target]} yourself, or save with one language.`;
      } finally {
        pending.delete(work);
      }
    }

    function offerUpdate(source, target) {
      const note = notes[target];
      note.textContent = '';
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'button';
      button.textContent = `Replace the ${NAMES[target]} with a new translation`;
      button.addEventListener('click', () => {
        button.remove();
        fill(source, target, { replace: true });
      });
      note.append(button);
    }

    function onChange(source, target) {
      machineText[source] = null; // A person just wrote this one.
      if (!fields[source].value.trim()) {
        notes[target].textContent = '';
        return;
      }
      const existing = fields[target].value;
      if (!existing.trim() || existing === machineText[target]) fill(source, target);
      else offerUpdate(source, target);
    }

    english.addEventListener('change', () => onChange('en', 'vi'));
    vietnamese.addEventListener('change', () => onChange('vi', 'en'));
  }

  function settled() {
    return Promise.race([
      Promise.allSettled([...pending]),
      new Promise((resolve) => {
        setTimeout(resolve, SAVE_WAIT_MS);
      }),
    ]);
  }

  // Pressing Save right after typing leaves the field and starts a translation in
  // the same moment. Wait for it, so the save includes it, but never for long.
  function holdSaveForTranslations(form) {
    form.addEventListener('submit', async (event) => {
      if (!pending.size || form.dataset.translationWaited) return;
      event.preventDefault();
      form.dataset.translationWaited = 'yes';
      const button = event.submitter;
      await settled();
      form.requestSubmit(button);
    });
  }

  function attachToAdminForm() {
    const form = document.querySelector('#content-main form');
    if (!form || form.id === 'photo-upload') return;
    let attached = 0;
    form.querySelectorAll('input[type=text][name$="_en"], textarea[name$="_en"]').forEach((english) => {
      const vietnamese = form.elements[english.name.replace(/_en$/, '_vi')];
      if (vietnamese && !vietnamese.readOnly && !english.readOnly) {
        attach(english, vietnamese);
        attached += 1;
      }
    });
    if (attached) holdSaveForTranslations(form);
  }

  window.dojoTranslation = { attach, settled };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attachToAdminForm);
  else attachToAdminForm();
})();
