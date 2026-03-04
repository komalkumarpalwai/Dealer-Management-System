import { LightningElement } from 'lwc';
import createPartnerApplication from '@salesforce/apex/PartnerApplicationController.createPartnerApplication';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class PartnerRegistration extends LightningElement {

    // ── Form fields ───────────────────────────────────────────────────────────
    businessName        = '';
    businessType        = '';
    brandName           = '';
    gstNumber           = '';
    panNumber           = '';
    annualRevenue       = null;
    primaryContactName  = '';
    email               = '';
    phone               = '';
    address             = '';

    // ── UI state ──────────────────────────────────────────────────────────────
    successMessage  = '';
    errorMessage    = '';
    isLoading       = false;
    isSubmitted     = false;

    // ── Policy modal state ────────────────────────────────────────────────────
    isPolicyOpen    = false;
    activeTab       = 'terms';

    // ── Picklist options ──────────────────────────────────────────────────────
    businessTypeOptions = [
        { label: 'Dealer',       value: 'Dealer'       },
        { label: 'Distributor',  value: 'Distributor'  },
        { label: 'Retailer',     value: 'Retailer'     },
        { label: 'OEM',          value: 'OEM'          },
        { label: 'Customer',     value: 'Customer'     }
    ];

    // ── Form handlers ─────────────────────────────────────────────────────────
    handleChange(event) {
        const field = event.target.dataset.field;
        this[field] = event.target.value;
    }

    validateForm() {
        const inputs = this.template.querySelectorAll(
            'lightning-input, lightning-combobox, lightning-textarea'
        );
        return [...inputs].reduce((validSoFar, inputCmp) => {
            inputCmp.reportValidity();
            return validSoFar && inputCmp.checkValidity();
        }, true);
    }

    async handleSubmit() {
        if (!this.validateForm()) {
            this.showToast(
                'Validation error',
                'Please fix the highlighted fields before submitting.',
                'error'
            );
            return;
        }

        this.isLoading = true;
        try {
            const result = await createPartnerApplication({
                businessName:       this.businessName,
                businessType:       this.businessType,
                brandName:          this.brandName,
                gstNumber:          this.gstNumber,
                panNumber:          this.panNumber,
                annualRevenue:      this.annualRevenue,
                primaryContactName: this.primaryContactName,
                email:              this.email,
                phone:              this.phone,
                address:            this.address
            });

            if (result === 'SUCCESS') {
                this.successMessage = 'Application submitted successfully!';
                this.errorMessage   = null;
                this.showToast('Success', 'Application submitted successfully!', 'success');
                this.clearForm();
                this.isSubmitted = true;
            } else {
                this.errorMessage   = result || 'Failed to submit application';
                this.successMessage = null;
                this.showToast('Error', this.errorMessage, 'error');
            }
        } catch (error) {
            const message = error?.body?.message ?? error?.message ?? 'Unknown error';
            this.errorMessage   = message;
            this.successMessage = null;
            this.showToast('Error', message, 'error');
        } finally {
            this.isLoading = false;
        }
    }

    clearForm() {
        this.businessName       = '';
        this.businessType       = '';
        this.brandName          = '';
        this.gstNumber          = '';
        this.panNumber          = '';
        this.annualRevenue      = null;
        this.primaryContactName = '';
        this.email              = '';
        this.phone              = '';
        this.address            = '';

        const inputs = this.template.querySelectorAll(
            'lightning-input, lightning-combobox, lightning-textarea'
        );
        inputs.forEach(i => i.setCustomValidity(''));
    }

    handleCreateAnother() {
        this.isSubmitted    = false;
        this.successMessage = null;
        this.errorMessage   = null;
        this.clearForm();
    }

    showToast(title, message, variant = 'info') {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }

    // ── Policy modal — open / close ───────────────────────────────────────────
    handleOpenPolicy() {
        this.isPolicyOpen = true;
        this.activeTab    = 'terms';
        document.body.style.overflow = 'hidden';
    }

    handleClosePolicy() {
        this.isPolicyOpen = false;
        document.body.style.overflow = '';
    }

    // Close when user clicks the dark backdrop (not the modal card itself)
    handleBackdropClick(event) {
        if (event.target === event.currentTarget) {
            this.handleClosePolicy();
        }
    }

    // ── Policy modal — tabs ───────────────────────────────────────────────────
    handleTabChange(event) {
        this.activeTab = event.currentTarget.dataset.tab;
        const body = this.template.querySelector('.modal-body');
        if (body) body.scrollTop = 0;
    }

    // ── Computed: tab button classes ──────────────────────────────────────────
    get tab1Class() { return this.activeTab === 'terms'   ? 'tab-active' : ''; }
    get tab2Class() { return this.activeTab === 'privacy' ? 'tab-active' : ''; }
    get tab3Class() { return this.activeTab === 'data'    ? 'tab-active' : ''; }
    get tab4Class() { return this.activeTab === 'partner' ? 'tab-active' : ''; }

    // ── Computed: active tab booleans used in template if:true ────────────────
    get isTabTerms()   { return this.activeTab === 'terms';   }
    get isTabPrivacy() { return this.activeTab === 'privacy'; }
    get isTabData()    { return this.activeTab === 'data';    }
    get isTabPartner() { return this.activeTab === 'partner'; }
}