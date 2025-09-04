// Animations JavaScript - Portfolio Website
// Author: Ashwani Kumar
// Description: Animation effects and interactive elements

(function() {
  'use strict';

  // Animation state
  let animationFrameId;
  let isReducedMotion = false;

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
    setupCounterAnimations();
    setupTypewriterEffect();
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

    const particles = [];
    const particleCount = window.innerWidth < 768 ? 30 : 50;
    
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

    // Create canvas
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '1';
    
    particleContainer.appendChild(canvas);

    // Initialize particles
    for (let i = 0; i < particleCount; i++) {
      particles.push(new Particle());
    }

    function resizeCanvas() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }

    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      particles.forEach(particle => {
        particle.update();
        particle.draw(ctx);
      });
      
      animationFrameId = requestAnimationFrame(animate);
    }

    // Handle resize
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
    animate();
  }

  // Counter animations
  function setupCounterAnimations() {
    const counters = document.querySelectorAll('.stat-number, .counter');
    
    const counterObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const counter = entry.target;
          const target = parseInt(counter.dataset.target) || parseInt(counter.textContent);
          
          animateCounter(counter, target);
          counterObserver.unobserve(counter);
        }
      });
    }, { threshold: 0.5 });

    counters.forEach(counter => {
      counterObserver.observe(counter);
    });
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

  // Typewriter effect
  function setupTypewriterEffect() {
    const typewriterElements = document.querySelectorAll('.typewriter, .text-typewriter');
    
    typewriterElements.forEach(element => {
      const text = element.textContent;
      const words = element.dataset.words ? element.dataset.words.split(',') : [text];
      
      if (words.length > 1) {
        startTypewriterLoop(element, words);
      } else {
        startSingleTypewriter(element, text);
      }
    });
  }

  function startTypewriterLoop(element, words) {
    let wordIndex = 0;
    let charIndex = 0;
    let isDeleting = false;
    
    function type() {
      const currentWord = words[wordIndex];
      
      if (isDeleting) {
        element.textContent = currentWord.substring(0, charIndex - 1);
        charIndex--;
      } else {
        element.textContent = currentWord.substring(0, charIndex + 1);
        charIndex++;
      }
      
      let typeSpeed = isDeleting ? 50 : 100;
      
      if (!isDeleting && charIndex === currentWord.length) {
        typeSpeed = 2000; // Pause at end
        isDeleting = true;
      } else if (isDeleting && charIndex === 0) {
        isDeleting = false;
        wordIndex = (wordIndex + 1) % words.length;
        typeSpeed = 500; // Pause before next word
      }
      
      setTimeout(type, typeSpeed);
    }
    
    type();
  }

  function startSingleTypewriter(element, text) {
    element.textContent = '';
    let charIndex = 0;
    
    function type() {
      if (charIndex < text.length) {
        element.textContent += text.charAt(charIndex);
        charIndex++;
        setTimeout(type, 100);
      }
    }
    
    type();
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
    }
  }

  // Handle page visibility change
  document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
      cleanup();
    } else if (!isReducedMotion) {
      // Restart animations when page becomes visible
      setupParticleSystem();
    }
  });

  // Handle window resize
  window.addEventListener('resize', function() {
    // Debounce resize events
    clearTimeout(window.resizeTimeout);
    window.resizeTimeout = setTimeout(() => {
      if (!isReducedMotion) {
        cleanup();
        setupParticleSystem();
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
