import { LightningElement } from 'lwc';
import createPartnerApplication from '@salesforce/apex/PartnerApplicationController.createPartnerApplication';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class PartnerRegistration extends LightningElement {

    // ── Business Information ──────────────────────────────────────────────
    businessName             = '';
    businessType             = '';
    brandName                = '';
    businessRegistrationNumber = '';
    yearStarted              = null;
    yearsInBusiness          = null;

    // ── Financial Information ─────────────────────────────────────────────
    annualRevenue            = null;
    monthlySalesTarget       = null;
    expectedMonthlySales     = null;
    creditLimitRequested     = null;

    // ── Tax Information ───────────────────────────────────────────────────
    gstNumber                = '';
    panNumber                = '';
    tanNumber                = '';

    // ── Contact Information ───────────────────────────────────────────────
    primaryContactName       = '';
    email                    = '';
    phone                    = '';
    accountHolderName        = '';

    // ── Address Information ───────────────────────────────────────────────
    billingAddress           = '';
    warehouseAddress         = '';
    city                     = '';
    district                 = '';
    state                    = '';
    country                  = '';
    pincode                  = '';

    // ── Bank Information ──────────────────────────────────────────────────
    bankName                 = '';
    bankBranch               = '';
    bankAccountNumber        = '';
    ifscCode                 = '';
    upiId                    = '';

    // ── Operational Information ───────────────────────────────────────────
    shopLicenseNumber        = '';
    deliveryVehicles         = null;
    numberOfSalesStaff       = '';
    warehouseSize            = null;

    // ── UI state ──────────────────────────────────────────────────────────
    successMessage  = '';
    errorMessage    = '';
    isLoading       = false;
    isSubmitted     = false;

    // ── Policy modal state ────────────────────────────────────────────────
    isPolicyOpen    = false;
    activeTab       = 'terms';

    // ── Picklist options ──────────────────────────────────────────────────
    businessTypeOptions = [
        { label: 'Dealer',      value: 'Dealer'      },
        { label: 'Distributor', value: 'Distributor' },
        { label: 'Retailer',    value: 'Retailer'    },
        { label: 'OEM',         value: 'OEM'         },
        { label: 'Customer',    value: 'Customer'    }
    ];

    // ── Form handlers ─────────────────────────────────────────────────────
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
                'Validation Error',
                'Please fix the highlighted fields before submitting.',
                'error'
            );
            return;
        }

        this.isLoading = true;

        try {

            const appData = {
                // Business Information
                Business_Name__c                      : this.businessName,
                Business_Type__c                      : this.businessType,
                Brand_Name__c                         : this.brandName,
                AMERP_Business_Registration_Number__c : this.businessRegistrationNumber,
                Year_Started__c                       : this.yearStarted        ? Number(this.yearStarted)        : null,
                Years_in_Business__c                  : this.yearsInBusiness    ? Number(this.yearsInBusiness)    : null,

                // Financial Information
                Annual_Revenue__c                     : this.annualRevenue          ? Number(this.annualRevenue)          : null,
                Monthly_Sales_Target__c               : this.monthlySalesTarget     ? Number(this.monthlySalesTarget)     : null,
                AMERP_Expected_Monthly_Sales__c       : this.expectedMonthlySales   ? Number(this.expectedMonthlySales)   : null,
                Credit_Limit_Requested__c             : this.creditLimitRequested   ? Number(this.creditLimitRequested)   : null,

                // Tax Information
                GST_Number__c                         : this.gstNumber,
                PAN_Number__c                         : this.panNumber,
                AMERP_TAN_Number__c                   : this.tanNumber,

                // Contact Information
                Primary_Contact_Name__c               : this.primaryContactName,
                Email__c                              : this.email,
                Phone__c                              : this.phone,
                Account_Holder_Name__c                : this.accountHolderName,

                // Address Information
                Billing_Address__c                    : this.billingAddress,
                Warehouse_Address__c                  : this.warehouseAddress,
                AMERP_City__c                         : this.city,
                AMERP_District__c                     : this.district,
                AMERP_State__c                        : this.state,
                AMERP_Country__c                      : this.country,
                AMERP_Pincode__c                      : this.pincode,

                // Bank Information
                AMERP_Bank_Name__c                    : this.bankName,
                AMERP_Bank_Branch__c                  : this.bankBranch,
                AMERP_Bank_Account_Number__c          : this.bankAccountNumber,
                AMERP_IFSC_Code__c                    : this.ifscCode,
                AMERP_UPI_ID__c                       : this.upiId,

                // Operational Information
                AMERP_Shop_License_Number__c          : this.shopLicenseNumber,
                AMERP_Delivery_Vehicles__c            : this.deliveryVehicles    ? Number(this.deliveryVehicles)    : null,
                AMERP_Number_of_Sales_Staff__c        : this.numberOfSalesStaff,
                AMERP_Warehouse_Size__c               : this.warehouseSize       ? Number(this.warehouseSize)       : null
            };

            const result = await createPartnerApplication({ appData });

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
        // Business Information
        this.businessName              = '';
        this.businessType              = '';
        this.brandName                 = '';
        this.businessRegistrationNumber = '';
        this.yearStarted               = null;
        this.yearsInBusiness           = null;
        // Financial Information
        this.annualRevenue             = null;
        this.monthlySalesTarget        = null;
        this.expectedMonthlySales      = null;
        this.creditLimitRequested      = null;
        // Tax Information
        this.gstNumber                 = '';
        this.panNumber                 = '';
        this.tanNumber                 = '';
        // Contact Information
        this.primaryContactName        = '';
        this.email                     = '';
        this.phone                     = '';
        this.accountHolderName         = '';
        // Address Information
        this.billingAddress            = '';
        this.warehouseAddress          = '';
        this.city                      = '';
        this.district                  = '';
        this.state                     = '';
        this.country                   = '';
        this.pincode                   = '';
        // Bank Information
        this.bankName                  = '';
        this.bankBranch                = '';
        this.bankAccountNumber         = '';
        this.ifscCode                  = '';
        this.upiId                     = '';
        // Operational Information
        this.shopLicenseNumber         = '';
        this.deliveryVehicles          = null;
        this.numberOfSalesStaff        = '';
        this.warehouseSize             = null;

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

    // ── Policy modal — open / close ───────────────────────────────────────
    handleOpenPolicy() {
        this.isPolicyOpen = true;
        this.activeTab    = 'terms';
        document.body.style.overflow = 'hidden';
    }

    handleClosePolicy() {
        this.isPolicyOpen = false;
        document.body.style.overflow = '';
    }

    handleBackdropClick(event) {
        if (event.target === event.currentTarget) {
            this.handleClosePolicy();
        }
    }

    // ── Policy modal — tabs ───────────────────────────────────────────────
    handleTabChange(event) {
        this.activeTab = event.currentTarget.dataset.tab;
        const body = this.template.querySelector('.modal-body');
        if (body) body.scrollTop = 0;
    }

    // ── Computed: tab button classes ──────────────────────────────────────
    get tab1Class() { return this.activeTab === 'terms'   ? 'tab-active' : ''; }
    get tab2Class() { return this.activeTab === 'privacy' ? 'tab-active' : ''; }
    get tab3Class() { return this.activeTab === 'data'    ? 'tab-active' : ''; }
    get tab4Class() { return this.activeTab === 'partner' ? 'tab-active' : ''; }

    // ── Computed: active tab booleans ─────────────────────────────────────
    get isTabTerms()   { return this.activeTab === 'terms';   }
    get isTabPrivacy() { return this.activeTab === 'privacy'; }
    get isTabData()    { return this.activeTab === 'data';    }
    get isTabPartner() { return this.activeTab === 'partner'; }
}