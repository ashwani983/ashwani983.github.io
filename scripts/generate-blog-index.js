#!/usr/bin/env node
/**
 * Generates data/blog-posts.json from the markdown files in /posts.
 *
 * Usage: node scripts/generate-blog-index.js
 *
 * Front matter format (top of each post file, between --- lines):
 *   title, date (YYYY-MM-DD), slug, tags ([a, b]), category,
 *   excerpt, readTime, published (true/false)
 */

const fs = require('fs');
const path = require('path');

const POSTS_DIR = path.join(__dirname, '..', 'posts');
const OUT_FILE = path.join(__dirname, '..', 'data', 'blog-posts.json');

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

function generate() {
  if (!fs.existsSync(POSTS_DIR)) {
    console.error(`Posts directory not found: ${POSTS_DIR}`);
    process.exit(1);
  }

  const posts = [];
  for (const file of fs.readdirSync(POSTS_DIR)) {
    if (!file.endsWith('.md')) continue;
    const raw = fs.readFileSync(path.join(POSTS_DIR, file), 'utf8');
    const { meta, content } = parseFrontMatter(raw);

    if (!meta.title || !meta.date) {
      console.warn(`  skip  ${file} (missing front matter title/date)`);
      continue;
    }

    const slug = meta.slug || file.replace(/^\d{4}-\d{2}-\d{2}-/, '').replace(/\.md$/, '');
    const title = meta.title || slug;
    const date = meta.date || file.slice(0, 10);

    posts.push({
      id: slug,
      title,
      slug,
      file,
      date,
      excerpt: meta.excerpt || '',
      content: `blog.html?post=${encodeURIComponent(slug)}`,
      readTime: meta.readTime || '5 min read',
      tags: meta.tags || [],
      category: meta.category || 'General',
      image: meta.image || null,
      published: meta.published !== false,
      source: 'native',
      _wordCount: content.trim().split(/\s+/).length
    });
  }

  posts.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const output = {
    posts,
    categories: [],
    tags: [...new Set(posts.flatMap(p => p.tags))],
    stats: {
      totalPosts: posts.length,
      publishedPosts: posts.filter(p => p.published).length,
      draftPosts: posts.filter(p => !p.published).length,
      featuredPosts: posts.filter(p => p.published).length,
      totalViews: 0,
      totalLikes: 0,
      totalComments: 0,
      categoriesCount: new Set(posts.map(p => p.category)).size,
      tagsCount: new Set(posts.flatMap(p => p.tags)).size
    },
    settings: {
      postsPerPage: 6,
      enableComments: false,
      enableSocialSharing: true,
      enableSearch: true,
      enableTagFiltering: false,
      enableCategoryFiltering: false,
      defaultSortOrder: 'date-desc'
    },
    generatedAt: new Date().toISOString()
  };

  fs.writeFileSync(OUT_FILE, JSON.stringify(output, null, 2) + '\n');
  console.log(`Generated ${OUT_FILE} with ${posts.length} post(s)`);
  for (const p of posts) {
    console.log(`  - ${p.date}  ${p.title}${p.published ? '' : '  [draft]'}`);
  }
}

generate();
