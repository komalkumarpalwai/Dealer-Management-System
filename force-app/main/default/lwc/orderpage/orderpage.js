import { LightningElement, wire } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import getAccountOrders from '@salesforce/apex/OrderPage.getAccountOrders';
import getOrderDetails from '@salesforce/apex/OrderPage.getOrderDetails';
import getUserAccount from '@salesforce/apex/OrderPage.getUserAccount';
import updateShippingAddress from '@salesforce/apex/OrderPage.updateShippingAddress';
import getOrderSummary from '@salesforce/apex/OrderPage.getOrderSummary';
import getOrderTrends from '@salesforce/apex/OrderPage.getOrderTrends';
import getTopProducts from '@salesforce/apex/OrderPage.getTopProducts';
import getOrderStatusBreakdown from '@salesforce/apex/OrderPage.getOrderStatusBreakdown';

export default class OrdersList extends NavigationMixin(LightningElement) {
    
    accountId;
    accountName;
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
    allOrders = [];
    currentOrder = null;
    previousOrders = [];
    isLoading = true;
    selectedOrderId = null;
    selectedOrderDetails = null;
    showOrderDetails = false;
    showAccountModal = false;
    isEditingAddress = false;
    searchTerm = '';
    dateSort = 'newest'; // 'newest' or 'oldest'
    showAllPreviousOrders = false; // Toggle to show all orders

    // Dashboard data
    orderSummary = {
        totalOrders: 0,
        pendingOrders: 0,
        totalSpentThisMonth: 0,
        averageOrderValue: 0
    };
    statusBreakdown = {};
    topProductsList = [];
    orderTrends = [];

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
            
