// Main JavaScript File - Portfolio Website
// Author: Ashwani Kumar
// Description: Core functionality for the portfolio website

// Site Configuration
const siteConfig = {
  siteName: "Ashwani Kumar - System Developer Engineer",
  siteUrl: "https://ashwani983.github.io",
  author: "Ashwani Kumar",
  email: "ashwanig983@gmail.com",
  social: {
    github: "ashwani983",
    linkedin: "ashwani-kumar-699788146",
    twitter: "ashwani_kumar"
  }
};

// DOM Elements
const elements = {
  themeToggle: document.getElementById('theme-toggle'),
  typewriter: document.getElementById('typewriter'),
  skillsGrid: document.getElementById('skills-grid'),
  featuredProjectsGrid: document.getElementById('featured-projects-grid'),
  projectFilters: document.getElementById('project-filters'),
  githubStatsGrid: document.getElementById('github-stats-grid'),
  blogGrid: document.getElementById('blog-grid'),
  timeline: document.getElementById('timeline')
};

// State Management
const state = {
  currentTheme: localStorage.getItem('theme') || 'dark',
  isLoading: true,
  typewriterIndex: 0,
  typewriterText: ['Ashwani Kumar', 'System Developer', 'DevOps Engineer', 'Cloud Specialist']
};

// Utility Functions
const utils = {
  // Debounce function for performance optimization
  debounce: (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  // Throttle function for scroll events
  throttle: (func, limit) => {
    let inThrottle;
    return function() {
      const args = arguments;
      const context = this;
      if (!inThrottle) {
        func.apply(context, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  },

  // Check if element is in viewport
  isInViewport: (element) => {
    const rect = element.getBoundingClientRect();
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
  },

  // Animate counter numbers
  animateCounter: (element, target, duration = 2000) => {
    const start = 0;
    const increment = target / (duration / 16);
    let current = start;
    
    const timer = setInterval(() => {
      current += increment;
      element.textContent = Math.floor(current);
      
      if (current >= target) {
        element.textContent = target;
        clearInterval(timer);
      }
    }, 16);
  },

  // Format date
  formatDate: (dateString) => {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  },

  // Calculate reading time
  calculateReadingTime: (text) => {
    const wordsPerMinute = 200;
    const words = text.trim().split(/\s+/).length;
    const time = Math.ceil(words / wordsPerMinute);
    return `${time} min read`;
  }
};

// Theme Management
const themeManager = {
  init: () => {
    themeManager.setTheme(state.currentTheme);
    elements.themeToggle?.addEventListener('click', themeManager.toggle);
  },

  setTheme: (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    state.currentTheme = theme;
    localStorage.setItem('theme', theme);
    
    if (elements.themeToggle) {
      const isDark = theme === 'dark';
      const icon = elements.themeToggle.querySelector('.theme-icon');
      if (icon) {
        icon.textContent = isDark ? '☀️' : '🌙';
      }
      elements.themeToggle.setAttribute('aria-checked', String(isDark));
    }
  },

  toggle: () => {
    const newTheme = state.currentTheme === 'dark' ? 'light' : 'dark';
    themeManager.setTheme(newTheme);
  }
};

// Typewriter Effect
const typewriterEffect = {
  init: () => {
    if (elements.typewriter) {
      typewriterEffect.start();
    }
  },

  start: () => {
    let textIndex = 0;
    let charIndex = 0;
    let isDeleting = false;
    
    const type = () => {
      const currentText = state.typewriterText[textIndex];
      
      if (isDeleting) {
        elements.typewriter.textContent = currentText.substring(0, charIndex - 1);
        charIndex--;
      } else {
        elements.typewriter.textContent = currentText.substring(0, charIndex + 1);
        charIndex++;
      }
      
      let typeSpeed = isDeleting ? 50 : 100;
      
      if (!isDeleting && charIndex === currentText.length) {
        typeSpeed = 2000; // Pause at end
        isDeleting = true;
      } else if (isDeleting && charIndex === 0) {
        isDeleting = false;
        textIndex = (textIndex + 1) % state.typewriterText.length;
        typeSpeed = 500; // Pause before next word
      }
      
      setTimeout(type, typeSpeed);
    };
    
    type();
  }
};

// Counter Animation
const counterAnimation = {
  init: () => {
    const counters = document.querySelectorAll('.stat-number');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const target = parseInt(entry.target.getAttribute('data-target'));
          utils.animateCounter(entry.target, target);
          observer.unobserve(entry.target);
        }
      });
    });
    
    counters.forEach(counter => observer.observe(counter));
  }
};

