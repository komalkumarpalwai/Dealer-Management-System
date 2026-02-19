import { LightningElement } from 'lwc';
import createPartnerApplication from '@salesforce/apex/PartnerApplicationController.createPartnerApplication';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class PartnerRegistration extends LightningElement {
    businessName = '';
    businessType = '';
    brandName = '';
    gstNumber = '';
    panNumber = '';
    annualRevenue = null;
    primaryContactName = '';
    email = '';
    phone = '';
    address = '';

    successMessage;
    errorMessage;

    isLoading = false;
    isSubmitted = false;

    businessTypeOptions = [
        { label: 'Dealer', value: 'Dealer' },
        { label: 'Distributor', value: 'Distributor' },
        { label: 'Retailer', value: 'Retailer' },
        { label: 'OEM', value: 'OEM' },
         { label: 'Customer', value: 'Customer' }
    ];

    handleChange(event) {
        const field = event.target.dataset.field;
        this[field] = event.target.value;
    }

    validateForm() {
        const inputs = this.template.querySelectorAll('lightning-input, lightning-combobox, lightning-textarea');
        return [...inputs].reduce((validSoFar, inputCmp) => {
            inputCmp.reportValidity();
            return validSoFar && inputCmp.checkValidity();
        }, true);
    }

    async handleSubmit() {
        // client-side validation
        if (!this.validateForm()) {
            this.showToast('Validation error', 'Please fix the highlighted fields before submitting.', 'error');
            return;
        }

        this.isLoading = true;
        try {
            const result = await createPartnerApplication({
                businessName: this.businessName,
                businessType: this.businessType,
                brandName: this.brandName,
                gstNumber: this.gstNumber,
                panNumber: this.panNumber,
                annualRevenue: this.annualRevenue,
                primaryContactName: this.primaryContactName,
                email: this.email,
                phone: this.phone,
                address: this.address
            });

            if (result === 'SUCCESS') {
                this.successMessage = 'Application submitted successfully!';
                this.errorMessage = null;
                this.showToast('Success', 'Application submitted successfully!', 'success');
                this.clearForm();
                this.isSubmitted = true;
            } else {
                this.errorMessage = result || 'Failed to submit application';
                this.successMessage = null;
                this.showToast('Error', this.errorMessage, 'error');
            }
        } catch (error) {
            const message = (error && error.body && error.body.message) ? error.body.message : (error.message || 'Unknown error');
            this.errorMessage = message;
            this.successMessage = null;
            this.showToast('Error', message, 'error');
        } finally {
            this.isLoading = false;
        }
    }

    clearForm() {
        this.businessName = '';
        this.businessType = '';
        this.brandName = '';
        this.gstNumber = '';
        this.panNumber = '';
        this.annualRevenue = null;
        this.primaryContactName = '';
        this.email = '';
        this.phone = '';
        this.address = '';

        // clear validity UI
        const inputs = this.template.querySelectorAll('lightning-input, lightning-combobox, lightning-textarea');
        inputs.forEach(i => i.setCustomValidity(''));
    }

    handleCreateAnother() {
        this.isSubmitted = false;
        this.clearForm();
        this.successMessage = null;
        this.errorMessage = null;
    }

    showToast(title, message, variant = 'info') {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }
}
