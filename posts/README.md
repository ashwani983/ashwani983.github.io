# Blog posts

This is the native blog for the portfolio. Each post is a single Markdown file in this folder.

## How to publish a post

1. Create a new file: `posts/YYYY-MM-DD-<slug>.md`
2. Copy the front matter below and fill it in.
3. Commit and push. A GitHub Action regenerates `data/blog-posts.json` automatically.

```markdown
---
title: Your Post Title
date: 2026-08-04
slug: your-post-title
tags: [DevOps, AWS, Kubernetes]
category: DevOps
excerpt: One or two sentences shown on the blog cards and archive.
readTime: 5 min read
published: true
---

Your post content in Markdown here.
```

## Rules

- Filename date must match the `date:` in front matter.
- `slug` becomes the URL: `https://ashwani983.github.io/blog.html?post=<slug>`
- Set `published: false` to save a draft (hidden from the site).
- To regenerate the index locally instead of waiting for the action:
  `node scripts/generate-blog-index.js`
