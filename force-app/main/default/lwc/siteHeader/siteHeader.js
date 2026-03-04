import { LightningElement, wire, track } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import { CurrentPageReference } from 'lightning/navigation';
import getCurrentUserInfo from '@salesforce/apex/ProductsPageController.getCurrentUserInfo';


export default class SiteHeader extends LightningElement {
    @track user = {};
    isLoggedIn = false;
    showProfileDropdown = false;
    userInitials = '';
    currentPageUrl = '';
    isHomePage = false;
    isPartnerPage = false;
    isSupportPage = false;
    isAboutPage = false;
    isPortalPage = false;
    isOrderPage = false;

    // Store the wired result so we can refresh it later
    _wiredUserResult;

    // ── Computed nav classes ──────────────────────────────────────────────────
    get homeNavClass() {
        return this.isHomePage ? 'nav-link active' : 'nav-link';
    }

    get aboutNavClass() {
        return this.isAboutPage ? 'nav-link active' : 'nav-link';
    }

    get portalBtnClass() {
        return this.isPortalPage ? 'nav-portal active' : 'nav-portal';
    }

    get orderPageBtnClass() {
        return this.isOrderPage ? 'nav-order active' : 'nav-order';
    }

    get displayAccountType() {
        return this.user.AccountType && this.user.AccountType.trim() ? this.user.AccountType : 'N/A';
    }

    // ── Wire ─────────────────────────────────────────────────────────────────
    @wire(getCurrentUserInfo)
    wiredUserInfo(result) {
        // Store the full result so refreshApex can target it
        this._wiredUserResult = result;

        const { error, data } = result;

        console.log('=== wiredUserInfo called ===');

        if (data) {
            console.log('Raw data received:', data);
            console.log('Data keys:', Object.keys(data));
            console.log('data.Id:', data.Id);
            console.log('data.Name:', data.Name);
            console.log('data.Email:', data.Email);
            console.log('data.AccountId:', data.AccountId);
            console.log('data.AccountName:', data.AccountName);
            console.log('data.AccountType:', data.AccountType);
            console.log('typeof AccountType:', typeof data.AccountType);

            // Build user object with safe defaults
            this.user = {
                Name: data.Name && data.Name.trim() ? data.Name : 'User',
                Email: data.Email && data.Email.trim() ? data.Email : '',
                Id: data.Id && data.Id.trim() ? data.Id : '',
                AccountType: data.AccountType && data.AccountType.trim() ? data.AccountType : 'N/A',
                AccountName: data.AccountName && data.AccountName.trim() ? data.AccountName : ''
            };

            console.log('Built user object:', this.user);

            this.userInitials = this.getInitials(this.user.Name);

            // Check if user has a valid Id - if so, they're logged in
            this.isLoggedIn = this.user.Id && this.user.Id.length > 0;
            console.log('isLoggedIn:', this.isLoggedIn);
            console.log('user.AccountType in this.user:', this.user.AccountType);

        } else if (error) {
            console.error('getCurrentUserInfo error:', error);
            console.error('Error details:', JSON.stringify(error));
            this.isLoggedIn = false;
        }
    }

    // ── Lifecycle ─────────────────────────────────────────────────────────────
    connectedCallback() {
        document.addEventListener('click', this.handleDocumentClick.bind(this));
        this.checkCurrentPage();
        window.addEventListener('popstate', this.checkCurrentPage.bind(this));

        // Refresh user data every 30 s to catch org-side changes (e.g. name updates)
        this._refreshInterval = setInterval(() => {
            this.refreshUserData();
        }, 30000);
    }

    disconnectedCallback() {
        document.removeEventListener('click', this.handleDocumentClick.bind(this));
        window.removeEventListener('popstate', this.checkCurrentPage.bind(this));

        if (this._refreshInterval) {
            clearInterval(this._refreshInterval);
        }
    }

    // ── Methods ───────────────────────────────────────────────────────────────
    refreshUserData() {
        if (this._wiredUserResult) {
            refreshApex(this._wiredUserResult)
                .then(() => console.log('User data refreshed successfully'))
                .catch(error => console.error('Error refreshing user data:', error));
        }
    }

    checkCurrentPage() {
        const url = window.location.pathname.toLowerCase();
        this.currentPageUrl = url;

        this.isHomePage = false;
        this.isPartnerPage = false;
        this.isSupportPage = false;
        this.isAboutPage = false;
        this.isPortalPage = false;
        this.isOrderPage = false;

        if (url === '/' || url === '' || url.endsWith('/s/')) {
            this.isHomePage = true;
        } else if (url.includes('/partner-registration')) {
            this.isPartnerPage = true;
        } else if (url.includes('/support')) {
            this.isSupportPage = true;
        } else if (url.includes('/about')) {
            this.isAboutPage = true;
        } else if (url.includes('/products')) {
            this.isPortalPage = true;
        } else if (url.includes('/orders')) {
            this.isOrderPage = true;
        }
    }

    handleDocumentClick(event) {
        const profileMenu = this.template.querySelector('.profile-menu');
        if (profileMenu && !profileMenu.contains(event.target)) {
            this.showProfileDropdown = false;
        }
    }

    getInitials(name) {
        if (!name) return 'U';
        const parts = name.split(' ');
        return parts.map(part => part[0]).join('').toUpperCase().slice(0, 2);
    }

    handleNavClick(event) {
        event.preventDefault();
        const href = event.target.getAttribute('href');
        if (href) {
            window.location.assign(href);
        }
    }

    handleLogin() {
        window.location.assign('https://orgfarm-eee69b4d17-dev-ed.develop.my.site.com/PartnerCommunity/s/login/');
    }

    handlePortal() {
        window.location.assign('https://orgfarm-eee69b4d17-dev-ed.develop.my.site.com/PartnerCommunity/s/products');
    }

    handleOrderPage() {
        window.location.assign('https://orgfarm-eee69b4d17-dev-ed.develop.my.site.com/PartnerCommunity/s/Orders');
    }

    toggleProfileDropdown(event) {
        event.stopPropagation();
        this.showProfileDropdown = !this.showProfileDropdown;
    }

    handleLogout() {
        sessionStorage.clear();
        window.location.assign('https://orgfarm-eee69b4d17-dev-ed.develop.my.site.com/PartnerCommunity/s/');
    }

    handleApply() {
        window.location.assign('https://orgfarm-eee69b4d17-dev-ed.develop.my.site.com/PartnerCommunity/s/partner-registration');
    }
}