// Scroll Reveal Animation
const scrollReveal = {
  init: () => {
    const elements = document.querySelectorAll('.scroll-reveal, .animate-on-scroll');
    
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed', 'animate');
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    });
    
    elements.forEach(element => observer.observe(element));
  }
};

// Data Loading and Rendering
const dataManager = {
  projectData: [],
  activeProjectFilter: 'All',
  visibleProjectCount: 6,

  loadMoreProjects() {
    const filtered = dataManager.activeProjectFilter === 'All'
      ? dataManager.projectData
      : dataManager.projectData.filter(p => p.category === dataManager.activeProjectFilter);
    if (dataManager.visibleProjectCount >= filtered.length) {
      dataManager.visibleProjectCount = 6;
    } else {
      dataManager.visibleProjectCount += 6;
    }
    dataManager.renderProjects();
  },

  async loadSkills() {
    try {
      const response = await fetch('data/skills.json');
      const data = await response.json();
      dataManager.renderSkills(data.skills);
    } catch (error) {
      console.error('Error loading skills:', error);
      dataManager.renderSkillsPlaceholder();
    }
  },

  async loadExperience() {
    try {
      const response = await fetch('data/experience.json');
      const data = await response.json();
      dataManager.renderExperience(data.experience);
    } catch (error) {
      console.error('Error loading experience:', error);
    }
  },

  renderExperience(experience) {
    if (!elements.timeline) return;

    elements.timeline.innerHTML = experience.map(item => {
      const dateLabel = item.current
        ? `${item.startDate} — Present`
        : `${item.startDate} — ${item.endDate || 'Present'}`;
      const companyLink = item.companyUrl && item.companyUrl !== '#'
        ? `<a href="${item.companyUrl}" class="timeline-company" target="_blank" rel="noopener">${item.company}</a>`
        : `<span class="timeline-company">${item.company}</span>`;

      return `
        <div class="timeline-item">
          <div class="timeline-marker" aria-hidden="true"></div>
          <div class="timeline-card">
            ${item.logo ? `
              <div class="timeline-logo">
                <img src="${item.logo}" alt="${item.company} logo" loading="lazy" decoding="async">
              </div>
            ` : ''}
            <div class="timeline-meta">
              ${companyLink}
              <span class="timeline-date">${dateLabel}</span>
            </div>
            <h3 class="timeline-role">${item.role}</h3>
            <p class="timeline-location">${item.location || ''}</p>
            <p class="timeline-summary">${item.summary || ''}</p>
            ${item.highlights && item.highlights.length ? `
              <ul class="timeline-highlights">
                ${item.highlights.slice(0, 4).map(h => `<li>${h}</li>`).join('')}
              </ul>
            ` : ''}
            ${item.technologies && item.technologies.length ? `
              <div class="timeline-tech">
                ${item.technologies.slice(0, 6).map(t => `<span class="tech-tag">${t}</span>`).join('')}
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');
  },

  async loadProjects() {
    try {
      const response = await fetch('data/projects.json');
      const data = await response.json();
      dataManager.projectData = [...data.projects].sort((a, b) => {
        if (a.featured !== b.featured) return a.featured ? -1 : 1;
        return (b.startDate || '').localeCompare(a.startDate || '');
      });
      dataManager.activeProjectFilter = 'All';
      dataManager.visibleProjectCount = 6;
      dataManager.renderProjects();
      dataManager.renderProjectFilters(dataManager.projectData);
    } catch (error) {
      console.error('Error loading projects:', error);
      dataManager.renderProjectsPlaceholder();
    }
  },

  renderProjects() {
    if (!elements.featuredProjectsGrid) return;

    const filtered = dataManager.activeProjectFilter === 'All'
      ? dataManager.projectData
      : dataManager.projectData.filter(p => p.category === dataManager.activeProjectFilter);
    const visible = filtered.slice(0, dataManager.visibleProjectCount);

    elements.featuredProjectsGrid.innerHTML = visible.map(project => `
      <article class="project-card hover-lift" data-category="${project.category}">
        <div class="project-icon">
          ${project.image
            ? `<img src="${project.image}" alt="${project.title}" class="project-banner" loading="lazy" decoding="async" width="800" height="400">`
            : `<span class="project-emoji">${project.icon || '🚀'}</span>`}
          ${project.featured ? `<span class="project-badge">Featured</span>` : ''}
        </div>
        <div class="project-content">
          <div class="project-meta">
            <span class="project-category">${project.category}</span>
            ${project.githubUrl ? `<a href="${project.githubUrl}" class="project-source" target="_blank" rel="noopener">GitHub ↗</a>` : ''}
          </div>
          <h3 class="project-title">${project.title}</h3>
          <p class="project-description">${project.description}</p>
          <div class="project-tech">
            ${project.technologies.map(tech => `<span class="tech-tag">${tech}</span>`).join('')}
          </div>
          <div class="project-links">
            ${project.liveUrl ? `<a href="${project.liveUrl}" class="project-link" target="_blank" rel="noopener">Live Demo</a>` : ''}
            ${project.githubUrl ? `<a href="${project.githubUrl}" class="project-link" target="_blank" rel="noopener">GitHub</a>` : ''}
          </div>
        </div>
      </article>
    `).join('');

    const loadMoreBtn = document.getElementById('projects-load-more');
    if (loadMoreBtn) {
      const remaining = filtered.length - visible.length;
      const paginated = filtered.length > 6;
      loadMoreBtn.style.display = remaining > 0 || paginated ? '' : 'none';
      loadMoreBtn.textContent = remaining > 0 ? `Load More (${remaining} more)` : 'Show Less';
      loadMoreBtn.classList.toggle('collapsed', remaining === 0 && paginated);
    }
  },

  renderProjectFilters(projects) {
    if (!elements.projectFilters) return;

    const counts = projects.reduce((acc, p) => {
      acc[p.category] = (acc[p.category] || 0) + 1;
      return acc;
    }, {});
    const categories = ['All', ...Object.keys(counts)];

    elements.projectFilters.innerHTML = categories.map(cat => `
      <button type="button" class="filter-btn${cat === 'All' ? ' active' : ''}" data-filter="${cat}">
        ${cat}${cat !== 'All' ? `<span class="filter-count">${counts[cat]}</span>` : ''}
      </button>
    `).join('');

    elements.projectFilters.addEventListener('click', (e) => {
      const btn = e.target.closest('.filter-btn');
      if (!btn) return;
      elements.projectFilters.querySelectorAll('.filter-btn').forEach(b => b.classList.toggle('active', b === btn));
      dataManager.activeProjectFilter = btn.dataset.filter;
      dataManager.visibleProjectCount = 6;
      dataManager.renderProjects();
    });
  },

  async loadBlogPosts() {
    try {
      const response = await fetch('data/blog-posts.json');
      const data = await response.json();
      const recentPosts = data.posts.filter(post => post.published).slice(0, 3);
      dataManager.renderBlogPosts(recentPosts);
    } catch (error) {
      console.error('Error loading blog posts:', error);
      dataManager.renderBlogPlaceholder();
    }
  },

  renderSkills(skills) {
    if (!elements.skillsGrid) return;

    const categoryOrder = [
      'DevOps', 'AI/ML', 'Cloud', 'Programming', 'CI/CD', 'Testing',
      'Operating Systems', 'Infrastructure', 'Version Control', 'Database'
    ];

    const grouped = skills.reduce((acc, skill) => {
      const key = skill.category || 'Other';
      (acc[key] = acc[key] || []).push(skill);
      return acc;
    }, {});

    elements.skillsGrid.innerHTML = Object.entries(grouped)
      .sort((a, b) => {
        const ia = categoryOrder.indexOf(a[0]);
        const ib = categoryOrder.indexOf(b[0]);
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      })
      .map(([category, items]) => `
        <div class="skill-group">
          <h4 class="skill-category">${category}</h4>
          ${items.map(skill => `
            <div class="skill-bar">
              <div class="skill-bar-header">
                <span class="skill-bar-name">${skill.logo
                  ? `<img src="assets/icons/${skill.logo}" alt="${skill.name}" class="skill-logo" loading="lazy" decoding="async">`
                  : `<span class="skill-emoji">${skill.icon || ''}</span>`} ${skill.name}</span>
                <span class="skill-bar-level">${skill.level || 0}%</span>
              </div>
              <div class="skill-bar-track">
                <div class="skill-progress" style="--skill-level: ${skill.level || 0}%"></div>
              </div>
            </div>
          `).join('')}
        </div>
      `).join('');

    window.animationUtils?.observeProgressBars?.();
  },

  renderBlogPosts(posts) {
    if (!elements.blogGrid) return;
    
    elements.blogGrid.innerHTML = posts.map(post => `
      <a href="${post.content || 'blog.html'}" class="blog-card hover-lift" target="_blank" rel="noopener">
        <div class="blog-image">
          ${post.image ? `<img src="${post.image}" alt="${post.title}" loading="lazy" decoding="async" width="400" height="150">` : '📝 Blog Post'}
        </div>
        <div class="blog-content">
          <div class="blog-meta">
            <span class="blog-date">${utils.formatDate(post.date)}</span>
            <span class="blog-read-time">${post.readTime}</span>
          </div>
          <h3 class="blog-title">${post.title}</h3>
          <p class="blog-excerpt">${post.excerpt}</p>
          <div class="blog-tags">
            ${post.tags.map(tag => `<span class="blog-tag">${tag}</span>`).join('')}
          </div>
        </div>
      </a>
    `).join('');
  },

  renderSkillsPlaceholder() {
    if (!elements.skillsGrid) return;
    
    const placeholderSkills = [
      { icon: '🐳', name: 'Docker', category: 'DevOps', level: 90 },
      { icon: '☸️', name: 'Kubernetes', category: 'DevOps', level: 85 },
      { icon: '🔧', name: 'Jenkins', category: 'CI/CD', level: 88 },
      { icon: '🐧', name: 'Linux', category: 'Operating Systems', level: 92 },
      { icon: '☁️', name: 'AWS', category: 'Cloud', level: 87 },
      { icon: '🐍', name: 'Python', category: 'Programming', level: 85 }
    ];
    
    dataManager.renderSkills(placeholderSkills);
  },

  renderProjectsPlaceholder() {
    if (!elements.featuredProjectsGrid) return;
    
    const placeholderProjects = [
      {
        title: 'DevOps Pipeline Automation',
        description: 'Automated CI/CD pipeline using Jenkins, Docker, and Kubernetes for seamless deployment.',
        technologies: ['Jenkins', 'Docker', 'Kubernetes', 'AWS'],
        image: null,
        liveUrl: null,
        githubUrl: '#'
      },
      {
        title: 'Cloud Infrastructure Management',
        description: 'Infrastructure as Code using Terraform and Ansible for scalable cloud deployments.',
        technologies: ['Terraform', 'Ansible', 'AWS', 'Python'],
        image: null,
        liveUrl: null,
        githubUrl: '#'
      },
      {
        title: 'Test Automation Framework',
        description: 'Comprehensive test automation framework using Selenium and Robot Framework.',
        technologies: ['Selenium', 'Robot Framework', 'Python', 'TestNG'],
        image: null,
        liveUrl: null,
        githubUrl: '#'
      }
    ];
    
    dataManager.renderProjects(placeholderProjects);
  },

  renderBlogPlaceholder() {
    if (!elements.blogGrid) return;
    
    const placeholderPosts = [
      {
        title: 'Getting Started with DevOps',
        excerpt: 'A comprehensive guide to understanding DevOps principles and best practices.',
        date: '2024-01-15',
        readTime: '5 min read',
        tags: ['DevOps', 'Tutorial'],
        image: null
      },
      {
        title: 'Docker Best Practices',
        excerpt: 'Essential Docker practices for building efficient and secure containers.',
        date: '2024-01-10',
        readTime: '7 min read',
        tags: ['Docker', 'Containers'],
        image: null
      },
      {
        title: 'AWS Cloud Security',
        excerpt: 'Key security considerations when deploying applications on AWS cloud.',
        date: '2024-01-05',
        readTime: '6 min read',
        tags: ['AWS', 'Security'],
        image: null
      }
    ];
    
    dataManager.renderBlogPosts(placeholderPosts);
  }
};

// Performance Optimization
const performanceOptimizer = {
  init: () => {
    performanceOptimizer.lazyLoadImages();
    performanceOptimizer.preloadCriticalResources();
  },

  lazyLoadImages: () => {
    const images = document.querySelectorAll('img[data-src]');
    
    const imageObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          img.src = img.dataset.src;
          img.classList.remove('lazy');
          imageObserver.unobserve(img);
        }
      });
    });
    
    images.forEach(img => imageObserver.observe(img));
  },

  preloadCriticalResources: () => {
    const criticalResources = [
      'data/skills.json',
      'data/experience.json',
      'data/projects.json',
      'data/blog-posts.json'
    ];
    
    criticalResources.forEach(resource => {
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = resource;
      document.head.appendChild(link);
    });
  }
};

