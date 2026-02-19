import { LightningElement } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

const COMMUNITY_PARTNER_REG_URL = 'https://orgfarm-eee69b4d17-dev-ed.develop.my.site.com/PartnerCommunity/s/partner-registration';

export default class Homepage extends LightningElement {
    _observerInitialized = false;

    renderedCallback() {
        // reveal-on-scroll effect
        if (this._observerInitialized) return;
        const revealItems = this.template.querySelectorAll('.reveal-item');
        if (!revealItems || revealItems.length === 0) return;

        if ('IntersectionObserver' in window) {
            const io = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('visible');
                        io.unobserve(entry.target);
                    }
                });
            }, { threshold: 0.08 });

            revealItems.forEach(el => io.observe(el));
        } else {
            // fallback
            revealItems.forEach(el => el.classList.add('visible'));
        }

        this._observerInitialized = true;
    }

    scrollToSection(selector) {
        const el = this.template.querySelector(selector);
        if (el && el.scrollIntoView) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    handleApply(event) {
        const card = event.target.closest('[data-category]');
        const category = card ? card.dataset.category : (event.target.dataset.category || 'Partner');

        // if click came from an <a href> let the anchor handle navigation,
        // but still show a brief toast for feedback when it points to partner-registration
        const anchor = event.target.closest('a[href]');
        if (anchor && anchor.getAttribute('href').includes('/partner-registration')) {
            this.dispatchEvent(new ShowToastEvent({ title: `Apply — ${category}`, message: `Opening application for ${category}...`, variant: 'info' }));
            return;
        }

        // programmatic navigation (card click)
        window.location.assign(COMMUNITY_PARTNER_REG_URL);
    }

    handleBecomePartner() {
        // Navigate directly to the community registration page
        window.location.assign(COMMUNITY_PARTNER_REG_URL);
    }

    handleLogin() {
        // Navigate to login
        window.location.assign('/s/products');
    }
}