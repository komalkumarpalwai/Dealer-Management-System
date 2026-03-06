import { LightningElement } from 'lwc';

/**
 * AboutUs Component
 * Displays company information, offerings, and contact details
 * Includes scroll animations, parallax effects, and interactive elements
 */
export default class AboutUs extends LightningElement {
  connectedCallback() {
    this.initScrollReveal();
    this.initStaggeredCards();
    this.initHeroParallax();
    this.initEmailCopy();
    this.initOfficeCardRipple();
    this.updateFooterYear();
  }

  /**
   * Initialize scroll reveal animation
   * Adds reveal class to elements and observes when they enter viewport
   */
  initScrollReveal() {
    const revealSelectors = [
      '.who-text',
      '.who-visual',
      '.mission',
      '.section-title',
      '.offer-card',
      '.pillar',
      '.office-card',
      '.why-title',
      '.offices-title',
    ];

    revealSelectors.forEach((selector) => {
      this.template.querySelectorAll(selector).forEach((el) => {
        el.classList.add('reveal');
      });
    });

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );

    this.template.querySelectorAll('.reveal').forEach((el) => {
      observer.observe(el);
    });
  }

  /**
   * Initialize staggered animations for cards
   */
  initStaggeredCards() {
    this.applyStaggerDelay('.offer-card', 80);
    this.applyStaggerDelay('.pillar', 100);
    this.applyStaggerDelay('.office-card', 100);
  }

  /**
   * Apply staggered transition delay to elements
   * @param {string} selector - CSS selector for elements
   * @param {number} delayStep - Delay increment in milliseconds
   */
  applyStaggerDelay(selector, delayStep) {
    this.template.querySelectorAll(selector).forEach((element, index) => {
      element.style.transitionDelay = `${index * delayStep}ms`;
    });
  }

  /**
   * Initialize hero parallax effect on scroll
   * Creates subtle depth effect as user scrolls
   */
  initHeroParallax() {
    const hero = this.template.querySelector('.hero');
    if (!hero) return;

    window.addEventListener(
      'scroll',
      () => {
        const scrollY = window.scrollY;
        const heroHeight = hero.offsetHeight;

        if (scrollY <= heroHeight) {
          const progress = scrollY / heroHeight;
          const parallaxElements = hero.querySelectorAll('h1, .hero-sub, .hero-eyebrow');

          parallaxElements.forEach((el) => {
            el.style.transform = `translateY(${scrollY * 0.12}px)`;
            el.style.opacity = 1 - progress * 0.6;
          });
        }
      },
      { passive: true }
    );
  }

  /**
   * Initialize email copy to clipboard functionality
   */
  initEmailCopy() {
    const emailLink = this.template.querySelector('a[href^="mailto:"]');
    if (!emailLink) return;

    emailLink.addEventListener('click', (e) => {
      const original = emailLink.textContent;
      emailLink.textContent = 'Copied!';

      navigator.clipboard
        .writeText('info@arrayminds.com')
        .catch(() => {
          // Silently ignore if clipboard access is denied
        });

      setTimeout(() => {
        emailLink.textContent = original;
      }, 1500);
    });
  }

  /**
   * Initialize ripple effect on office card click
   */
  initOfficeCardRipple() {
    this.template.querySelectorAll('.office-card').forEach((card) => {
      card.style.position = 'relative';
      card.style.overflow = 'hidden';

      card.addEventListener('click', (e) => {
        this.createRipple(card, e);
      });
    });

    this.injectRippleAnimation();
  }

  /**
   * Create ripple effect for clicked element
   * @param {HTMLElement} card - The element where ripple should be created
   * @param {Event} event - The click event
   */
  createRipple(card, event) {
    const ripple = document.createElement('span');
    const rect = card.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);

    ripple.style.cssText = [
      'position:absolute',
      'border-radius:50%',
      'background:rgba(255,107,0,0.18)',
      `width:${size}px`,
      `height:${size}px`,
      `top:${event.clientY - rect.top - size / 2}px`,
      `left:${event.clientX - rect.left - size / 2}px`,
      'transform:scale(0)',
      'animation:rippleAnim 0.55s linear',
      'pointer-events:none',
    ].join(';');

    card.appendChild(ripple);
    ripple.addEventListener('animationend', () => {
      ripple.remove();
    });
  }

  /**
   * Inject ripple animation keyframes dynamically
   */
  injectRippleAnimation() {
    const rippleStyle = document.createElement('style');
    rippleStyle.textContent = '@keyframes rippleAnim { to { transform: scale(2.5); opacity: 0; } }';
    document.head.appendChild(rippleStyle);
  }

  /**
   * Update footer year to current year
   */
  updateFooterYear() {
    const footerCopy = this.template.querySelector('.footer-copy');
    if (footerCopy) {
      footerCopy.textContent = footerCopy.textContent.replace(
        /\d{4}/,
        new Date().getFullYear()
      );
    }
  }
}