            if (this.accountId) {
                this.loadOrders();
            }
        } else if (error) {
            console.error('Error loading user account:', error);
            this.isLoading = false;
        }
    }

    loadOrders() {
        if (!this.accountId) return;

        getAccountOrders({ accountId: this.accountId })
            .then(result => {
                if (result.success && result.orders) {
                    this.allOrders = result.orders;
                    
                    // Sort by CreatedDate descending (newest first)
                    this.allOrders.sort((a, b) => {
                        const dateA = new Date(a.CreatedDate);
                        const dateB = new Date(b.CreatedDate);
                        return dateB - dateA;
                    });

                    // First order is the current/most recent order
                    if (this.allOrders.length > 0) {
                        this.currentOrder = this.allOrders[0];
                        this.previousOrders = this.allOrders.slice(1);
                        
                        // Load details for current order
                        this.loadOrderDetails(this.currentOrder.Id);
                    } else {
                        this.previousOrders = [];
                    }
                    
                    // Load dashboard data
                    this.loadDashboardData();
                }
                this.isLoading = false;
            })
            .catch(error => {
                console.error('Error fetching orders:', error);
                this.isLoading = false;
            });
    }


    loadDashboardData() {
        getOrderSummary({ accountId: this.accountId })
            .then(result => {
                if (result.success) {
                    this.orderSummary = {
                        totalOrders: result.totalOrders,
                        pendingOrders: result.pendingOrders,
                        totalSpentThisMonth: result.totalSpentThisMonth,
                        averageOrderValue: result.averageOrderValue
                    };
                }
            })
            .catch(error => console.error('Error loading order summary:', error));

        getOrderStatusBreakdown({ accountId: this.accountId })
            .then(result => {
                if (result.success) {
                    this.statusBreakdown = result.statusBreakdown;
                }
            })
            .catch(error => console.error('Error loading status breakdown:', error));

        getTopProducts({ accountId: this.accountId })
            .then(result => {
                if (result.success && result.products) {
                    this.topProductsList = result.products.map((product, index) => ({
                        ...product,
                        rank: index + 1
                    }));
                }
            })
            .catch(error => console.error('Error loading top products:', error));

        getOrderTrends({ accountId: this.accountId })
            .then(result => {
                if (result.success) {
                    this.orderTrends = result.trends;
                }
            })
            .catch(error => console.error('Error loading order trends:', error));
    }

    loadOrderDetails(orderId) {
        getOrderDetails({ orderId })
            .then(result => {
                if (result.success) {
                    this.selectedOrderDetails = {
                        ...result.order,
                        lineItems: result.lineItems || []
                    };
                    this.selectedOrderId = orderId;
                }
            })
            .catch(error => {
                console.error('Error loading order details:', error);
            });
    }

    handleViewOrderDetails(event) {
        const orderId = event.currentTarget.dataset.orderId;
        this.loadOrderDetails(orderId);
        this.showOrderDetails = true;
        
        // Scroll to details section
        setTimeout(() => {
            const detailsSection = this.template.querySelector('.order-details-section');
            if (detailsSection) {
                detailsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 100);
    }

    handleCloseDetails() {
        this.showOrderDetails = false;
    }

    handleSearchChange(event) {
        this.searchTerm = event.target.value.trim();
        
        // Scroll to results after search
        if (this.searchTerm) {
            setTimeout(() => {
                const previousOrdersSection = this.template.querySelector('.previous-orders-section');
                if (previousOrdersSection) {
                    previousOrdersSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }, 100);
        }
    }

    handlePriceFilter(event) {
        this.priceSort = event.currentTarget.dataset.filter;
    }

    handleStatusFilter(event) {
        this.statusFilter = event.currentTarget.dataset.status;
    }

    handleDateFilter(event) {
        this.dateSort = event.currentTarget.dataset.filter;
    }

    handleOpenAccountModal() {
        this.showAccountModal = true;
    }

    handleCloseAccountModal() {
        this.showAccountModal = false;
        this.isEditingAddress = false;
    }

    handleModalContentClick(event) {
        // Prevent closing modal when clicking inside the modal content
        event.stopPropagation();
    }

    handleToggleEditMode() {
        this.isEditingAddress = !this.isEditingAddress;
    }

    handleAddressFieldChange(event) {
        const field = event.currentTarget.dataset.field;
        const value = event.currentTarget.value;
        this.accountData = {
            ...this.accountData,
            [field]: value
        };
    }

    handleSaveAddress() {
        // Call Apex method to update shipping address
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
                alert('✅ Shipping address updated successfully!');
                this.isEditingAddress = false;
            } else {
                // Show error message
                alert('❌ Error: ' + result.message);
            }
        })
        .catch(error => {
            console.error('Error updating billing address:', error);
            alert('❌ Error updating billing address: ' + error.body.message);
        });
    }

    handleContinueShopping() {
        // Navigate to Products Page
        this[NavigationMixin.Navigate]({
            type: 'standard__component',
            attributes: {
                componentName: 'c__productsPage'
            }
        });
    }

    handleViewAllOrders() {
        this.showAllPreviousOrders = true;
    }

    handleCollapsePreviousOrders() {
        this.showAllPreviousOrders = false;
        // Scroll to the previous orders section
        const prevOrdersSection = this.template.querySelector('.previous-orders-section');
        if (prevOrdersSection) {
            prevOrdersSection.scrollIntoView({ behavior: 'smooth' });
        }
    }

    get hasCurrentOrder() {
        return this.currentOrder && this.currentOrder.Id;
    }

    get hasPreviousOrders() {
        return this.previousOrders && this.previousOrders.length > 0;
    }

    get formattedCurrentOrderTotal() {
        if (!this.currentOrder || !this.currentOrder.TotalAmount) return '₹0.00';
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR'
        }).format(this.currentOrder.TotalAmount);
    }

    get formattedOrderTotal() {
        if (!this.selectedOrderDetails || !this.selectedOrderDetails.TotalAmount) return '₹0.00';
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR'
        }).format(this.selectedOrderDetails.TotalAmount);
    }

    get statusBadgeClass() {
        if (!this.currentOrder) return '';
        const status = this.currentOrder.Status?.toLowerCase();
        if (status === 'activated') return 'status-activated';
        if (status === 'draft') return 'status-draft';
        if (status === 'closed') return 'status-closed';
        return 'status-default';
    }

    get formattedCurrentCreatedDate() {
        return this.currentOrder ? this.formatDate(this.currentOrder.CreatedDate) : '-';
    }

    get formattedSelectedCreatedDate() {
        return this.selectedOrderDetails ? this.formatDate(this.selectedOrderDetails.CreatedDate) : '-';
    }

    get formattedLineItems() {
        if (!this.selectedOrderDetails || !this.selectedOrderDetails.lineItems) return [];
        return this.selectedOrderDetails.lineItems.map(item => ({
            ...item,
            formattedUnitPrice: this.formatCurrency(item.UnitPrice),
            formattedTotalPrice: this.formatCurrency(item.TotalPrice)
        }));
    }

    get formattedPreviousOrders() {
        let filteredOrders = this.previousOrders;

        // Search filter
        if (this.searchTerm) {
            const searchLower = this.searchTerm.toLowerCase();
            filteredOrders = filteredOrders.filter(order => {
                const orderNumber = order.OrderNumber ? order.OrderNumber.toLowerCase() : '';
                const orderId = order.Id ? order.Id.toLowerCase() : '';
                return orderNumber.includes(searchLower) || orderId.includes(searchLower);
            });
        }

        // Default: newest first
        filteredOrders.sort((a, b) => {
            const dateA = new Date(a.CreatedDate);
            const dateB = new Date(b.CreatedDate);
            return dateB - dateA;
        });

        return filteredOrders.map(order => ({
            ...order,
            formattedCreatedDate: this.formatDate(order.CreatedDate),
            formattedTotalAmount: this.formatCurrency(order.TotalAmount)
        }));
    }

    get displayedPreviousOrders() {
        const allFormatted = this.formattedPreviousOrders;
        
        // Show all orders if toggle is on, otherwise show limited set
        if (this.showAllPreviousOrders) {
            return allFormatted;
        } else {
            // Show first 8 orders
            return allFormatted.slice(0, 8);
        }
    }

    get shouldShowViewAllButton() {
        return this.formattedPreviousOrders.length > 8 && !this.showAllPreviousOrders;
    }

    get shouldShowCollapseButton() {
        return this.showAllPreviousOrders;
    }

    formatDate(dateString) {
        if (!dateString) return '-';
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('en-IN', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(date);
    }

    formatCurrency(value) {
        if (!value) return '₹0.00';
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR'
        }).format(value);
    }

    priceFilterButtonClass(filter) {
        const baseClass = 'filter-btn';
        return this.priceSort === filter ? `${baseClass} active` : baseClass;
    }

    statusFilterButtonClass(status) {
        const baseClass = 'filter-btn';
        return this.statusFilter === status ? `${baseClass} active` : baseClass;
    }

    dateFilterButtonClass(filter) {
        const baseClass = 'filter-btn';
        return this.dateSort === filter ? `${baseClass} active` : baseClass;
    }

    get priceHighToLowClass() {
        const baseClass = 'filter-btn';
        return this.priceSort === 'high-to-low' ? `${baseClass} active` : baseClass;
    }

    get priceLowToHighClass() {
        const baseClass = 'filter-btn';
        return this.priceSort === 'low-to-high' ? `${baseClass} active` : baseClass;
    }

    get statusDraftClass() {
        const baseClass = 'filter-btn';
        return this.statusFilter === 'draft' ? `${baseClass} active` : baseClass;
    }

    get statusActiveClass() {
        const baseClass = 'filter-btn';
        return this.statusFilter === 'active' ? `${baseClass} active` : baseClass;
    }

    get statusAllClass() {
        const baseClass = 'filter-btn';
        return this.statusFilter === 'all' ? `${baseClass} active` : baseClass;
    }

    get dateNewestClass() {
        const baseClass = 'filter-btn';
        return this.dateSort === 'newest' ? `${baseClass} active` : baseClass;
    }

    get dateOldestClass() {
        const baseClass = 'filter-btn';
        return this.dateSort === 'oldest' ? `${baseClass} active` : baseClass;
    }

    get filteredOrdersCount() {
        return this.formattedPreviousOrders.length;
    }

    get formattedMonthlySpent() {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR'
        }).format(this.orderSummary.totalSpentThisMonth || 0);
    }

    get formattedAvgOrderValue() {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR'
        }).format(this.orderSummary.averageOrderValue || 0);
    }

    get statusBreakdownList() {
        if (!this.statusBreakdown || Object.keys(this.statusBreakdown).length === 0) return [];

        const total = Object.values(this.statusBreakdown).reduce((sum, count) => sum + count, 0);
        const statusColors = {
            'Draft': '#fbbf24',
            'Activated': '#86efac',
            'Closed': '#fca5a5',
            'Cancelled': '#d1d5db'
        };

        return Object.entries(this.statusBreakdown).map(([status, count]) => {
            const percentage = total > 0 ? (count / total) * 100 : 0;
            return {
                name: status,
                count: count,
                percentage: percentage.toFixed(1),
                color: statusColors[status] || '#667eea',
                progressStyle: `width: ${percentage}%; background-color: ${statusColors[status] || '#667eea'};`
            };
        });
    }

    get topProducts() {
        return this.topProductsList;
    }
}