// Error Handling
const errorHandler = {
  init: () => {
    window.addEventListener('error', errorHandler.handleError);
    window.addEventListener('unhandledrejection', errorHandler.handlePromiseRejection);
  },

  handleError: (event) => {
    console.error('JavaScript Error:', event.error);
    // Could send to analytics or error reporting service
  },

  handlePromiseRejection: (event) => {
    console.error('Unhandled Promise Rejection:', event.reason);
    // Could send to analytics or error reporting service
  }
};

// Horizontal Carousel
const carousel = {
  init() {
    document.querySelectorAll('.carousel').forEach(wrap => {
      const viewport = wrap.querySelector('.carousel-viewport') || wrap.querySelector('[data-carousel]');
      const prev = wrap.querySelector('.carousel-prev');
      const next = wrap.querySelector('.carousel-next');
      if (!viewport) return;

      const step = () => {
        const card = viewport.querySelector(':scope > *');
        const gap = parseFloat(getComputedStyle(viewport).columnGap) || 0;
        return card ? card.getBoundingClientRect().width + gap : Math.round(viewport.clientWidth * 0.8);
      };

      const scrollBy = (dir) => viewport.scrollBy({ left: dir * step(), behavior: 'smooth' });
      prev?.addEventListener('click', () => scrollBy(-1));
      next?.addEventListener('click', () => scrollBy(1));

      let isDown = false;
      let startX = 0;
      let startScroll = 0;
      viewport.addEventListener('pointerdown', (e) => {
        if (e.pointerType !== 'mouse') return;
        isDown = true;
        startX = e.pageX;
        startScroll = viewport.scrollLeft;
        viewport.classList.add('dragging');
      });
      viewport.addEventListener('pointermove', (e) => {
        if (!isDown || e.pointerType !== 'mouse') return;
        e.preventDefault();
        viewport.scrollLeft = startScroll - (e.pageX - startX);
      });
      ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev =>
        viewport.addEventListener(ev, () => {
          isDown = false;
          viewport.classList.remove('dragging');
        })
      );

      const updateArrows = () => {
        const max = viewport.scrollWidth - viewport.clientWidth;
        prev.style.opacity = viewport.scrollLeft <= 2 ? 0.25 : 1;
        next.style.opacity = viewport.scrollLeft >= max - 2 ? 0.25 : 1;
      };
      viewport.addEventListener('scroll', updateArrows, { passive: true });
      window.addEventListener('resize', updateArrows);
      updateArrows();
    });
  }
};

