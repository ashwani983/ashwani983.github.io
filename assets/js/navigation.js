// Navigation JavaScript - Portfolio Website
// Author: Ashwani Kumar
// Description: Navigation functionality and smooth scrolling

(function() {
  'use strict';

  // Navigation state
  let isScrolling = false;
  let scrollTimeout;

  // Initialize navigation when DOM is loaded
  document.addEventListener('DOMContentLoaded', function() {
    initializeNavigation();
  });

  function initializeNavigation() {
    setupMobileMenu();
    setupSmoothScrolling();
    setupScrollSpy();
    setupNavbarScroll();
    setupKeyboardNavigation();
  }

  // Mobile menu functionality
  function setupMobileMenu() {
    const navToggle = document.getElementById('nav-toggle');
    const navMenu = document.getElementById('nav-menu');
    const navLinks = document.querySelectorAll('.nav-link');
    const body = document.body;

    if (!navToggle || !navMenu) return;

    // Toggle mobile menu
    navToggle.addEventListener('click', function(e) {
      e.preventDefault();
      toggleMobileMenu();
    });

    // Close menu when clicking on nav links
    navLinks.forEach(link => {
      link.addEventListener('click', function() {
        if (navMenu.classList.contains('active')) {
          closeMobileMenu();
        }
      });
    });

    // Close menu when clicking outside
    document.addEventListener('click', function(e) {
      if (!navToggle.contains(e.target) && !navMenu.contains(e.target)) {
        if (navMenu.classList.contains('active')) {
          closeMobileMenu();
        }
      }
    });

    // Close menu on escape key
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && navMenu.classList.contains('active')) {
        closeMobileMenu();
      }
    });

    function toggleMobileMenu() {
      const isActive = navMenu.classList.contains('active');
      
      if (isActive) {
        closeMobileMenu();
      } else {
        openMobileMenu();
      }
    }

    function openMobileMenu() {
      navMenu.classList.add('active');
      navToggle.classList.add('active');
      navToggle.setAttribute('aria-expanded', 'true');
      body.style.overflow = 'hidden';
      
      // Focus first nav link for accessibility
      const firstLink = navMenu.querySelector('.nav-link');
      if (firstLink) {
        setTimeout(() => firstLink.focus(), 100);
      }
    }

    function closeMobileMenu() {
      navMenu.classList.remove('active');
      navToggle.classList.remove('active');
      navToggle.setAttribute('aria-expanded', 'false');
      body.style.overflow = '';
      
      // Return focus to toggle button
      navToggle.focus();
    }
  }

  // Smooth scrolling for anchor links
  function setupSmoothScrolling() {
    const anchorLinks = document.querySelectorAll('a[href^="#"]');
    
    anchorLinks.forEach(link => {
      link.addEventListener('click', function(e) {
        const href = this.getAttribute('href');
        
        // Skip if it's just a hash
        if (href === '#') return;
        
        e.preventDefault();
        
        const targetId = href.substring(1);
        const targetElement = document.getElementById(targetId);
        
        if (targetElement) {
          smoothScrollTo(targetElement);
        }
      });
    });
  }

  // Smooth scroll to element
  function smoothScrollTo(element) {
    const navbar = document.getElementById('navbar');
    const navbarHeight = navbar ? navbar.offsetHeight : 70;
    const targetPosition = element.offsetTop - navbarHeight;
    
    // Use native smooth scrolling if supported
    if ('scrollBehavior' in document.documentElement.style) {
      window.scrollTo({
        top: targetPosition,
        behavior: 'smooth'
      });
    } else {
      // Fallback for older browsers
      animateScrollTo(targetPosition);
    }
  }

  // Animated scroll fallback
  function animateScrollTo(targetPosition) {
    const startPosition = window.pageYOffset;
    const distance = targetPosition - startPosition;
    const duration = 800;
    let start = null;

    function animation(currentTime) {
      if (start === null) start = currentTime;
      const timeElapsed = currentTime - start;
      const run = easeInOutQuad(timeElapsed, startPosition, distance, duration);
      window.scrollTo(0, run);
      
      if (timeElapsed < duration) {
        requestAnimationFrame(animation);
      }
    }

    function easeInOutQuad(t, b, c, d) {
      t /= d / 2;
      if (t < 1) return c / 2 * t * t + b;
      t--;
      return -c / 2 * (t * (t - 2) - 1) + b;
    }

    requestAnimationFrame(animation);
  }

  // Scroll spy functionality
  function setupScrollSpy() {
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav-link');
    
    if (sections.length === 0 || navLinks.length === 0) return;

    function updateActiveLink() {
      const scrollPosition = window.pageYOffset + 100;
      let currentSection = '';

      sections.forEach(section => {
        const sectionTop = section.offsetTop;
        const sectionHeight = section.offsetHeight;
        
        if (scrollPosition >= sectionTop && scrollPosition < sectionTop + sectionHeight) {
          currentSection = section.getAttribute('id');
        }
      });

      // Update active nav link
      navLinks.forEach(link => {
        const isActive = link.getAttribute('href') === `#${currentSection}`;
        link.classList.toggle('active', isActive);
        if (isActive) {
          link.setAttribute('aria-current', 'page');
        } else {
          link.removeAttribute('aria-current');
        }
      });
    }

    // Throttled scroll event
    window.addEventListener('scroll', function() {
      if (!isScrolling) {
        window.requestAnimationFrame(updateActiveLink);
        isScrolling = true;
      }
      
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        isScrolling = false;
      }, 66); // ~15fps
    });

    // Initial call
    updateActiveLink();
  }

  // Navbar scroll effects
  function setupNavbarScroll() {
    const navbar = document.getElementById('navbar');
    if (!navbar) return;

    let lastScrollTop = 0;
    let scrollDirection = 'up';

    function handleNavbarScroll() {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      
      // Add/remove scrolled class
      if (scrollTop > 50) {
        navbar.classList.add('scrolled');
      } else {
        navbar.classList.remove('scrolled');
      }

      // Determine scroll direction
      if (scrollTop > lastScrollTop && scrollTop > 100) {
        // Scrolling down
        if (scrollDirection !== 'down') {
          scrollDirection = 'down';
          navbar.classList.add('nav-hidden');
        }
      } else {
        // Scrolling up
        if (scrollDirection !== 'up') {
          scrollDirection = 'up';
          navbar.classList.remove('nav-hidden');
        }
      }

      lastScrollTop = scrollTop <= 0 ? 0 : scrollTop;
    }

    // Throttled scroll event
    window.addEventListener('scroll', function() {
      if (!isScrolling) {
        window.requestAnimationFrame(handleNavbarScroll);
        isScrolling = true;
      }
    });
  }

  // Keyboard navigation
  function setupKeyboardNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    
    navLinks.forEach((link, index) => {
      link.addEventListener('keydown', function(e) {
        let targetIndex;
        
        switch(e.key) {
          case 'ArrowRight':
          case 'ArrowDown':
            e.preventDefault();
            targetIndex = (index + 1) % navLinks.length;
            navLinks[targetIndex].focus();
            break;
            
          case 'ArrowLeft':
          case 'ArrowUp':
            e.preventDefault();
            targetIndex = (index - 1 + navLinks.length) % navLinks.length;
            navLinks[targetIndex].focus();
            break;
            
          case 'Home':
            e.preventDefault();
            navLinks[0].focus();
            break;
            
          case 'End':
            e.preventDefault();
            navLinks[navLinks.length - 1].focus();
            break;
        }
      });
    });
  }

  // Utility functions
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  function throttle(func, limit) {
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
  }

  // Export functions for external use
  window.navigationUtils = {
    smoothScrollTo,
    debounce,
    throttle
  };

})();
