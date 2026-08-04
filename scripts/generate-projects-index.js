#!/usr/bin/env node
/**
 * Generates data/projects.json from the markdown files in /projects.
 *
 * Usage: node scripts/generate-projects-index.js
 *
 * Each project is a markdown file. Front matter (between --- lines):
 *   title, description, category, technologies (JSON array),
 *   featured (true/false), status, startDate, endDate, image, icon,
 *   liveUrl, githubUrl, demoUrl, teamSize, role,
 *   keyFeatures/challenges/solutions (JSON arrays), impact
 * The markdown body is the long description.
 */

const fs = require('fs');
const path = require('path');

const PROJECTS_DIR = path.join(__dirname, '..', 'projects');
const OUT_FILE = path.join(__dirname, '..', 'data', 'projects.json');

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
    if (value.startsWith('[') && value.endsWith(']')) {
      try { value = JSON.parse(value); } catch (e) { value = []; }
    } else if (/^-?\d+(\.\d+)?$/.test(value)) {
      value = Number(value);
    } else if (value === 'true' || value === 'false') {
      value = value === 'true';
    } else if (value === 'null') {
      value = null;
    }
    meta[key] = value;
  });

  return { meta, content };
}

function listMdFiles(dir, base) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = path.join(base, entry.name);
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...listMdFiles(abs, rel));
    } else if (entry.name.endsWith('.md')) {
      results.push(rel);
    }
  }
  return results;
}

function generate() {
  if (!fs.existsSync(PROJECTS_DIR)) {
    console.error(`Projects directory not found: ${PROJECTS_DIR}`);
    process.exit(1);
  }

  const projects = [];
  for (const file of listMdFiles(PROJECTS_DIR, '')) {
    const raw = fs.readFileSync(path.join(PROJECTS_DIR, file), 'utf8');
    const { meta, content } = parseFrontMatter(raw);

    if (!meta.title) {
      console.warn(`  skip  ${file} (missing front matter title)`);
      continue;
    }

    const id = meta.id || path.basename(file).replace(/\.md$/, '');
    const folder = path.dirname(file).split(path.sep)[0];

    projects.push({
      id,
      title: meta.title,
      description: meta.description || '',
      longDescription: content.trim(),
      technologies: meta.technologies || [],
      category: meta.category || (folder && folder !== '.' ? folder : 'Other'),
      featured: !!meta.featured,
      status: meta.status || 'completed',
      startDate: meta.startDate || null,
      endDate: meta.endDate || null,
      image: meta.image || null,
      images: meta.images || [],
      icon: meta.icon || '🚀',
      liveUrl: meta.liveUrl || null,
      githubUrl: meta.githubUrl || null,
      demoUrl: meta.demoUrl || null,
      keyFeatures: meta.keyFeatures || [],
      challenges: meta.challenges || [],
      solutions: meta.solutions || [],
      impact: meta.impact || '',
      teamSize: meta.teamSize || 1,
      role: meta.role || ''
    });
  }

  projects.sort((a, b) => {
    if (a.featured !== b.featured) return a.featured ? -1 : 1;
    return (b.startDate || '').localeCompare(a.startDate || '');
  });

  const categories = {};
  projects.forEach(p => {
    categories[p.category] = (categories[p.category] || 0) + 1;
  });

  const output = {
    projects,
    categories: Object.keys(categories).sort(),
    stats: {
      totalProjects: projects.length,
      categoriesCount: Object.keys(categories).length,
      featuredCount: projects.filter(p => p.featured).length,
      completedCount: projects.filter(p => p.status === 'completed').length,
      inProgressCount: projects.filter(p => p.status !== 'completed').length
    },
    generatedAt: new Date().toISOString()
  };

  fs.writeFileSync(OUT_FILE, JSON.stringify(output, null, 2) + '\n');
  console.log(`Generated ${OUT_FILE} with ${projects.length} project(s)`);
  for (const p of projects) {
    console.log(`  - ${p.category}  ${p.title}${p.featured ? '  [featured]' : ''}`);
  }
}

generate();