// GitHub Contribution Calendar (rendered natively, theme-aware)
const contributionCalendar = {
  username: 'ashwani983',

  async init() {
    const container = document.getElementById('contribution-calendar');
    if (!container) return;

    const html = await contributionCalendar.fetchContributions();
    if (html) {
      try {
        const data = contributionCalendar.parse(html);
        if (data && data.days.length) {
          container.innerHTML = contributionCalendar.render(data);
          return;
        }
      } catch (e) {
        console.error('Error parsing contributions:', e);
      }
    }

    container.innerHTML = contributionCalendar.renderImageFallback();
  },

  async fetchContributions() {
    const url = `https://github.com/users/${contributionCalendar.username}/contributions`;
    const sources = [
      url,
      `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
      `https://corsproxy.io/?url=${encodeURIComponent(url)}`
    ];
    for (const src of sources) {
      try {
        const res = await fetch(src, { signal: AbortSignal.timeout(15000) });
        if (!res.ok) continue;
        const text = await res.text();
        if (text.includes('contribution-day-component')) return text;
      } catch (e) {
        // try next source
      }
    }
    return null;
  },

  parse(html) {
    const totalMatch = html.match(/([\d,]+)\s+contributions\s+in the last year/);
    const total = totalMatch ? parseInt(totalMatch[1].replace(/,/g, ''), 10) : null;

    const days = [...html.matchAll(/<td[^>]*data-date="([^"]+)"[^>]*id="contribution-day-component-(\d)-(\d+)"[^>]*data-level="([0-9])"[^>]*>/g)]
      .map(m => ({ date: m[1], row: +m[2], col: +m[3], level: +m[4] }));

    const counts = new Map();
    for (const m of html.matchAll(/for="contribution-day-component-(\d)-(\d+)"[^>]*>\s*([\d,]+)\s+contributions?/g)) {
      counts.set(`${m[1]}-${m[2]}`, parseInt(m[3].replace(/,/g, ''), 10));
    }
    for (const m of html.matchAll(/for="contribution-day-component-(\d)-(\d+)"[^>]*>\s*No contributions/g)) {
      counts.set(`${m[1]}-${m[2]}`, 0);
    }

    const weekdays = [
      { row: 0, label: 'Sun' },
      { row: 1, label: 'Mon' },
      { row: 3, label: 'Wed' },
      { row: 5, label: 'Fri' }
    ];

    return {
      total,
      days: days.map(d => ({ ...d, count: counts.get(`${d.row}-${d.col}`) ?? 0 })),
      weekdays,
      cols: days.length ? Math.max(...days.map(d => d.col)) + 1 : 0
    };
  },

  render(data) {
    const months = [];
    for (const d of data.days) {
      const key = d.date.slice(0, 7);
      const month = months.find(m => m.key === key);
      if (month) {
        month.end = Math.max(month.end, d.col);
      } else {
        months.push({ key, start: d.col, end: d.col, name: new Date(d.date + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }) });
      }
    }
    if (months.length > 1 && months[months.length - 1].end === months[months.length - 1].start) {
      months.pop();
    }
    const monthSpans = months.map((m, i) => {
      const span = Math.max(1, ((months[i + 1] ? months[i + 1].start : data.cols) - m.start));
      return { name: m.name, start: m.start, span };
    });

    const monthLabels = monthSpans.map(m =>
      `<span class="cal-month" style="grid-column: ${m.start + 2} / span ${m.span}">${m.name}</span>`
    ).join('');

    const weekdayLabels = data.weekdays.map(w =>
      `<span class="cal-weekday" style="grid-row: ${w.row + 3}">${w.label}</span>`
    ).join('');

    const dayCells = data.days.map(d => {
      const pretty = new Date(d.date + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
      const label = d.count === 0 ? `No contributions on ${pretty}` : `${d.count} contribution${d.count === 1 ? '' : 's'} on ${pretty}`;
      return `<span class="cal-day cal-l${d.level}" style="grid-column: ${d.col + 2}; grid-row: ${d.row + 3}" role="img" aria-label="${label}" title="${label}" data-date="${d.date}"></span>`;
    }).join('');

    const total = data.total === null
      ? `<a class="cal-total" href="https://github.com/${contributionCalendar.username}" target="_blank" rel="noopener">View GitHub profile →</a>`
      : `<a class="cal-total" href="https://github.com/${contributionCalendar.username}" target="_blank" rel="noopener"><strong>${data.total.toLocaleString()}</strong> contributions in the last year</a>`;

    return `
      <div class="cal-head">${total}</div>
      <div class="cal-scroll">
        <div class="cal-grid" style="--cols: ${data.cols}">
          ${monthLabels}
          ${weekdayLabels}
          ${dayCells}
        </div>
      </div>
      <div class="cal-legend">
        <span class="cal-legend-label">Less</span>
        <span class="cal-day cal-l0" aria-hidden="true"></span>
        <span class="cal-day cal-l1" aria-hidden="true"></span>
        <span class="cal-day cal-l2" aria-hidden="true"></span>
        <span class="cal-day cal-l3" aria-hidden="true"></span>
        <span class="cal-day cal-l4" aria-hidden="true"></span>
        <span class="cal-legend-label">More</span>
      </div>
    `;
  },

  renderImageFallback() {
    return `
      <p class="cal-total"><a class="cal-total-link" href="https://github.com/${contributionCalendar.username}" target="_blank" rel="noopener">GitHub profile</a></p>
      <img src="https://ghchart.rshah.org/${contributionCalendar.username}" alt="GitHub contribution calendar for ${contributionCalendar.username}" loading="lazy" decoding="async" class="ghchart-img">
    `;
  }
};

