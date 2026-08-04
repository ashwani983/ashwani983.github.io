(function () {
  'use strict';

  const blogState = {
    currentTheme: localStorage.getItem('theme') || 'dark',
    posts: [],
    categories: ['All'],
    currentCategory: 'All',
    searchQuery: '',
    currentPage: 1,
    perPage: 12
  };

  function escapeHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function setSectionTitleLevel(level) {
    const el = document.getElementById('blog-title');
    if (!el || el.tagName.toLowerCase() === level) return;
    const next = document.createElement(level);
    next.id = el.id;
    next.className = el.className;
    next.textContent = el.textContent;
    el.replaceWith(next);
  }

  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    blogState.currentTheme = theme;
    localStorage.setItem('theme', theme);
    const toggle = document.getElementById('theme-toggle');
    if (toggle) {
      const icon = toggle.querySelector('.theme-icon');
      if (icon) icon.textContent = theme === 'dark' ? '☀️' : '🌙';
      toggle.setAttribute('aria-checked', String(theme === 'dark'));
    }
  }

  function initTheme() {
    setTheme(blogState.currentTheme);
    const toggle = document.getElementById('theme-toggle');
    toggle?.addEventListener('click', () => {
      setTheme(blogState.currentTheme === 'dark' ? 'light' : 'dark');
    });
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d)) return dateStr;
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  function parseFrontMatter(raw) {
    const body = raw.replace(/^\uFEFF/, '');
    if (!body.startsWith('---')) return { meta: {}, content: body };

    const end = body.indexOf('\n---', 3);
    if (end === -1) return { meta: {}, content: body };

    const fm = body.slice(3, end);
    const content = body.slice(end + 4).replace(/^\n/, '');

    const meta = {};
    fm.split('\n').forEach(line => {
      const idx = line.indexOf(':');
      if (idx === -1) return;
      const key = line.slice(0, idx).trim();
      let value = line.slice(idx + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (key === 'tags') {
        value = value.replace(/^\[|\]$/g, '')
          .split(',')
          .map(t => t.trim())
          .filter(Boolean);
        meta[key] = value;
      } else if (value === 'true' || value === 'false') {
        meta[key] = value === 'true';
      } else {
        meta[key] = value;
      }
    });

    return { meta, content };
  }

  function renderCard(post) {
    return `
      <article class="blog-archive-card hover-lift">
        <a href="${escapeHtml(post.content)}" class="blog-archive-link">
          <div class="blog-archive-date">
            <time datetime="${escapeHtml(post.date)}">${escapeHtml(formatDate(post.date))}</time>
            <span class="blog-read-time">${escapeHtml(post.readTime || '5 min read')}</span>
          </div>
          <h3 class="blog-archive-title">${escapeHtml(post.title)}</h3>
          <p class="blog-archive-excerpt">${escapeHtml(post.excerpt)}</p>
          <div class="blog-tags">
            ${(post.tags || []).slice(0, 5).map(tag => `<span class="blog-tag">${escapeHtml(tag)}</span>`).join('')}
          </div>
        </a>
      </article>
    `;
  }

  function buildCategoryTabs() {
    const tabs = document.getElementById('blog-categories');
    if (!tabs) return;
    tabs.innerHTML = blogState.categories.map(cat => `
      <button type="button" class="blog-cat-btn${cat === blogState.currentCategory ? ' active' : ''}"
        data-cat="${escapeHtml(cat)}" role="tab"
        aria-selected="${cat === blogState.currentCategory}">${escapeHtml(cat)}</button>
    `).join('');

    tabs.querySelectorAll('.blog-cat-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        blogState.currentCategory = btn.dataset.cat;
        blogState.currentPage = 1;
        renderArchive();
      });
    });
  }

  function getFiltered() {
    const query = blogState.searchQuery.trim().toLowerCase();
    return blogState.posts.filter(p => {
      if (p.published === false) return false;
      if (blogState.currentCategory !== 'All' && (p.category || 'Others') !== blogState.currentCategory) return false;
      if (!query) return true;
      return [p.title, p.excerpt, (p.tags || []).join(' '), p.category]
        .join(' ').toLowerCase().includes(query);
    });
  }

  function renderPagination(total) {
    const nav = document.getElementById('blog-pagination');
    if (!nav) return;
    const pages = Math.max(1, Math.ceil(total / blogState.perPage));
    if (blogState.currentPage > pages) blogState.currentPage = pages;
    if (pages <= 1) {
      nav.innerHTML = '';
      return;
    }
    nav.innerHTML = `
      <button type="button" class="blog-page-btn" data-page="${blogState.currentPage - 1}" ${blogState.currentPage === 1 ? 'disabled' : ''}>← Prev</button>
      <span class="blog-page-info">Page ${blogState.currentPage} of ${pages}</span>
      <button type="button" class="blog-page-btn" data-page="${blogState.currentPage + 1}" ${blogState.currentPage === pages ? 'disabled' : ''}>Next →</button>
    `;
    nav.querySelectorAll('.blog-page-btn:not(:disabled)').forEach(btn => {
      btn.addEventListener('click', () => {
        blogState.currentPage = Number(btn.dataset.page);
        renderArchive();
      });
    });
  }

  function renderArchive() {
    const archive = document.getElementById('blog-archive');
    const count = document.getElementById('blog-count');
    if (!archive) return;

    const filtered = getFiltered();
    const total = filtered.length;
    if (count) count.textContent = total ? `${total} post${total === 1 ? '' : 's'}` : '';

    if (!total) {
      archive.innerHTML = '<p class="stats-fallback">No posts found. Check back soon.</p>';
      renderPagination(0);
      return;
    }

    const start = (blogState.currentPage - 1) * blogState.perPage;
    const pagePosts = filtered.slice(start, start + blogState.perPage);
    archive.innerHTML = pagePosts.map(renderCard).join('');
    renderPagination(total);
  }

  async function loadArchive() {
    const archive = document.getElementById('blog-archive');
    setSectionTitleLevel('h1');
    try {
      const response = await fetch('data/blog-posts.json');
      const data = await response.json();
      blogState.posts = data.posts || [];
      const cats = [...new Set(blogState.posts
        .filter(p => p.published !== false)
        .map(p => p.category || 'Others'))].sort();
      blogState.categories = ['All', ...cats];
      blogState.perPage = (data.settings && data.settings.postsPerPage) || 12;
      buildCategoryTabs();

      const search = document.getElementById('blog-search');
      let debounce;
      search?.addEventListener('input', () => {
        clearTimeout(debounce);
        debounce = setTimeout(() => {
          blogState.searchQuery = search.value;
          blogState.currentPage = 1;
          renderArchive();
        }, 200);
      });

      renderArchive();
    } catch (error) {
      console.error('Error loading blog posts:', error);
      if (archive) archive.innerHTML = '<p class="stats-fallback">Could not load posts.</p>';
    }
  }

  async function loadPost(slug) {
    const postEl = document.getElementById('blog-post');
    const archive = document.getElementById('blog-archive');
    const titleEl = document.getElementById('post-title');
    const metaEl = document.getElementById('post-meta');
    const contentEl = document.getElementById('post-content');

    if (!postEl || !titleEl || !metaEl || !contentEl) return;

    setSectionTitleLevel('h2');
    document.title = 'Post - Ashwani Kumar';
    archive?.setAttribute('hidden', '');
    postEl.removeAttribute('hidden');

    try {
      const indexResponse = await fetch('data/blog-posts.json');
      const indexData = await indexResponse.json();
      const post = (indexData.posts || []).find(p => p.slug === slug);
      const file = post && post.file ? post.file : `${slug}.md`;

      const response = await fetch(`posts/${file}`);
      if (!response.ok) throw new Error('not found');
      const raw = await response.text();
      const { meta, content } = parseFrontMatter(raw);

      titleEl.textContent = meta.title || slug;
      metaEl.innerHTML = `
        <time datetime="${meta.date || ''}">${formatDate(meta.date)}</time>
        <span>·</span>
        <span>${meta.readTime || '5 min read'}</span>
        <span>·</span>
        <span>${(meta.tags || []).join(', ')}</span>
      `;
      const renderer = window.marked && window.marked.parse ? window.marked.parse.bind(window.marked) : (typeof window.marked === 'function' ? window.marked : null);
      contentEl.innerHTML = (renderer || fallbackMarked)(content);

      const firstH1 = contentEl.querySelector('h1');
      if (firstH1 && firstH1.textContent.trim() === (meta.title || '').trim()) {
        firstH1.remove();
      }

      document.title = `${meta.title || slug} - Ashwani Kumar`;
      const subtitle = document.getElementById('blog-subtitle');
      if (subtitle) subtitle.textContent = 'Notes on DevOps, cloud engineering, and learning in public';
    } catch (error) {
      console.error('Error loading post:', error);
      titleEl.textContent = 'Post not found';
      metaEl.textContent = '';
      contentEl.innerHTML = '<p class="stats-fallback">This post does not exist. <a href="blog.html">View all posts</a>.</p>';
    }
  }

  function fallbackMarked(content) {
    const esc = content.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<pre class="raw-markdown">${esc}</pre>`;
  }

  function init() {
    initTheme();

    const params = new URLSearchParams(window.location.search);
    const slug = params.get('post');

    if (slug) {
      loadPost(slug);
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
