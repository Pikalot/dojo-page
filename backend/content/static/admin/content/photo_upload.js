// Drag-and-drop for the admin's photo upload page. Photos go one request at a
// time, so one failure can't affect the others and can be retried by itself. All
// checks here are for quick feedback only: the server repeats and enforces them.
(function () {
  const form = document.getElementById('photo-upload');
  if (!form) return;

  const drop = document.getElementById('photo-drop');
  const input = document.getElementById('photo-files');
  const list = document.getElementById('photo-list');
  const options = document.getElementById('photo-options');
  const status = document.getElementById('photo-status');
  const submit = document.getElementById('photo-submit');
  const maxBytes = Number(form.dataset.maxBytes);
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  const csrfToken = form.querySelector('[name=csrfmiddlewaretoken]').value;
  let nextId = 0;
  let uploading = false;

  // Otherwise a file dropped just outside the box makes the browser navigate to
  // it, and everything typed on this page is lost.
  ['dragover', 'drop'].forEach((name) => window.addEventListener(name, (e) => e.preventDefault()));
  ['dragenter', 'dragover'].forEach((name) =>
    drop.addEventListener(name, () => drop.classList.add('photo-upload__drop--over')),
  );
  ['dragleave', 'drop'].forEach((name) =>
    drop.addEventListener(name, () => drop.classList.remove('photo-upload__drop--over')),
  );
  drop.addEventListener('drop', (e) => {
    e.stopPropagation();
    e.preventDefault();
    addFiles(e.dataTransfer.files);
  });
  input.addEventListener('change', () => {
    addFiles(input.files);
    input.value = ''; // So choosing the same file again still fires this.
  });

  function textField(id, label) {
    const wrap = document.createElement('label');
    wrap.htmlFor = id;
    wrap.textContent = label;
    const field = document.createElement('input');
    field.type = 'text';
    field.id = id;
    field.maxLength = 500;
    field.required = true;
    wrap.append(field);
    return { wrap, field };
  }

  function showMessage(card, text, isError) {
    const message = card.querySelector('.photo-upload__message');
    message.textContent = text;
    message.classList.toggle('photo-upload__message--error', isError);
  }

  function addFiles(files) {
    const rejected = [];
    Array.from(files).forEach((file) => {
      if (!allowedTypes.includes(file.type)) rejected.push(`${file.name}: not a JPEG, PNG or WebP`);
      else if (file.size > maxBytes) rejected.push(`${file.name}: larger than ${form.dataset.maxMb} MB`);
      else addCard(file);
    });
    status.textContent = rejected.length ? `Not added. ${rejected.join('; ')}.` : '';
    refresh();
  }

  function addCard(file) {
    nextId += 1;
    const card = document.createElement('li');
    card.className = 'photo-upload__card';
    card.file = file;

    const preview = document.createElement('img');
    const previewUrl = URL.createObjectURL(file);
    preview.src = previewUrl;
    preview.alt = '';

    const body = document.createElement('div');
    const name = document.createElement('p');
    name.className = 'photo-upload__name';
    name.textContent = file.name;
    const english = textField(`alt-en-${nextId}`, 'Describe this photo (English)');
    const vietnamese = textField(`alt-vi-${nextId}`, 'Describe this photo (Vietnamese)');
    card.altEn = english.field;
    card.altVi = vietnamese.field;

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'button';
    remove.textContent = `Remove ${file.name}`;
    remove.addEventListener('click', () => {
      URL.revokeObjectURL(previewUrl);
      card.remove();
      refresh();
    });
    card.removeButton = remove;

    const message = document.createElement('p');
    message.className = 'photo-upload__message';

    body.append(name, english.wrap, vietnamese.wrap, remove, message);
    card.append(preview, body);
    list.append(card);
  }

  const waitingCards = () => Array.from(list.children).filter((card) => !card.uploaded);

  function refresh() {
    const count = waitingCards().length;
    options.hidden = list.children.length === 0;
    submit.hidden = count === 0;
    submit.disabled = uploading;
    submit.textContent = count === 1 ? 'Upload 1 photo' : `Upload ${count} photos`;
  }

  async function uploadCard(card) {
    const body = new FormData();
    body.append('file', card.file);
    body.append('alt_en', card.altEn.value);
    body.append('alt_vi', card.altVi.value);
    if (document.getElementById('photo-carousel')?.checked) body.append('add_to_carousel', 'on');
    if (document.getElementById('photo-publish')?.checked) body.append('publish', 'on');

    showMessage(card, 'Uploading…', false);
    let response;
    try {
      response = await fetch(form.action || window.location.href, {
        method: 'POST',
        body,
        credentials: 'same-origin',
        redirect: 'manual',
        headers: { 'X-CSRFToken': csrfToken, Accept: 'application/json' },
      });
    } catch {
      showMessage(card, 'The server could not be reached. Nothing was saved for this photo.', true);
      return false;
    }
    if (response.type === 'opaqueredirect') {
      showMessage(card, 'You are no longer signed in. Sign in again in another tab, then retry.', true);
      return false;
    }
    let result = {};
    try {
      result = await response.json();
    } catch {
      // Handled below: a page with no JSON, such as a 403, is still a failure.
    }
    if (!response.ok) {
      const fallback = response.status === 403 ? "You don't have permission to upload photos." : 'This photo was not saved.';
      showMessage(card, result.error || fallback, true);
      return false;
    }

    card.uploaded = true;
    card.altEn.disabled = true;
    card.altVi.disabled = true;
    card.removeButton.hidden = true;
    const message = card.querySelector('.photo-upload__message');
    message.textContent = 'Saved. ';
    message.classList.remove('photo-upload__message--error');
    const link = document.createElement('a');
    link.href = result.change_url;
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = 'Open this photo';
    message.append(link);
    return true;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (uploading) return;

    const cards = waitingCards();
    const invalid = cards.flatMap((card) => [card.altEn, card.altVi]).filter((field) => !field.value.trim());
    if (invalid.length) {
      status.textContent = 'Please describe every photo in both languages. Screen readers read this to people who can’t see it.';
      invalid[0].focus();
      return;
    }

    uploading = true;
    refresh();
    let saved = 0;
    for (const [index, card] of cards.entries()) {
      status.textContent = `Uploading ${index + 1} of ${cards.length}…`;
      // One at a time, to go easy on the server and keep the order they were added.
      // eslint-disable-next-line no-await-in-loop
      if (await uploadCard(card)) saved += 1;
    }
    uploading = false;
    refresh();
    const failed = cards.length - saved;
    status.textContent = failed
      ? `${saved} saved, ${failed} not saved. Check the messages above, then press Upload to retry.`
      : `${saved} saved.`;
  });
})();
