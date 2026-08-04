# Projects

Each project is a single Markdown file in this folder. The full project listing lives at
`https://ashwani983.github.io/projects.html` with category filters, search, and pagination.

## How to add a project

1. Create a new file: `projects/<project-id>.md`
2. Copy the front matter below and fill it in. The body is the long description.
3. Commit and push. A GitHub Action regenerates `data/projects.json` automatically.

```markdown
---
title: My Project
description: One-liner shown on cards.
category: AI/ML
technologies: ["Python", "Flask"]
featured: false
status: completed
startDate: "2026-01-01"
endDate: "2026-03-01"
image: null
icon: 🚀
liveUrl: null
githubUrl: https://github.com/ashwani983/my-project
demoUrl: null
teamSize: 1
role: Developer
keyFeatures: ["Feature one", "Feature two"]
challenges: ["Problem one"]
solutions: ["How it was solved"]
impact: "What it achieved."
---

Long description in Markdown here.
```

## Rules

- `category` drives the filter tabs on `projects.html`.
- `featured: true` sorts the project first and shows a badge.
- `status: completed` or `in-progress` (shows a badge).
- Set `image` to `assets/images/projects/<name>.svg` or leave `null` to show the `icon` emoji.
- To regenerate the index locally: `node scripts/generate-projects-index.js`
