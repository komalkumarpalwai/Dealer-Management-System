import { LightningElement, wire, track } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getOrderDetails from '@salesforce/apex/OrderPage.getOrderDetails';
import getPaymentsByOrder from '@salesforce/apex/OrderPayments.getPaymentsByOrder';
import createPayment from '@salesforce/apex/OrderPayments.createPayment';
import getUserAccount from '@salesforce/apex/OrderPage.getUserAccount';
import updateShippingAddress from '@salesforce/apex/OrderPage.updateShippingAddress';

export default class OrderDetailsPage extends NavigationMixin(LightningElement) {
    
    orderId;
    orderDetails = null;
    lineItems = [];
    orderPayments = [];
    isLoading = true;
    hasError = false;
    errorMessage = '';
    showPaymentHistory = false;
    @track isDeliveryDelayedFlag = false;
    deliveryDateCalculated = '';
    
    // Account Modal State
    showAccountModal = false;
    isEditingAddress = false;
    accountData = {
        BusinessName: '',
        Email: '',
        Phone: '',
        BrandName: '',
        ShippingStreet: '',
        ShippingCity: '',
        ShippingState: '',
        ShippingPostalCode: '',
        ShippingCountry: ''
    };
    accountId = null;
    accountName = '';
    
    // Payment Modal State
    showPaymentModal = false;
    selectedPaymentMethod = '';
    isSubmittingPayment = false;
    
    // Payment Form Data
    paymentFormData = {
        amount: '',
        cashReceivedBy: '',
        cashReceiptNumber: '',
        notes: '',
        upiId: '',
        upiName: '',
        upiAppName: '',
        upiReferenceNumber: '',
        cardHolderName: '',
        cardNumber: '',
        cardType: '',
        bankName: '',
        accountNumber: '',
        ifscCode: '',
        transferReferenceNumber: ''
    };

    // Formatted payment history
    formattedPaymentHistory = [];
    formattedLineItems = [];
    formattedOrderTotal = '';
    formattedSelectedCreatedDate = '';

    @wire(getUserAccount)
    wiredUserAccount({ error, data }) {
        if (data) {
            this.accountId = data.accountId;
            this.accountName = data.accountName;
            
            // Populate account data
            this.accountData = {
                BusinessName: data.businessName || '-',
                Email: data.email || '-',
                Phone: data.phone || '-',
                BrandName: data.brandname || '-',
                ShippingStreet: data.billingStreet || '',
                ShippingCity: data.billingCity || '',
                ShippingState: data.billingState || '',
                ShippingPostalCode: data.billingPostalCode || '',
                ShippingCountry: data.billingCountry || ''
            };
        } else if (error) {
            console.error('Error loading account:', error);
        }
    }

    connectedCallback() {
        this.getOrderIdFromUrl();
        if (this.orderId) {
            this.loadOrderDetails();
            this.loadPaymentHistory();
        } else {
            this.hasError = true;
            this.errorMessage = 'Order ID not found in URL. Please navigate back and try again.';
            this.isLoading = false;
        }
    }

    /**
     * Handle delivery date calculated event from child component
     */
    handleDeliveryDateCalculated(event) {
        const expectedDate = event.detail.expectedDate;
        if (expectedDate) {
            // Format the delivery date for display
            this.deliveryDateCalculated = this.formatDate(expectedDate);
            this.checkDeliveryDelayStatus(expectedDate);
        }
    }

