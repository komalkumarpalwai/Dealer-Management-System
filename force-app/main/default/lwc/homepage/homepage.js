import { LightningElement, wire, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getCurrentUserInfo from '@salesforce/apex/ProductsPageController.getCurrentUserInfo';

const BASE          = 'https://orgfarm-eee69b4d17-dev-ed.develop.my.site.com/PartnerCommunity/s';
const PARTNER_REG   = `${BASE}/partner-registration`;
const LOGIN_URL     = `${BASE}/login/`;
const PRODUCTS_URL  = `${BASE}/products`;
const ORDERS_URL    = `${BASE}/Orders`;

export default class Homepage extends LightningElement {

    @track user = {};
    isLoggedIn = false;
    _observerInitialized = false;

    // ── Wire: current user ─────────────────────────
    @wire(getCurrentUserInfo)
    wiredUserInfo({ error, data }) {
        if (data) {
            this.user = {
                Name:        data.Name?.trim()        || 'Partner',
                Email:       data.Email?.trim()       || '',
                Id:          data.Id?.trim()          || '',
                AccountType: data.AccountType?.trim() || 'Partner',
                AccountName: data.AccountName?.trim() || ''
            };
            this.isLoggedIn = Boolean(this.user.Id);
        } else if (error) {
            console.error('getCurrentUserInfo error:', error);
            this.isLoggedIn = false;
        }
    }

    // ── Computed: user initials for avatar ─────────
    get userInitials() {
        const parts = (this.user.Name || '').split(' ').filter(Boolean);
        if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
        if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
        return 'P';
    }

    // ── Scroll reveal ──────────────────────────────
    renderedCallback() {
        if (this._observerInitialized) return;
        const items = this.template.querySelectorAll('.reveal');
        if (!items || !items.length) return;

        if ('IntersectionObserver' in window) {
            const io = new IntersectionObserver(entries => {
                entries.forEach(e => {
                    if (e.isIntersecting) {
                        e.target.classList.add('revealed');
                        io.unobserve(e.target);
                    }
                });
            }, { threshold: 0.08 });
            items.forEach(el => io.observe(el));
        } else {
            items.forEach(el => el.classList.add('revealed'));
        }
        this._observerInitialized = true;
    }

    // ── Navigation ─────────────────────────────────
    handleApply(event) {
        const card     = event.target.closest('[data-category]');
        const category = card?.dataset.category || 'Partner';
        const anchor   = event.target.closest('a[href]');

        if (anchor?.getAttribute('href')?.includes('/partner-registration')) {
            this.dispatchEvent(new ShowToastEvent({
                title:   `Applying as ${category}`,
                message: `Opening the ${category} registration form...`,
                variant: 'info'
            }));
            return;
        }
        window.location.assign(PARTNER_REG);
    }

    handleBecomePartner() {
        window.location.assign(PARTNER_REG);
    }

    handleLogin() {
        window.location.assign(LOGIN_URL);
    }

    handleViewProducts() {
        window.location.assign(PRODUCTS_URL);
    }

    handleViewOrders() {
        window.location.assign(ORDERS_URL);
    }
}