// GitHub Stats
const githubStats = {
  username: 'ashwani983',

  async init() {
    if (!elements.githubStatsGrid) return;
    try {
      const [userRes, reposRes] = await Promise.all([
        fetch(`https://api.github.com/users/${githubStats.username}`),
        fetch(`https://api.github.com/users/${githubStats.username}/repos?per_page=100&sort=updated`)
      ]);
      if (!userRes.ok || !reposRes.ok) throw new Error('GitHub API request failed');
      const [user, repos] = await Promise.all([userRes.json(), reposRes.json()]);
      githubStats.render(user, repos);
    } catch (error) {
      console.error('Error loading GitHub stats:', error);
      githubStats.renderFallback();
    }
  },

  render(user, repos) {
    const stars = repos.reduce((sum, r) => sum + (r.stargazers_count || 0), 0);

    const langSizes = {};
    repos.forEach(r => {
      if (!r.language) return;
      langSizes[r.language] = (langSizes[r.language] || 0) + (r.size || 0);
    });
    const totalSize = Object.values(langSizes).reduce((sum, v) => sum + v, 0);
    const topLangs = Object.entries(langSizes).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const langBars = topLangs.map(([lang, size]) => {
      const pct = Math.round((size / Math.max(totalSize, 1)) * 100);
      return `
        <div class="lang-row">
          <span class="lang-name">${lang}</span>
          <div class="lang-track"><div class="lang-fill" style="width:${pct}%"></div></div>
          <span class="lang-pct">${pct}%</span>
        </div>`;
    }).join('');

    const stats = [
      { icon: '🗂️', value: user.public_repos ?? 0, label: 'Public Repos' },
      { icon: '⭐', value: stars, label: 'Total Stars' },
      { icon: '👥', value: user.followers ?? 0, label: 'Followers' },
      { icon: '🤝', value: user.following ?? 0, label: 'Following' }
    ];

    elements.githubStatsGrid.innerHTML = `
      <div class="stats-cards">
        ${stats.map(stat => `
          <div class="stat-card">
            <span class="stat-icon">${stat.icon}</span>
            <div class="stat-details">
              <span class="stat-value">${stat.value}</span>
              <span class="stat-label">${stat.label}</span>
            </div>
          </div>
        `).join('')}
      </div>
      <div class="lang-card">
        <h3 class="lang-title">Top Languages</h3>
        <div class="lang-bars">${langBars || '<p class="stats-fallback">No language data available.</p>'}</div>
      </div>
    `;
  },

  renderFallback() {
    if (!elements.githubStatsGrid) return;
    elements.githubStatsGrid.innerHTML = `
      <p class="stats-fallback">GitHub stats are temporarily unavailable. Visit
      <a href="https://github.com/ashwani983" target="_blank" rel="noopener">my GitHub profile</a> to see my work.</p>
    `;
  }
};

// Main Application Initialization
const app = {
  async init() {
    try {
      // Initialize core systems
      themeManager.init();
      typewriterEffect.init();
      counterAnimation.init();
      scrollReveal.init();
      performanceOptimizer.init();
      errorHandler.init();
      githubStats.init();
      contributionCalendar.init();
      carousel.init();
      document.getElementById('projects-load-more')?.addEventListener('click', () => dataManager.loadMoreProjects());
      
      // Load and render data
      await Promise.all([
        dataManager.loadSkills(),
        dataManager.loadExperience(),
        dataManager.loadProjects(),
        dataManager.loadBlogPosts()
      ]);
      
      // Mark app as loaded
      state.isLoading = false;
      document.body.classList.add('loaded');
      
      console.log('Portfolio website initialized successfully');
    } catch (error) {
      console.error('Error initializing application:', error);
      state.isLoading = false;
    }
  }
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', app.init);
} else {
  app.init();
}

// Export for use in other modules
window.portfolioApp = {
  config: siteConfig,
  state,
  utils,
  themeManager,
  dataManager
};
