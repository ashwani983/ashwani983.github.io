// Main JavaScript File - Portfolio Website
// Author: Ashwani Kumar
// Description: Core functionality for the portfolio website

// Site Configuration
const siteConfig = {
  siteName: "Ashwani Kumar - System Developer Engineer",
  siteUrl: "https://ashwani983.github.io",
  author: "Ashwani Kumar",
  email: "ashwani.kumar@example.com",
  social: {
    github: "ashwani983",
    linkedin: "ashwani-kumar",
    twitter: "ashwani_kumar"
  }
};

// DOM Elements
const elements = {
  navbar: document.getElementById('navbar'),
  navToggle: document.getElementById('nav-toggle'),
  navMenu: document.getElementById('nav-menu'),
  themeToggle: document.getElementById('theme-toggle'),
  typewriter: document.getElementById('typewriter'),
  particles: document.getElementById('particles'),
  skillsGrid: document.getElementById('skills-grid'),
  featuredProjectsGrid: document.getElementById('featured-projects-grid'),
  blogGrid: document.getElementById('blog-grid')
};

// State Management
const state = {
  currentTheme: localStorage.getItem('theme') || 'dark',
  isMenuOpen: false,
  isLoading: true,
  scrollPosition: 0,
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
      const icon = elements.themeToggle.querySelector('.theme-icon');
      if (icon) {
        icon.textContent = theme === 'dark' ? '☀️' : '🌙';
      }
    }
  },

  toggle: () => {
    const newTheme = state.currentTheme === 'dark' ? 'light' : 'dark';
    themeManager.setTheme(newTheme);
  }
};

// Navigation Management
const navigationManager = {
  init: () => {
    navigationManager.setupEventListeners();
    navigationManager.setupSmoothScrolling();
    navigationManager.updateActiveLink();
  },

  setupEventListeners: () => {
    // Mobile menu toggle
    elements.navToggle?.addEventListener('click', navigationManager.toggleMobileMenu);
    
    // Close mobile menu when clicking on links
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
      link.addEventListener('click', () => {
        if (state.isMenuOpen) {
          navigationManager.toggleMobileMenu();
        }
      });
    });

    // Handle scroll for navbar background
    window.addEventListener('scroll', utils.throttle(navigationManager.handleScroll, 10));
  },

  toggleMobileMenu: () => {
    state.isMenuOpen = !state.isMenuOpen;
    elements.navMenu?.classList.toggle('active');
    elements.navToggle?.classList.toggle('active');
    
    // Prevent body scroll when menu is open
    document.body.style.overflow = state.isMenuOpen ? 'hidden' : '';
  },

  setupSmoothScrolling: () => {
    const navLinks = document.querySelectorAll('a[href^="#"]');
    navLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = link.getAttribute('href');
        const targetElement = document.querySelector(targetId);
        
        if (targetElement) {
          const offsetTop = targetElement.offsetTop - 70; // Account for fixed navbar
          window.scrollTo({
            top: offsetTop,
            behavior: 'smooth'
          });
        }
      });
    });
  },

  handleScroll: () => {
    const scrolled = window.pageYOffset;
    state.scrollPosition = scrolled;
    
    // Add/remove navbar background
    if (elements.navbar) {
      if (scrolled > 50) {
        elements.navbar.classList.add('scrolled');
      } else {
        elements.navbar.classList.remove('scrolled');
      }
    }
    
    // Update active navigation link
    navigationManager.updateActiveLink();
  },

  updateActiveLink: () => {
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav-link');
    
    let currentSection = '';
    
    sections.forEach(section => {
      const sectionTop = section.offsetTop - 100;
      const sectionHeight = section.clientHeight;
      
      if (state.scrollPosition >= sectionTop && state.scrollPosition < sectionTop + sectionHeight) {
        currentSection = section.getAttribute('id');
      }
    });
    
    navLinks.forEach(link => {
      link.classList.remove('active');
      if (link.getAttribute('href') === `#${currentSection}`) {
        link.classList.add('active');
      }
    });
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

// Particle System
const particleSystem = {
  init: () => {
    if (elements.particles) {
      particleSystem.createParticles();
    }
  },

  createParticles: () => {
    const particleCount = window.innerWidth < 768 ? 30 : 50;
    
    for (let i = 0; i < particleCount; i++) {
      const particle = document.createElement('div');
      particle.className = 'particle';
      
      // Random position
      particle.style.left = Math.random() * 100 + '%';
      particle.style.animationDelay = Math.random() * 20 + 's';
      particle.style.animationDuration = (Math.random() * 10 + 10) + 's';
      
      elements.particles.appendChild(particle);
    }
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

  async loadProjects() {
    try {
      const response = await fetch('data/projects.json');
      const data = await response.json();
      const featuredProjects = data.projects.filter(project => project.featured).slice(0, 3);
      dataManager.renderProjects(featuredProjects);
    } catch (error) {
      console.error('Error loading projects:', error);
      dataManager.renderProjectsPlaceholder();
    }
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
    
    elements.skillsGrid.innerHTML = skills.map(skill => `
      <div class="skill-item hover-lift">
        <div class="skill-icon">${skill.icon}</div>
        <div class="skill-name">${skill.name}</div>
      </div>
    `).join('');
  },

  renderProjects(projects) {
    if (!elements.featuredProjectsGrid) return;
    
    elements.featuredProjectsGrid.innerHTML = projects.map(project => `
      <div class="project-card hover-lift">
        <div class="project-icon">
          <span class="project-emoji">${project.icon || '🚀'}</span>
        </div>
        <div class="project-content">
          <h3 class="project-title">${project.title}</h3>
          <p class="project-description">${project.description}</p>
          <div class="project-tech">
            ${project.technologies.map(tech => `<span class="tech-tag">${tech}</span>`).join('')}
          </div>
          <div class="project-links">
            ${project.liveUrl ? `<a href="${project.liveUrl}" class="project-link" target="_blank">Live Demo</a>` : ''}
            ${project.githubUrl ? `<a href="${project.githubUrl}" class="project-link" target="_blank">GitHub</a>` : ''}
          </div>
        </div>
      </div>
    `).join('');
  },

  renderBlogPosts(posts) {
    if (!elements.blogGrid) return;
    
    elements.blogGrid.innerHTML = posts.map(post => `
      <div class="blog-card hover-lift">
        <div class="blog-image">
          ${post.image ? `<img src="${post.image}" alt="${post.title}">` : '📝 Blog Post'}
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
      </div>
    `).join('');
  },

  renderSkillsPlaceholder() {
    if (!elements.skillsGrid) return;
    
    const placeholderSkills = [
      { icon: '🐳', name: 'Docker' },
      { icon: '☸️', name: 'Kubernetes' },
      { icon: '🔧', name: 'Jenkins' },
      { icon: '🐧', name: 'Linux' },
      { icon: '☁️', name: 'AWS' },
      { icon: '🐍', name: 'Python' }
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

// Main Application Initialization
const app = {
  async init() {
    try {
      // Initialize core systems
      themeManager.init();
      navigationManager.init();
      typewriterEffect.init();
      particleSystem.init();
      counterAnimation.init();
      scrollReveal.init();
      performanceOptimizer.init();
      errorHandler.init();
      
      // Load and render data
      await Promise.all([
        dataManager.loadSkills(),
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
  navigationManager,
  dataManager
};
