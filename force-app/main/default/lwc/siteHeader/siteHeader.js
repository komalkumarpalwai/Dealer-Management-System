import { LightningElement, wire } from 'lwc';
import { CurrentPageReference } from 'lightning/navigation';
import getCurrentUserInfo from '@salesforce/apex/ProductsPageController.getCurrentUserInfo';

export default class SiteHeader extends LightningElement {
    user = {};
    isLoggedIn = false;
    showProfileDropdown = false;
    userInitials = '';
    currentPageUrl = '';
    isHomePage = false;
    isPartnerPage = false;
    isSupportPage = false;
    isAboutPage = false;
    isPortalPage = false;

    get displayAccountType() {
        return this.user.AccountType && this.user.AccountType.trim() ? this.user.AccountType : 'N/A';
    }

    @wire(getCurrentUserInfo)
    wiredUserInfo({ error, data }) {
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

    connectedCallback() {
        // Close dropdown when clicking outside
        document.addEventListener('click', this.handleDocumentClick.bind(this));
        // Check current page
        this.checkCurrentPage();
        // Listen for URL changes
        window.addEventListener('popstate', this.checkCurrentPage.bind(this));
    }

    disconnectedCallback() {
        document.removeEventListener('click', this.handleDocumentClick.bind(this));
        window.removeEventListener('popstate', this.checkCurrentPage.bind(this));
    }

    checkCurrentPage() {
        const url = window.location.pathname.toLowerCase();
        this.currentPageUrl = url;
        
        // Reset all
        this.isHomePage = false;
        this.isPartnerPage = false;
        this.isSupportPage = false;
        this.isAboutPage = false;
        this.isPortalPage = false;

        // Set active based on URL
        if (url === '/' || url === '') {
            this.isHomePage = true;
        } else if (url.includes('/partner-registration')) {
            this.isPartnerPage = true;
        } else if (url.includes('/support')) {
            this.isSupportPage = true;
        } else if (url.includes('/about')) {
            this.isAboutPage = true;
        } else if (url.includes('/products') || url.includes('products')) {
            this.isPortalPage = true;
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
        if (href && href !== '/') {
            window.location.assign(href);
        }
        // Home link navigates to root
        if (href === '/') {
            window.location.assign('/');
        }
    }

    handleLogin() {
        window.location.assign('/s/products');
    }

    handlePortal() {
        window.location.assign('/s/products');
    }

    toggleProfileDropdown(event) {
        event.stopPropagation();
        this.showProfileDropdown = !this.showProfileDropdown;
    }

    get portalBtnClass() {
        return this.isPortalPage ? 'nav-portal active' : 'nav-portal';
    }

    handleLogout() {
        // Clear any stored data
        sessionStorage.clear();
        // Redirect to logout
        window.location.assign('/logout');
    }

    handleApply() {
        window.location.assign('https://orgfarm-eee69b4d17-dev-ed.develop.my.site.com/PartnerCommunity/s/partner-registration');
    }
}