(function () {
  'use strict';

  const state = {
    currentTheme: localStorage.getItem('theme') || 'dark',
    projects: [],
    categories: ['All'],
    currentCategory: 'All',
    searchQuery: '',
    currentPage: 1,
    perPage: 9
  };

  function escapeHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    state.currentTheme = theme;
    localStorage.setItem('theme', theme);
    const toggle = document.getElementById('theme-toggle');
    if (toggle) {
      const icon = toggle.querySelector('.theme-icon');
      if (icon) icon.textContent = theme === 'dark' ? '☀️' : '🌙';
      toggle.setAttribute('aria-checked', String(theme === 'dark'));
    }
  }

  function initTheme() {
    setTheme(state.currentTheme);
    const toggle = document.getElementById('theme-toggle');
    toggle?.addEventListener('click', () => {
      setTheme(state.currentTheme === 'dark' ? 'light' : 'dark');
    });
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d)) return dateStr;
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  }

  function buildCategoryTabs() {
    const tabs = document.getElementById('project-categories');
    if (!tabs) return;
    tabs.innerHTML = state.categories.map(cat => `
      <button type="button" class="blog-cat-btn${cat === state.currentCategory ? ' active' : ''}"
        data-cat="${escapeHtml(cat)}" role="tab"
        aria-selected="${cat === state.currentCategory}">${escapeHtml(cat)}</button>
    `).join('');

    tabs.querySelectorAll('.blog-cat-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        state.currentCategory = btn.dataset.cat;
        state.currentPage = 1;
        renderArchive();
      });
    });
  }

  function getFiltered() {
    const query = state.searchQuery.trim().toLowerCase();
    return state.projects.filter(p => {
      if (state.currentCategory !== 'All' && p.category !== state.currentCategory) return false;
      if (!query) return true;
      return [p.title, p.description, p.longDescription, (p.technologies || []).join(' '), p.category, p.role]
        .join(' ').toLowerCase().includes(query);
    });
  }

  function renderCard(project) {
    return `
      <article class="project-card hover-lift" data-category="${escapeHtml(project.category)}">
        <a href="projects.html?project=${encodeURIComponent(project.id)}" class="project-card-link">
          <div class="project-icon">
            ${project.image
              ? `<img src="${escapeHtml(project.image)}" alt="${escapeHtml(project.title)}" class="project-banner" loading="lazy" decoding="async" width="800" height="400">`
              : `<span class="project-emoji">${escapeHtml(project.icon || '🚀')}</span>`}
            ${project.featured ? `<span class="project-badge">Featured</span>` : ''}
            ${project.status === 'in-progress' ? `<span class="project-badge project-badge-wip">In Progress</span>` : ''}
          </div>
          <div class="project-content">
            <div class="project-meta">
              <span class="project-category">${escapeHtml(project.category)}</span>
              ${project.githubUrl ? `<span class="project-source">GitHub ↗</span>` : ''}
            </div>
            <h3 class="project-title">${escapeHtml(project.title)}</h3>
            <p class="project-description">${escapeHtml(project.description)}</p>
            <div class="project-tech">
              ${(project.technologies || []).slice(0, 6).map(t => `<span class="tech-tag">${escapeHtml(t)}</span>`).join('')}
            </div>
          </div>
        </a>
      </article>
    `;
  }

  function renderPagination(total) {
    const nav = document.getElementById('project-pagination');
    if (!nav) return;
    const pages = Math.max(1, Math.ceil(total / state.perPage));
    if (state.currentPage > pages) state.currentPage = pages;
    if (pages <= 1) {
      nav.innerHTML = '';
      return;
    }
    nav.innerHTML = `
      <button type="button" class="blog-page-btn" data-page="${state.currentPage - 1}" ${state.currentPage === 1 ? 'disabled' : ''}>← Prev</button>
      <span class="blog-page-info">Page ${state.currentPage} of ${pages}</span>
      <button type="button" class="blog-page-btn" data-page="${state.currentPage + 1}" ${state.currentPage === pages ? 'disabled' : ''}>Next →</button>
    `;
    nav.querySelectorAll('.blog-page-btn:not(:disabled)').forEach(btn => {
      btn.addEventListener('click', () => {
        state.currentPage = Number(btn.dataset.page);
        renderArchive();
      });
    });
  }

  function renderArchive() {
    const archive = document.getElementById('project-archive');
    const count = document.getElementById('project-count');
    if (!archive) return;

    const filtered = getFiltered();
    const total = filtered.length;
    if (count) count.textContent = total ? `${total} project${total === 1 ? '' : 's'}` : '';

    if (!total) {
      archive.innerHTML = '<p class="stats-fallback">No projects found.</p>';
      renderPagination(0);
      return;
    }

    const start = (state.currentPage - 1) * state.perPage;
    archive.innerHTML = filtered.slice(start, start + state.perPage).map(renderCard).join('');
    renderPagination(total);
  }

  async function loadArchive() {
    const archive = document.getElementById('project-archive');
    try {
      const response = await fetch('data/projects.json');
      const data = await response.json();
      state.projects = data.projects || [];
      const cats = [...new Set(state.projects.map(p => p.category))].sort();
      state.categories = ['All', ...cats];
      state.perPage = 9;
      buildCategoryTabs();

      const search = document.getElementById('project-search');
      let debounce;
      search?.addEventListener('input', () => {
        clearTimeout(debounce);
        debounce = setTimeout(() => {
          state.searchQuery = search.value;
          state.currentPage = 1;
          renderArchive();
        }, 200);
      });

      renderArchive();
    } catch (error) {
      console.error('Error loading projects:', error);
      if (archive) archive.innerHTML = '<p class="stats-fallback">Could not load projects.</p>';
    }
  }

  function renderDetail(project) {
    const detail = document.getElementById('project-detail');
    const archive = document.getElementById('project-archive');
    const titleEl = document.getElementById('project-title');
    const metaEl = document.getElementById('project-detail-meta');
    const linksEl = document.getElementById('project-detail-links');
    const contentEl = document.getElementById('project-content');
    const iconEl = document.getElementById('project-detail-icon');

    if (!detail || !titleEl || !metaEl || !linksEl || !contentEl) return;

    document.title = `${project.title} - Ashwani Kumar`;
    archive?.setAttribute('hidden', '');
    document.getElementById('project-categories')?.setAttribute('hidden', '');
    document.getElementById('project-search')?.setAttribute('hidden', '');
    document.getElementById('project-pagination')?.setAttribute('hidden', '');
    detail.removeAttribute('hidden');

    titleEl.textContent = project.title;

    const dateStr = [project.startDate, project.endDate].filter(Boolean).join(' → ');
    metaEl.innerHTML = `
      <span class="project-category">${escapeHtml(project.category)}</span>
      ${project.status === 'in-progress' ? '<span class="project-badge project-badge-wip">In Progress</span>' : ''}
      ${project.role ? `<span>· ${escapeHtml(project.role)}</span>` : ''}
      ${project.teamSize ? `<span>· ${project.teamSize} developer${project.teamSize > 1 ? 's' : ''}</span>` : ''}
      ${dateStr ? `<span>· ${escapeHtml(dateStr)}</span>` : ''}
    `;

    const links = [];
    if (project.liveUrl) links.push(`<a href="${escapeHtml(project.liveUrl)}" class="btn btn-primary btn-sm" target="_blank" rel="noopener">Live Demo ↗</a>`);
    if (project.githubUrl) links.push(`<a href="${escapeHtml(project.githubUrl)}" class="btn btn-outline btn-sm" target="_blank" rel="noopener">GitHub ↗</a>`);
    if (project.demoUrl) links.push(`<a href="${escapeHtml(project.demoUrl)}" class="btn btn-outline btn-sm" target="_blank" rel="noopener">Demo ↗</a>`);
    linksEl.innerHTML = links.join(' ');

    iconEl.innerHTML = project.image
      ? `<img src="${escapeHtml(project.image)}" alt="${escapeHtml(project.title)}" class="project-detail-image" loading="lazy" decoding="async">`
      : `<span class="project-emoji project-detail-emoji">${escapeHtml(project.icon || '🚀')}</span>`;

    const renderer = window.marked && window.marked.parse ? window.marked.parse.bind(window.marked) : (typeof window.marked === 'function' ? window.marked : null);
    let body = project.longDescription || '';

    const sections = [];
    if ((project.keyFeatures || []).length) {
      sections.push(`<h2>Key Features</h2><ul>${project.keyFeatures.map(f => `<li>${escapeHtml(f)}</li>`).join('')}</ul>`);
    }
    if ((project.challenges || []).length && (project.solutions || []).length) {
      const rows = project.challenges.map((c, i) => `
        <li><strong>${escapeHtml(c)}</strong>${project.solutions[i] ? `<br><span class="project-solution">${escapeHtml(project.solutions[i])}</span>` : ''}</li>`).join('');
      sections.push(`<h2>Challenges & Solutions</h2><ul class="project-challenges">${rows}</ul>`);
    }
    if (project.impact) {
      sections.push(`<h2>Impact</h2><blockquote>${escapeHtml(project.impact)}</blockquote>`);
    }
    if ((project.technologies || []).length) {
      sections.push(`<h2>Technologies</h2><div class="project-tech">${project.technologies.map(t => `<span class="tech-tag">${escapeHtml(t)}</span>`).join('')}</div>`);
    }

    contentEl.innerHTML = (renderer || fallbackMarked)(body) + sections.join('');
  }

  function fallbackMarked(content) {
    const esc = content.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<pre class="raw-markdown">${esc}</pre>`;
  }

  async function loadDetail(id) {
    const detail = document.getElementById('project-detail');
    const titleEl = document.getElementById('project-title');
    const metaEl = document.getElementById('project-detail-meta');
    const contentEl = document.getElementById('project-content');

    if (!detail || !titleEl || !metaEl || !contentEl) return;
    document.title = 'Project - Ashwani Kumar';

    try {
      const response = await fetch('data/projects.json');
      const data = await response.json();
      const project = (data.projects || []).find(p => p.id === id || p.slug === id);
      if (!project) throw new Error('not found');
      renderDetail(project);
    } catch (error) {
      console.error('Error loading project:', error);
      document.getElementById('project-categories')?.setAttribute('hidden', '');
      document.getElementById('project-search')?.setAttribute('hidden', '');
      titleEl.textContent = 'Project not found';
      metaEl.textContent = '';
      contentEl.innerHTML = '<p class="stats-fallback">This project does not exist. <a href="projects.html">View all projects</a>.</p>';
    }
  }

  function init() {
    initTheme();

    const params = new URLSearchParams(window.location.search);
    const id = params.get('project');

    if (id) {
      loadDetail(id);
    } else {
      loadArchive();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
