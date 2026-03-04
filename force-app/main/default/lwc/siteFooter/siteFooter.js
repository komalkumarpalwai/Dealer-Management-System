import { LightningElement } from 'lwc';

const BASE = 'https://orgfarm-eee69b4d17-dev-ed.develop.my.site.com/PartnerCommunity/s';

export default class AmFooter extends LightningElement {

    // ── Navigation URLs ───────────────────────────────────────────────────────
    homeUrl         = `${BASE}/`;
    productsUrl     = `${BASE}/products`;
    ordersUrl       = `${BASE}/Orders`;
    registrationUrl = `${BASE}/partner-registration`;
    loginUrl        = `${BASE}/login/`;

    // ── Current year for copyright ────────────────────────────────────────────
    get currentYear() {
        return new Date().getFullYear();
    }

    // ── Policy modal state ────────────────────────────────────────────────────
    isPolicyOpen = false;
    activeTab    = 'terms';

    // ── Legal link handlers — each opens modal on the correct tab ─────────────
    handlePrivacyPolicy() {
        this.activeTab    = 'privacy';
        this.isPolicyOpen = true;
        document.body.style.overflow = 'hidden';
    }

    handleTerms() {
        this.activeTab    = 'terms';
        this.isPolicyOpen = true;
        document.body.style.overflow = 'hidden';
    }

    handleDataPolicy() {
        this.activeTab    = 'data';
        this.isPolicyOpen = true;
        document.body.style.overflow = 'hidden';
    }

    // ── Modal close ───────────────────────────────────────────────────────────
    handleClosePolicy() {
        this.isPolicyOpen = false;
        document.body.style.overflow = '';
    }

    handleBackdropClick(event) {
        if (event.target === event.currentTarget) {
            this.handleClosePolicy();
        }
    }

    // ── Tab switching ─────────────────────────────────────────────────────────
    handleTabChange(event) {
        this.activeTab = event.currentTarget.dataset.tab;
        const body = this.template.querySelector('.modal-body');
        if (body) body.scrollTop = 0;
    }

    // ── Tab active classes ────────────────────────────────────────────────────
    get tab1Class() { return this.activeTab === 'terms'   ? 'tab-active' : ''; }
    get tab2Class() { return this.activeTab === 'privacy' ? 'tab-active' : ''; }
    get tab3Class() { return this.activeTab === 'data'    ? 'tab-active' : ''; }
    get tab4Class() { return this.activeTab === 'partner' ? 'tab-active' : ''; }

    // ── Active tab booleans for template rendering ────────────────────────────
    get isTabTerms()   { return this.activeTab === 'terms';   }
    get isTabPrivacy() { return this.activeTab === 'privacy'; }
    get isTabData()    { return this.activeTab === 'data';    }
    get isTabPartner() { return this.activeTab === 'partner'; }
}