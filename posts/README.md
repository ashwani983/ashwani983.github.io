# Blog posts

This is the native blog for the portfolio. Each post is a single Markdown file organized into category folders under `posts/`.

## Folder structure

| Folder | Category | Examples |
| ------ | -------- | -------- |
| `posts/developer/` | Developer | Python, Django, Git & GitHub |
| `posts/tester/` | Tester | Selenium, API testing, frameworks |
| `posts/devops/` | DevOps | Ansible, Terraform, networking |
| `posts/others/` | Others | Anything that doesn't fit above |

The subfolder determines the post's category (shown on the archive tabs). Want a new category? Just create a new subfolder, e.g. `posts/cloud/`.

## How to publish a post

1. Create a new file in the right category folder: `posts/<category>/YYYY-MM-DD-<slug>.md`
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

## Migrating from WordPress

Script and notes for importing old posts from `atlcodify.wordpress.com` live in
`/data/user/0/com.foxdebug.acodefree/cache/opencode/migrate-wp.js`
(turndown + jsdom are required; run from that folder). New posts are written natively here.
