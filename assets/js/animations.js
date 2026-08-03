// Animations JavaScript - Portfolio Website
// Author: Ashwani Kumar
// Description: Animation effects and interactive elements

(function() {
  'use strict';

  // Animation state
  let animationFrameId;
  let isReducedMotion = false;
  const particleState = { canvas: null, ctx: null, particles: [] };

  // Initialize animations when DOM is loaded
  document.addEventListener('DOMContentLoaded', function() {
    checkReducedMotion();
    initializeAnimations();
  });

  function checkReducedMotion() {
    isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function initializeAnimations() {
    if (isReducedMotion) {
      // Disable animations for users who prefer reduced motion
      document.body.classList.add('reduced-motion');
      return;
    }

    setupScrollReveal();
    setupParticleSystem();
    setupHoverEffects();
    setupLoadingAnimations();
    setupProgressBars();
    setupStaggeredAnimations();
  }

  // Scroll reveal animations
  function setupScrollReveal() {
    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const element = entry.target;
          
          // Add reveal class
          element.classList.add('revealed');
          
          // Add specific animation class based on data attribute
          const animationType = element.dataset.animation;
          if (animationType) {
            element.classList.add(`animate-${animationType}`);
          }
          
          // Trigger staggered animations for children
          if (element.classList.contains('stagger-container')) {
            triggerStaggeredAnimation(element);
          }
          
          observer.unobserve(element);
        }
      });
    }, observerOptions);

    // Observe elements with scroll reveal classes
    const revealElements = document.querySelectorAll('.scroll-reveal, .animate-on-scroll, [data-animation]');
    revealElements.forEach(element => {
      observer.observe(element);
    });
  }

  // Particle system
  function setupParticleSystem() {
    const particleContainer = document.getElementById('particles');
    if (!particleContainer) return;

    // Reuse existing canvas to avoid stacking canvases on resize/tab-switch
    if (particleState.canvas) {
      if (!animationFrameId) {
        animate();
      }
      return;
    }

    // Create canvas
    const canvas = document.createElement('canvas');
    particleState.canvas = canvas;
    particleState.ctx = canvas.getContext('2d');
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '1';
    
    particleContainer.appendChild(canvas);

    // Initialize particles
    const particleCount = window.innerWidth < 768 ? 30 : 50;
    for (let i = 0; i < particleCount; i++) {
      particleState.particles.push(new Particle());
    }

    resizeCanvas();
    animate();

    // Pause animation when the hero is scrolled out of view
    const visibilityObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          if (!animationFrameId) {
            animate();
          }
        } else if (animationFrameId) {
          cleanup();
        }
      });
    }, { threshold: 0 });

    visibilityObserver.observe(particleContainer);
  }

  class Particle {
    constructor() {
      this.reset();
      this.y = Math.random() * window.innerHeight;
      this.opacity = Math.random() * 0.5 + 0.3;
    }
    
    reset() {
      this.x = Math.random() * window.innerWidth;
      this.y = -10;
      this.vx = (Math.random() - 0.5) * 0.5;
      this.vy = Math.random() * 1 + 0.5;
      this.size = Math.random() * 3 + 1;
      this.opacity = Math.random() * 0.5 + 0.3;
      this.hue = Math.random() * 60 + 200; // Blue to purple range
    }
    
    update() {
      this.x += this.vx;
      this.y += this.vy;
      
      // Reset particle when it goes off screen
      if (this.y > window.innerHeight + 10 || 
          this.x < -10 || 
          this.x > window.innerWidth + 10) {
        this.reset();
      }
    }
    
    draw(ctx) {
      ctx.save();
      ctx.globalAlpha = this.opacity;
      ctx.fillStyle = `hsl(${this.hue}, 70%, 60%)`;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function resizeCanvas() {
    if (!particleState.canvas) return;
    particleState.canvas.width = window.innerWidth;
    particleState.canvas.height = window.innerHeight;
  }

  function animate() {
    const ctx = particleState.ctx;
    if (!ctx || !particleState.canvas) return;
    
    ctx.clearRect(0, 0, particleState.canvas.width, particleState.canvas.height);
    
    particleState.particles.forEach(particle => {
      particle.update();
      particle.draw(ctx);
    });
    
    animationFrameId = requestAnimationFrame(animate);
  }

  function animateCounter(element, target, duration = 2000) {
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
  }

  // Hover effects
  function setupHoverEffects() {
    // Add hover effects to cards
    const cards = document.querySelectorAll('.project-card, .blog-card, .skill-item, .contact-item');
    
    cards.forEach(card => {
      card.addEventListener('mouseenter', function() {
        this.style.transform = 'translateY(-5px)';
      });
      
      card.addEventListener('mouseleave', function() {
        this.style.transform = 'translateY(0)';
      });
    });

    // Button ripple effect
    const buttons = document.querySelectorAll('.btn');
    
    buttons.forEach(button => {
      button.addEventListener('click', function(e) {
        const ripple = document.createElement('span');
        const rect = this.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = e.clientX - rect.left - size / 2;
        const y = e.clientY - rect.top - size / 2;
        
        ripple.style.width = ripple.style.height = size + 'px';
        ripple.style.left = x + 'px';
        ripple.style.top = y + 'px';
        ripple.classList.add('ripple');
        
        this.appendChild(ripple);
        
        setTimeout(() => {
          ripple.remove();
        }, 600);
      });
    });
  }

  // Loading animations
  function setupLoadingAnimations() {
    // Skeleton loading for dynamic content
    const skeletonElements = document.querySelectorAll('.skeleton');
    
    skeletonElements.forEach(element => {
      element.classList.add('loading');
    });

    // Remove skeleton loading when content is loaded
    window.addEventListener('load', function() {
      setTimeout(() => {
        skeletonElements.forEach(element => {
          element.classList.remove('loading', 'skeleton');
        });
      }, 500);
    });
  }

  // Progress bars
  function setupProgressBars() {
    const progressBars = document.querySelectorAll('.progress-bar, .skill-progress');
    
    const progressObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const progressBar = entry.target;
          const progress = progressBar.querySelector('.progress-fill, .skill-progress');
          
          if (progress) {
            const percentage = progress.dataset.percentage || '100';
            progress.style.width = percentage + '%';
            progress.classList.add('animate');
          }
          
          progressObserver.unobserve(progressBar);
        }
      });
    }, { threshold: 0.5 });

    progressBars.forEach(bar => {
      progressObserver.observe(bar);
    });
  }

  // Staggered animations
  function setupStaggeredAnimations() {
    const staggerContainers = document.querySelectorAll('.stagger-animation, .stagger-container');
    
    staggerContainers.forEach(container => {
      const children = container.children;
      
      Array.from(children).forEach((child, index) => {
        child.style.animationDelay = `${index * 0.1}s`;
      });
    });
  }

  function triggerStaggeredAnimation(container) {
    const children = container.children;
    
    Array.from(children).forEach((child, index) => {
      setTimeout(() => {
        child.classList.add('animate-fade-in-up');
      }, index * 100);
    });
  }

  // Scroll-triggered animations
  function setupScrollAnimations() {
    let ticking = false;
    
    function updateAnimations() {
      const scrolled = window.pageYOffset;
      const rate = scrolled * -0.5;
      
      // Parallax effect for hero background
      const heroBackground = document.querySelector('.hero-background');
      if (heroBackground) {
        heroBackground.style.transform = `translateY(${rate}px)`;
      }
      
      ticking = false;
    }
    
    function requestTick() {
      if (!ticking) {
        requestAnimationFrame(updateAnimations);
        ticking = true;
      }
    }
    
    window.addEventListener('scroll', requestTick);
  }

  // Intersection Observer for fade-in animations
  function setupFadeInAnimations() {
    const fadeElements = document.querySelectorAll('.fade-in, .animate-fade-in');
    
    const fadeObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          fadeObserver.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    });

    fadeElements.forEach(element => {
      fadeObserver.observe(element);
    });
  }

  // Cleanup function
  function cleanup() {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
  }

  // Handle page visibility change
  document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
      cleanup();
    } else if (!isReducedMotion && particleState.canvas) {
      // Resume the existing animation loop without creating a new canvas
      animate();
    }
  });

  // Handle window resize
  window.addEventListener('resize', function() {
    clearTimeout(window.resizeTimeout);
    window.resizeTimeout = setTimeout(() => {
      if (!isReducedMotion) {
        resizeCanvas();
        if (!animationFrameId) {
          animate();
        }
      }
    }, 250);
  });

  // Export animation utilities
  window.animationUtils = {
    animateCounter,
    triggerStaggeredAnimation,
    cleanup
  };

})();
