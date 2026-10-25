/* Shared, local-only interactions for the two static design previews. */
(() => {
  const reports = {
    backpack: { title: 'The everyday backpack', image: 'assets/backpack.jpg', alt: 'Navy backpack', meta: 'Found · Library · Bags & accessories', description: 'An everyday backpack was left near the library seating area. If it looks familiar, the full app will let you submit a private ownership claim.' },
    headphones: { title: 'A little peace & quiet', image: 'assets/headphones.jpg', alt: 'A pair of over-ear headphones', meta: 'Found · Student commons · Electronics', description: 'Over-ear headphones were found in the student commons. Private identifying details help staff connect them with their owner.' },
    camera: { title: 'A thousand little memories', image: 'assets/camera.jpg', alt: 'A black camera and lens', meta: 'Lost · Courtyard · Electronics', description: 'A camera was reported missing near the courtyard. Found something similar? Create a found-item report so its owner can find a possible match.' },
  };

  const search = document.querySelector('#item-search');
  const filters = [...document.querySelectorAll('[data-filter]')];
  const items = [...document.querySelectorAll('[data-item]')];
  let selectedFilter = 'all';

  function filterItems() {
    const query = search.value.trim().toLowerCase();
    let visible = 0;
    items.forEach((item) => {
      const matches = (selectedFilter === 'all' || item.dataset.status === selectedFilter)
        && item.dataset.search.includes(query);
      item.hidden = !matches;
      if (matches) visible += 1;
    });
    document.querySelector('#result-count').textContent = `${visible} sample report${visible === 1 ? '' : 's'}`;
    document.querySelector('#empty-state').hidden = visible !== 0;
  }

  filters.forEach((filter) => filter.addEventListener('click', () => {
    selectedFilter = filter.dataset.filter;
    filters.forEach((button) => button.setAttribute('aria-pressed', String(button === filter)));
    filterItems();
  }));
  search.addEventListener('input', filterItems);

  const reportDialog = document.querySelector('#report-dialog');
  const itemDialog = document.querySelector('#item-dialog');
  document.querySelectorAll('[data-report]').forEach((button) => button.addEventListener('click', () => {
    if (button.hasAttribute('data-close-parent')) button.closest('dialog').close();
    document.querySelector('#form-message').textContent = '';
    reportDialog.showModal();
  }));
  document.querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click', () => button.closest('dialog').close()));
  document.querySelectorAll('dialog').forEach((dialog) => dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  }));
  items.forEach((item) => item.addEventListener('click', () => {
    const report = reports[item.dataset.item];
    document.querySelector('#item-title').textContent = report.title;
    document.querySelector('#detail-image').src = report.image;
    document.querySelector('#detail-image').alt = report.alt;
    document.querySelector('#detail-meta').textContent = report.meta;
    document.querySelector('#detail-description').textContent = report.description;
    itemDialog.showModal();
  }));
  document.querySelector('#report-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const title = String(values.get('title')).trim();
    const location = String(values.get('location')).trim();
    const description = String(values.get('description')).trim();
    const message = document.querySelector('#form-message');
    if (!title || !location || !description) {
      message.textContent = 'Please add an item name, location, and description.';
      return;
    }
    message.textContent = `Preview ready: “${title}” — ${values.get('type')} at ${location}. This preview has not been submitted or saved.`;
  });

  const menu = document.querySelector('.mobile-menu');
  const navigation = document.querySelector('#navigation');
  menu.addEventListener('click', () => {
    const open = menu.getAttribute('aria-expanded') !== 'true';
    menu.setAttribute('aria-expanded', String(open));
    navigation.classList.toggle('open', open);
  });
  navigation.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
    menu.setAttribute('aria-expanded', 'false');
    navigation.classList.remove('open');
  }));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && menu.getAttribute('aria-expanded') === 'true') {
      menu.setAttribute('aria-expanded', 'false');
      navigation.classList.remove('open');
      menu.focus();
    }
  });

  if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08 });
    document.querySelectorAll('.reveal').forEach((element) => observer.observe(element));
    document.documentElement.classList.add('js');
  }
})();