    /**
     * Extracts orderId from the URL query parameter
     * Expected format: /order-details?orderId=801xxxx
     */
    getOrderIdFromUrl() {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            this.orderId = urlParams.get('orderId');
        } catch (error) {
            console.error('Error parsing URL parameters:', error);
            this.hasError = true;
            this.errorMessage = 'Error reading order ID from URL.';
        }
    }

    /**
     * Load order details from Apex
     */
    loadOrderDetails() {
        this.isLoading = true;
        this.hasError = false;

        getOrderDetails({ orderId: this.orderId })
            .then(result => {
                if (result.success) {
                    this.orderDetails = result.order;
                    this.lineItems = result.lineItems || [];
                    this.formatOrderData();
                    this.isLoading = false;
                } else {
                    this.hasError = true;
                    this.errorMessage = result.message || 'Unable to load order details.';
                    this.isLoading = false;
                }
            })
            .catch(error => {
                console.error('Error loading order details:', error);
                this.hasError = true;
                this.errorMessage = 'An error occurred while loading the order. Please try again.';
                this.isLoading = false;
            });
    }

    /**
     * Load payment history for the order
     */
    loadPaymentHistory() {
        getPaymentsByOrder({ orderId: this.orderId })
            .then(result => {
                if (result && result.success) {
                    this.orderPayments = result.payments || [];
                    this.formatPaymentHistory();
                }
            })
            .catch(error => {
                console.error('Error loading payment history:', error);
                // Non-critical error, don't block the page
            });
    }

    /**
     * Format order data for display
     */
    formatOrderData() {
        if (!this.orderDetails) return;

        // Format total amount
        const totalAmount = this.orderDetails.TotalAmount || 0;
        this.formattedOrderTotal = this.formatCurrency(totalAmount);

        // Format created date
        if (this.orderDetails.CreatedDate) {
            const createdDate = new Date(this.orderDetails.CreatedDate);
            this.formattedSelectedCreatedDate = createdDate.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        }

        // Format line items
        this.formattedLineItems = this.lineItems.map(item => {
            return {
                ...item,
                formattedUnitPrice: this.formatCurrency(item.UnitPrice),
                formattedTotalPrice: this.formatCurrency(item.TotalPrice)
            };
        });
    }

    /**
     * Format payment history for display
     */
    formatPaymentHistory() {
        this.formattedPaymentHistory = this.orderPayments.map(payment => {
            return {
                ...payment,
                formattedAmount: this.formatCurrency(payment.Amount__c),
                formattedPaymentDate: payment.CreatedDate ? 
                    new Date(payment.CreatedDate).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                    }) : '-'
            };
        });
    }

    /**
     * Format number as currency
     */
    formatCurrency(amount) {
        if (!amount) return '$0.00';
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount);
    }

    /**
     * Format date with day of week and month/day
     * Example: "Thursday, Oct 24"
     */
    formatDate(dateValue) {
        if (!dateValue) return '';
        try {
            const date = new Date(dateValue);
            const options = { 
                weekday: 'long',
                month: 'short',
                day: 'numeric'
            };
            return date.toLocaleDateString('en-US', options);
        } catch (error) {
            console.error('Error formatting date:', error);
            return '';
        }
    }

    /**
     * Navigate back to order list
     */
    handleBackToOrders() {
         window.location.assign('https://orgfarm-eee69b4d17-dev-ed.develop.my.site.com/PartnerCommunity/s/Orders');
    }

    /**
     * Show/hide payment history
     */
    handleTogglePaymentHistory() {
        this.showPaymentHistory = !this.showPaymentHistory;
    }

    /**
     * Open payment modal
     */
    handleOpenPaymentModal() {
        this.showPaymentModal = true;
        this.selectedPaymentMethod = '';
        this.resetPaymentForm();
    }

    /**
     * Close payment modal
     */
    handleClosePaymentModal() {
        this.showPaymentModal = false;
        this.selectedPaymentMethod = '';
        this.resetPaymentForm();
        this.isSubmittingPayment = false;
    }

    /**
     * Handle modal content click to prevent closing modal
     */
    handleModalContentClick(event) {
        event.stopPropagation();
    }

    /**
     * Open account modal
     */
    handleOpenAccountModal() {
        this.showAccountModal = true;
    }

    /**
     * Close account modal
     */
    handleCloseAccountModal() {
        this.showAccountModal = false;
        this.isEditingAddress = false;
    }

    /**
     * Toggle address edit mode
     */
    handleToggleEditMode() {
        this.isEditingAddress = !this.isEditingAddress;
    }

    /**
     * Handle address field changes
     */
    handleAddressFieldChange(event) {
        const field = event.currentTarget.dataset.field;
        const value = event.currentTarget.value;
        this.accountData = {
            ...this.accountData,
            [field]: value
        };
    }

    /**
     * Save shipping address
     */
    handleSaveAddress() {
        updateShippingAddress({
            accountId: this.accountId,
            shippingStreet: this.accountData.ShippingStreet,
            shippingCity: this.accountData.ShippingCity,
            shippingState: this.accountData.ShippingState,
            shippingPostalCode: this.accountData.ShippingPostalCode,
            shippingCountry: this.accountData.ShippingCountry
        })
        .then(result => {
            if (result.success) {
                // Update the local account data with the response
                this.accountData = {
                    ...this.accountData,
                    ShippingStreet: result.billingStreet,
                    ShippingCity: result.billingCity,
                    ShippingState: result.billingState,
                    ShippingPostalCode: result.billingPostalCode,
                    ShippingCountry: result.billingCountry
                };
                
                // Show success message
                this.showToast('success', 'Address Updated', 'Shipping address has been updated successfully!');
                this.isEditingAddress = false;
            } else {
                this.showToast('error', 'Update Failed', result.message || 'Failed to update address');
            }
        })
        .catch(error => {
            console.error('Error saving address:', error);
            this.showToast('error', 'Error', 'An error occurred while updating the address');
        });
    }

    /**
     * Handle account modal content click
     */
    handleAccountModalContentClick(event) {
        event.stopPropagation();
    }

    /**
     * Payment method selection
     */
    handlePaymentMethodSelect(event) {
        this.selectedPaymentMethod = event.currentTarget.dataset.method;
    }

    /**
     * Handle payment form field changes
     */
    handlePaymentFormChange(event) {
        const fieldName = event.target.dataset.field;
        const value = event.target.value;
        this.paymentFormData = {
            ...this.paymentFormData,
            [fieldName]: value
        };
    }

    /**
     * Validate payment form based on payment method
     */
    validatePaymentForm() {
        if (!this.paymentFormData.amount || this.paymentFormData.amount <= 0) {
            return 'Please enter a valid amount';
        }

        switch (this.selectedPaymentMethod) {
            case 'Cash':
                if (!this.paymentFormData.cashReceivedBy) {
                    return 'Please enter Cash Received By';
                }
                if (!this.paymentFormData.cashReceiptNumber) {
                    return 'Please enter Cash Receipt Number';
                }
                break;

            case 'UPI':
                if (!this.paymentFormData.upiId) {
                    return 'Please enter UPI ID';
                }
                if (!this.paymentFormData.upiName) {
                    return 'Please enter UPI Name';
                }
                break;

            case 'Card':
                if (!this.paymentFormData.cardHolderName) {
                    return 'Please enter Card Holder Name';
                }
                if (!this.paymentFormData.cardNumber) {
                    return 'Please enter Card Number';
                }
                if (!this.paymentFormData.cardType) {
                    return 'Please select Card Type';
                }
                break;

            case 'Bank Transfer':
                if (!this.paymentFormData.bankName) {
                    return 'Please enter Bank Name';
                }
                if (!this.paymentFormData.accountNumber) {
                    return 'Please enter Account Number';
                }
                if (!this.paymentFormData.ifscCode) {
                    return 'Please enter IFSC Code';
                }
                break;
        }

        return null;
    }

    /**
     * Generate unique transaction ID
     */
    generateTransactionId(paymentMethod) {
        const prefix = paymentMethod === 'Bank Transfer' ? 'BANK' : paymentMethod.substring(0, 3).toUpperCase();
        const timestamp = Date.now();
        const randomPart = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
        return `${prefix}-${timestamp}-${randomPart}`;
    }

    /**
     * Submit payment
     */
    handlePaymentSubmit() {
        if (!this.selectedPaymentMethod) {
            this.showToast('error', 'Payment Method Required', 'Please select a payment method');
            return;
        }

        const validationError = this.validatePaymentForm();
        if (validationError) {
            this.showToast('error', 'Validation Error', validationError);
            return;
        }

        this.isSubmittingPayment = true;

        // Generate transaction ID for digital methods
        if (this.selectedPaymentMethod === 'UPI' || this.selectedPaymentMethod === 'Card' || this.selectedPaymentMethod === 'Bank Transfer') {
            this.paymentFormData.transactionId = this.generateTransactionId(this.selectedPaymentMethod);
        }

        const paymentData = {
            orderId: this.orderId,
            accountId: this.accountId,
            amount: parseFloat(this.paymentFormData.amount),
            paymentMethod: this.selectedPaymentMethod,
            formData: { ...this.paymentFormData }
        };

        createPayment({ paymentData })
            .then(result => {
                this.isSubmittingPayment = false;
                if (result.success) {
                    this.showToast('success', 'Payment Recorded', `Payment of ${this.formatCurrency(paymentData.amount)} via ${this.selectedPaymentMethod} has been recorded successfully`);
                    
                    // Reload order details and payments
                    this.loadOrderDetails();
                    this.loadPaymentHistory();
                    
                    // Close modal
                    this.handleClosePaymentModal();
                } else {
                    this.showToast('error', 'Payment Error', result.message || 'An error occurred while recording the payment');
                }
            })
            .catch(error => {
                this.isSubmittingPayment = false;
                console.error('Error creating payment:', error);
                const errorMsg = error.body?.message || 'An error occurred while recording the payment';
                this.showToast('error', 'Payment Error', errorMsg);
            });
    }

    /**
     * Show toast notification
     */
    showToast(variant, title, message) {
        const event = new ShowToastEvent({
            title: title,
            message: message,
            variant: variant
        });
        this.dispatchEvent(event);
    }

    /**
     * Reset payment form
     */
    resetPaymentForm() {
        this.paymentFormData = {
            amount: '',
            cashReceivedBy: '',
            cashReceiptNumber: '',
            notes: '',
            upiId: '',
            upiName: '',
            upiAppName: '',
            upiReferenceNumber: '',
            cardHolderName: '',
            cardNumber: '',
            cardType: '',
            bankName: '',
            accountNumber: '',
            ifscCode: '',
            transferReferenceNumber: ''
        };
    }

    /**
     * Check if order payment is fulfilled
     */
    get isOrderFulfilled() {
        if (!this.orderDetails) return false;
        const outstandingAmount = this.orderDetails.Outstanding_Amount__c || 0;
        return outstandingAmount === 0;
    }

    /**
     * Check if order is Activated
     */
    get isOrderActivated() {
        if (!this.orderDetails) return false;
        return this.orderDetails.Status === 'Activated';
    }

    /**
     * Check if address can be edited
     */
    get canEditAddress() {
        return !this.isOrderActivated;
    }

    /**
     * Get formatted activated date
     */
    get orderActivatedDate() {
        if (!this.orderDetails || !this.orderDetails.Order_Activated_Date__c) {
            return '-';
        }
        const activatedDate = new Date(this.orderDetails.Order_Activated_Date__c);
        return activatedDate.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    /**
     * Get payment status text
     */
    get paymentStatusText() {
        if (this.isOrderFulfilled) {
            return 'Completed';
        }
        return 'Processing verification';
    }

    /**
     * Get payment status badge
     */
    get paymentStatusBadge() {
        if (this.isOrderFulfilled) {
            return 'PAID';
        }
        return 'NOT PAID';
    }

    /**
     * Get payment status badge class
     */
    get paymentStatusBadgeClass() {
        if (this.isOrderFulfilled) {
            return 'status-badge status-badge-paid';
        }
        return 'status-badge status-badge-unpaid';
    }

    /**
     * Get delivery status text
     */
    get deliveryStatusText() {
        if (!this.isOrderActivated) {
            return 'Delivery Not Initiated Yet';
        }
        if (this.isDeliveryDelayedFlag) {
            return 'Delayed';
        }
        return 'Arriving soon';
    }

    /**
     * Get delivery status badge
     */
    get deliveryStatusBadge() {
        if (!this.isOrderActivated) {
            return 'PENDING';
        }
        if (this.isDeliveryDelayedFlag) {
            return 'DELAYED';
        }
        return 'IN TRANSIT';
    }

    /**
     * Get delivery status badge class
     */
    get deliveryStatusBadgeClass() {
        if (!this.isOrderActivated) {
            return 'status-badge status-badge-pending';
        }
        if (this.isDeliveryDelayedFlag) {
            return 'status-badge status-badge-delayed';
        }
        return 'status-badge status-badge-transit';
    }

    /**
     * Get tracking stage icon class for Ordered
     */
    get trackedOrderedStageIcon() {
        return 'tracking-icon tracking-icon-completed';
    }

    /**
     * Get tracking stage icon class for Activated
     */
    get trackedActivatedStageIcon() {
        if (this.orderActivatedDate && this.orderActivatedDate !== '-') {
            return 'tracking-icon tracking-icon-completed';
        }
        return 'tracking-icon tracking-icon-pending';
    }

    /**
     * Get tracking stage icon class for Payment
     */
    get trackedPaymentStageIcon() {
        if (this.isOrderFulfilled) {
            return 'tracking-icon tracking-icon-completed';
        }
        return 'tracking-icon tracking-icon-processing';
    }

    /**
     * Get tracking stage icon class for Delivery
     */
    get trackedDeliveryStageIcon() {
        if (!this.isOrderActivated) {
            return 'tracking-icon tracking-icon-pending';
        }
        if (this.isDeliveryDelayedFlag) {
            return 'tracking-icon tracking-icon-processing';
        }
        return 'tracking-icon tracking-icon-completed';
    }

    /**
     * Check if payment button should be shown
     */
    get shouldShowPaymentButton() {
        if (!this.orderDetails) return false;
        // Show payment button only if:
        // 1. Order is Activated
        // 2. Outstanding amount is greater than 0
        const isActivated = this.orderDetails.Status === 'Activated';
        const outstandingAmount = this.orderDetails.Outstanding_Amount__c || 0;
        return isActivated && outstandingAmount > 0;
    }

    /**
     * Check if cash fields should be shown
     */
    get showCashFields() {
        return this.selectedPaymentMethod === 'Cash';
    }

    /**
     * Check if UPI fields should be shown
     */
    get showUPIFields() {
        return this.selectedPaymentMethod === 'UPI';
    }

    /**
     * Check if card fields should be shown
     */
    get showCardFields() {
        return this.selectedPaymentMethod === 'Card';
    }

    /**
     * Check if bank transfer fields should be shown
     */
    get showBankTransferFields() {
        return this.selectedPaymentMethod === 'Bank Transfer';
    }

    /**
     * Check if amount field should be shown
     */
    get showAmountField() {
        return this.selectedPaymentMethod !== '';
    }

    /**
     * Get shipping address from account
     */
    get shippingAddress() {
        if (!this.orderDetails || !this.orderDetails.Account) {
            return null;
        }
        return this.orderDetails.Account;
    }

    /**
     * Get outstanding amount formatted
     */
    get formattedOutstandingAmount() {
        const amount = this.orderDetails?.Outstanding_Amount__c || 0;
        return this.formatCurrency(amount);
    }

    /**
     * Get amount paid formatted
     */
    get formattedAmountPaid() {
        const amount = this.orderDetails?.Amount_Paid_From_Payments__c || 0;
        return this.formatCurrency(amount);
    }

    /**
     * Get status badge CSS class
     */
    get statusClass() {
        if (!this.orderDetails) return '';
        return `status-${this.orderDetails.Status.toLowerCase()}`;
    }

    /**
     * Check if delivery is delayed
     */
    get isDeliveryDelayed() {
        return this.isDeliveryDelayedFlag;
    }

    /**
     * Check if delivery date indicates a delay
     */
    checkDeliveryDelayStatus(expectedDate) {
        try {
            if (!expectedDate) {
                return;
            }

            // Normalize dates to compare only the date portion
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const expectedDateNormalized = new Date(expectedDate);
            expectedDateNormalized.setHours(0, 0, 0, 0);

            // Delayed if expected date is before or equal to today
            const isDelayed = expectedDateNormalized <= today;
            
            if (isDelayed !== this.isDeliveryDelayedFlag) {
                this.isDeliveryDelayedFlag = isDelayed;
                console.log('✓ Delivery Status: ' + (isDelayed ? 'DELAYED' : 'ON TIME'), 
                           'Expected:', expectedDateNormalized, 'Today:', today);
            }
        } catch (error) {
            console.error('Error checking delivery delay:', error);
        }
    }

    /**
     * Handle raise support ticket
     */
    handleRaiseTicket() {
        this.showToast('info', 'Support Ticket', 'Please navigate to the Support section to raise a ticket or contact our support team for more information.');
    }
}