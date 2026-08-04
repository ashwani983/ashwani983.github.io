(function () {
  'use strict';

  const blogState = {
    currentTheme: localStorage.getItem('theme') || 'dark'
  };

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

  function renderArchive(posts) {
    const archive = document.getElementById('blog-archive');
    if (!archive) return;

    const published = posts.filter(p => p.published !== false);
    if (!published.length) {
      archive.innerHTML = '<p class="stats-fallback">No posts yet. Check back soon.</p>';
      return;
    }

    archive.innerHTML = published.map(post => `
      <article class="blog-archive-card hover-lift">
        <a href="${post.content}" class="blog-archive-link">
          <div class="blog-archive-date">
            <time datetime="${post.date}">${formatDate(post.date)}</time>
            <span class="blog-read-time">${post.readTime || '5 min read'}</span>
          </div>
          <h3 class="blog-archive-title">${post.title}</h3>
          <p class="blog-archive-excerpt">${post.excerpt}</p>
          <div class="blog-tags">
            ${(post.tags || []).map(tag => `<span class="blog-tag">${tag}</span>`).join('')}
          </div>
        </a>
      </article>
    `).join('');
  }

  async function loadArchive() {
    const archive = document.getElementById('blog-archive');
    try {
      const response = await fetch('data/blog-posts.json');
      const data = await response.json();
      renderArchive(data.posts || []);
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
