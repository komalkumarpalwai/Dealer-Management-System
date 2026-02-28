import { LightningElement, wire } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getPageData from '@salesforce/apex/ProductsPageController.getPageData';
import getProductImages from '@salesforce/apex/ProductsPageController.getProductImages';
import createOrderWithLineItems from '@salesforce/apex/OrderPage.createOrderWithLineItems';
import getUserAccountDetails from '@salesforce/apex/OrderPage.getUserAccountDetails';

export default class ProductsPage extends NavigationMixin(LightningElement) {

    user;
    account;
    accountType = '';
    pricebookUsed = '';
    products = [];
    categories = [];
    families = [];
    selectedCategory = '';
    selectedFamily = '';
    searchQuery = '';
    isLoaded = false;
    productCount = 0;
    pageSize = 12;
    currentPage = 1;

    get statusBadgeText() {
        return 'Active';
    }

    get displayAccountType() {
        return this.accountType && this.accountType.trim() ? this.accountType : 'N/A';
    }

    showProductModal = false;
    selectedProduct;
    selectedQuantity = 1;
    userInitials = '';
    showCartPanel = false;
    allProductImages = [];
    selectedImageIndex = 0;

//ADD TO CART JS Functionality
    cartItems = [];
connectedCallback() {
    const savedCart = localStorage.getItem('productsCart');
    if (savedCart) {
        const parsed = JSON.parse(savedCart);

        this.cartItems = parsed.map(item => ({
            ...item,
            total: item.price * item.quantity
        }));
    }
}

saveCartToStorage() {
    localStorage.setItem('productsCart', JSON.stringify(this.cartItems));
}



toggleCartPanel() {
    this.showCartPanel = !this.showCartPanel;
}

closeCartPanel() {
    this.showCartPanel = false;
}

    // Featured product categories with icons
    get categoryItems() {
        const baseCategoryItems = [
            { name: 'Mobiles', icon: '📱', emoji: true },
            { name: 'Laptops', icon: '💻', emoji: true },
            { name: 'AC', icon: '❄️', emoji: true },
            { name: 'Tab', icon: '📱', emoji: true },
            { name: 'All Products', icon: '🛍️', emoji: true }
        ];
        
        // Add isSelected property to each item
        return baseCategoryItems.map(cat => {
            let isSelected = false;
            if (cat.name === 'All Products') {
                isSelected = !this.selectedCategory; // True when no category is selected
            } else {
                isSelected = cat.name === this.selectedCategory;
            }
            return {
                ...cat,
                isSelected
            };
        });
    }

    /* =========================
       DATA LOAD
    ========================== */

    @wire(getPageData)
    wiredPageData({ error, data }) {
        if (data) {
            this.user = data.user || {};
            this.account = data.account || null;
            this.accountType = data.accountType || '';
            this.pricebookUsed = data.pricebookUsed || '';
            const raw = data.products || [];
            this.categories = data.categories || [];
            this.products = raw.map(product => {
                // SVG data URI placeholder when no image available
                const placeholderURL = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"%3E%3Crect fill="%23ddd" width="200" height="200"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999" font-size="14" font-family="sans-serif"%3ENo Image%3C/text%3E%3C/svg%3E';
                const imageUrl = product.ContentVersionId ? `${window.location.origin}/sfc/servlet.shepherd/version/download/${product.ContentVersionId}` : placeholderURL;
                return {
                    ...product,
                    imageUrl,
                    formattedPrice: this.formatCurrency(product.UnitPrice)
                };
            });
            
            // Reset all filters to show all products by default
            this.selectedCategory = '';
            this.selectedFamily = '';
            this.searchQuery = '';
            this.currentPage = 1;
            
            // Keep only the specific categories we want to display
            const desiredCategories = ['Mobiles', 'Laptops', 'AC', 'Tab'];
            const defaultIcons = {
                'Mobiles': '📱',
                'Laptops': '💻',
                'AC': '❄️',
                'Tab': '📱',
                'Phones': '📱',
                'Tablets': '📱',
                'Smartwatches': '⌚',
                'Accessories': '🔌',
                'TVs': '📺',
                'Monitors': '🖥️',
                'Cameras': '📷'
            };
            
            // Extract unique families
            const familiesSet = new Set(this.products.map(p => p.Family).filter(f => f));
            this.families = Array.from(familiesSet).sort();
            this.productCount = this.products.length;
            this.userInitials = this.getInitials(this.user?.Name);
            this.isLoaded = true;
            
            
            this.products.forEach((product, index) => {
                if (index < 3) { // Log first 3 products
                    console.log(`Product: ${product.Name}, Price: ${product.formattedPrice}`);
                }
            });
        } else if (error) {
            console.error('Error loading page data:', error);
            this.isLoaded = true;
        }
    }

    /* =========================
       HELPERS
    ========================== */


    getInitials(name) {
        if (!name) return '';
        return name
            .split(' ')
            .map(word => word[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    }

    formatDate(dateValue) {
        if (!dateValue) return 'N/A';
        return new Date(dateValue).toLocaleDateString('en-IN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

 formatCurrency(value) {
    if (value === null || value === undefined) {
        return 'Price on request';
    }
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR'
    }).format(value);
}


    handleImageError(event) {
        // Use a professional product placeholder image
        const placeholder = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300"%3E%3Crect fill="%23f0f0f0" width="300" height="300"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999" font-size="16" font-family="sans-serif" font-weight="bold"%3EProduct Image%3C/text%3E%3C/svg%3E';
        event.target.src = placeholder;
    }

    /* =========================
       PRODUCT MODAL   select quantity
    ========================== */

   handleViewDetails(event) {
    const productId = event.currentTarget.dataset.productId;
    const product = this.products.find(p => p.Id === productId);

    if (product) {
        this.selectedProduct = {
            ...product,
            formattedCreatedDate: this.formatDate(product.CreatedDate)
        };

        this.selectedQuantity = 1;
        this.selectedImageIndex = 0;
        
        // Fetch all images for this product
        getProductImages({ productId: productId })
            .then(result => {
                this.allProductImages = result || [];
                console.log('Fetched ' + this.allProductImages.length + ' images for product');
                this.showProductModal = true;
            })
            .catch(error => {
                console.error('Error fetching product images:', error);
                this.allProductImages = [];
                this.showProductModal = true;
            });
    }
}


 closeProductModal() {
    this.showProductModal = false;
    this.selectedProduct = null;
    this.selectedQuantity = 1; // reset clean state
    this.allProductImages = [];
    this.selectedImageIndex = 0;
}

// Get main image to display (large image)
get mainProductImage() {
    if (this.allProductImages && this.allProductImages.length > 0) {
        return window.location.origin + this.allProductImages[this.selectedImageIndex].ImageUrl;
    }
    return this.selectedProduct?.imageUrl || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"%3E%3Crect fill="%23ddd" width="200" height="200"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999" font-size="14" font-family="sans-serif"%3ENo Image%3C/text%3E%3C/svg%3E';
}

// Get thumbnail images array
get thumbnailImages() {
    return (this.allProductImages || []).map((img, idx) => ({
        ...img,
        isSelected: idx === this.selectedImageIndex
    }));
}

// Handle image thumbnail click
handleImageThumbnailClick(event) {
    const index = parseInt(event.currentTarget.dataset.index, 10);
    this.selectedImageIndex = index;
}

get userName() {
    return this.user?.Name || '';
}

get hasUserName() {
    return !!this.user?.Name;
}

get accountName() {
    return this.account?.Name || '';
}

get hasAccountName() {
    return !!this.account?.Name;
}

    /* =========================
       ADD TO CART
    ========================== */
handleAddToCart(event) {
    let product;

    const productId = event?.currentTarget?.dataset?.productId;

    if (productId) {
        product = this.products.find(p => p.Id === productId);
    } else {
        product = this.selectedProduct;
    }

    if (!product) return;

    const stock = product.AvailableStock || 0;
console.log('===== STOCK DEBUG START =====');

this.products.forEach((product, index) => {
    if (index < 10) {  // limit to first 10 products
        console.log(
            `Product: ${product.Name} | Id: ${product.Id} | AvailableStock:`,
            product.AvailableStock
        );
    }
});

console.log('===== STOCK DEBUG END =====');

    // 🔴 STOP if out of stock
    if (stock <= 0) {
        alert('This product is out of stock.');
        return;
    }

    const quantity = this.selectedProduct ? this.selectedQuantity : 1;
    console.log('Product Quantity:', quantity);

    const existingItem = this.cartItems.find(
        item => item.productId === product.Id
    );

    if (existingItem) {

        const newQty = existingItem.quantity + quantity;

        if (newQty > stock) {
            alert(`Only ${stock} items available.`);
            existingItem.quantity = stock;
        } else {
            existingItem.quantity = newQty;
        }

        existingItem.total = existingItem.quantity * existingItem.price;

    } else {

        if (quantity > stock) {
            alert(`Only ${stock} items available.`);
            return;
        }

        const newItem = {
            productId: product.Id,
            productName: product.Name,
            quantity: quantity,
            price: product.UnitPrice,
            formattedPrice: product.formattedPrice,
            total: product.UnitPrice * quantity
        };

        this.cartItems = [...this.cartItems, newItem];
    }

    this.saveCartToStorage();

    if (this.showProductModal) {
        this.selectedQuantity = 1;
        this.closeProductModal();
    }

    this.showCartPanel = true;
}


//remove item from cart
removeFromCart(event) {
    const productId = event.currentTarget.dataset.id;

    this.cartItems = this.cartItems.filter(
        item => item.productId !== productId
    );

    this.saveCartToStorage();
}
// calcutae total

get cartTotal() {
    return this.cartItems.reduce((sum, item) => {
        return sum + (item.price * item.quantity);
    }, 0);
}

get formattedCartTotal() {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR'
    }).format(this.cartTotal);
}
get cartToggleLabel() {
    return this.showCartPanel ? '✖ Close Cart' : '🛒 Your Cart';
}
handleBuyNow() {
    if (!this.cartItems || this.cartItems.length === 0) {
        this.showToast('Empty Cart', 'Please add items to your cart before proceeding.', 'error');
        return;
    }

    if (!this.account || !this.account.Id) {
        this.showToast('Error', 'Account information not available. Please refresh the page and try again.', 'error');
        return;
    }

    if (!this.pricebookUsed) {
        this.showToast('Error', 'Pricebook information not available. Please try again.', 'error');
        return;
    }

    // Show loading state
    const buyNowBtn = this.template.querySelector('.buy-now-btn');
    if (buyNowBtn) {
        buyNowBtn.disabled = true;
        buyNowBtn.textContent = 'Processing...';
    }

    // Prepare order items from cart
    const orderItems = this.cartItems.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.price,
        priceBookEntryId: null // Will be resolved on the backend
    }));

    // Prepare the order request
    const orderRequest = {
        accountId: this.account.Id,
        pricebookId: this.pricebookUsed,
        orderName: `Order - ${new Date().toLocaleDateString()}`,
        effectiveDate: new Date().toISOString().split('T')[0],
        status: 'Draft',
        description: 'Order created from product page',
        orderItems: orderItems
    };

    // Call the Apex method to create the order
    createOrderWithLineItems({ orderRequest })
        .then(response => {
            if (response.success) {
                // Clear the cart
                this.cartItems = [];
                this.saveCartToStorage();
                
                // Show success message
                this.showToast('Success', `Order created successfully! Order #${response.orderNumber}`, 'success');
                
                // Close cart panel
                this.closeCartPanel();
                
                // Redirect to the Orders page after a short delay
                setTimeout(() => {
                    this[NavigationMixin.Navigate]({
                        type: 'standard__namedPage',
                        attributes: {
                            pageName: 'Orders'
                        }
                    });
                }, 500);
            } else {
                this.showToast('Error', `Failed to create order: ${response.message}`, 'error');
            }
        })
        .catch(error => {
            console.error('Error creating order:', error);
            const errorMsg = error.body?.message || error.message || 'An unexpected error occurred';
            this.showToast('Error', `Order creation failed: ${errorMsg}`, 'error');
        })
        .finally(() => {
            // Re-enable the button
            const buyNowBtn = this.template.querySelector('.buy-now-btn');
            if (buyNowBtn) {
                buyNowBtn.disabled = false;
                buyNowBtn.textContent = 'Buy Now';
            }
        });
}

showToast(title, message, variant) {
    const evt = new ShowToastEvent({
        title: title,
        message: message,
        variant: variant
    });
    this.dispatchEvent(evt);
}

get hasMrp() {
    return this.selectedProduct?.MaximumRetailPrice;
}

get formattedMrp() {
    if (!this.selectedProduct?.MaximumRetailPrice) return '';
    return this.formatCurrency(this.selectedProduct.MaximumRetailPrice);
}

get formattedPrice() {
    if (!this.selectedProduct?.UnitPrice) return 'Price on request';
    return this.formatCurrency(this.selectedProduct.UnitPrice);
}

get discountPercentage() {
    if (!this.selectedProduct) return 0;

    const mrp = this.selectedProduct.MaximumRetailPrice;
    const price = this.selectedProduct.UnitPrice;

    if (!mrp || !price || mrp <= price) return 0;

    return Math.round(((mrp - price) / mrp) * 100);
}

get savingsAmount() {
    if (!this.selectedProduct) return 0;

    const mrp = this.selectedProduct.MaximumRetailPrice;
    const price = this.selectedProduct.UnitPrice;

    if (!mrp || !price || mrp <= price) return 0;

    return Math.round(mrp - price);
}

get hasMrp() {
    return this.selectedProduct?.MaximumRetailPrice && 
           this.selectedProduct.UnitPrice && 
           this.selectedProduct.MaximumRetailPrice > this.selectedProduct.UnitPrice;
}

get stockStatusLabel() {
    const stock = this.selectedProduct?.AvailableStock || 0;
    if (stock > 5) return 'In Stock';
    if (stock > 0) return `Only ${stock} left!`;
    return 'Out of Stock';
}

get stockStatusClass() {
    const stock = this.selectedProduct?.AvailableStock || 0;
    if (stock > 5) return 'in-stock';
    if (stock > 0) return 'low-stock';
    return 'out-of-stock';
}

get isOutOfStock() {
    return !this.selectedProduct?.AvailableStock || 
           this.selectedProduct.AvailableStock <= 0;
}


get quantityIsMax() {
    if (!this.selectedProduct) return false;

    const stock = this.selectedProduct.AvailableStock || 0;
    return this.selectedQuantity >= stock;
}

get quantityIsMin() {
    return this.selectedQuantity <= 1;
}

get isResellerType() {
    if (!this.accountType) return false;
    const resellerTypes = ['Distributor', 'Retailer', 'Dealer'];
    return resellerTypes.includes(this.accountType.trim());
}

get maxSellingPriceMessage() {
    if (!this.selectedProduct) return '';
    
    const mrp = this.selectedProduct.MaximumRetailPrice;
    if (!mrp) return '';
    
    return `Maximum selling price to customers: ₹${this.formatCurrency(mrp).replace(/₹/g, '').trim()}`;
}

get showMaxPriceWarning() {
    return this.isResellerType && this.selectedProduct && this.selectedProduct.MaximumRetailPrice;
}


/* =========================
   QUANTITY CONTROLS
========================= */

incrementQuantity() {
    if (!this.selectedProduct) return;

    const stock = this.selectedProduct.AvailableStock || 0;

    if (this.selectedQuantity < stock) {
        this.selectedQuantity = this.selectedQuantity + 1;
    }
}

decrementQuantity() {
    if (this.selectedQuantity > 1) {
        this.selectedQuantity = this.selectedQuantity - 1;
    }
}

handleQuantityChange(event) {
    let value = parseInt(event.target.value, 10);
    const stock = this.selectedProduct?.AvailableStock || 0;

    // Validate input
    if (isNaN(value) || value < 1) {
        value = 1;
    } else if (value > stock) {
        value = stock;
    }

    this.selectedQuantity = value;
}

get quantityIsMin() {
    return this.selectedQuantity <= 1;
}



    /* =========================
       FILTERS & PAGINATION
    ========================== */

    get filteredProducts() {
        let filtered = this.products;

        

        // Filter by category (case-insensitive)
        if (this.selectedCategory) {
            const selectedCat = this.selectedCategory.toLowerCase().trim();
            filtered = filtered.filter(p => 
                p.Product_Category__c && p.Product_Category__c.toLowerCase() === selectedCat
            );
           
        }

        // Filter by family (case-insensitive)
        if (this.selectedFamily) {
            const selectedFam = this.selectedFamily.toLowerCase().trim();
            filtered = filtered.filter(p => 
                p.Family && p.Family.toLowerCase() === selectedFam
            );
           
        }

        // Filter by search query
        if (this.searchQuery.trim()) {
            const query = this.searchQuery.toLowerCase().trim();
            filtered = filtered.filter(p => 
                p.Name.toLowerCase().includes(query) ||
                (p.ProductCode && p.ProductCode.toLowerCase().includes(query)) ||
                (p.Brand__c && p.Brand__c.toLowerCase().includes(query))
            );
           
        }

        
        return filtered;
    }

    get hasActiveFilters() {
        return this.searchQuery.trim() || this.selectedCategory || this.selectedFamily;
    }

    get pagedProducts() {
        const start = (this.currentPage - 1) * this.pageSize;
        const end = start + this.pageSize;
        return this.filteredProducts.slice(start, end);
    }

    get totalPages() {
        return Math.max(1, Math.ceil(this.filteredProducts.length / this.pageSize));
    }

    get prevDisabled() { 
        return this.currentPage <= 1; 
    }
    
    get nextDisabled() { 
        return this.currentPage >= this.totalPages; 
    }

    get hasProducts() {
        return this.pagedProducts && this.pagedProducts.length > 0;
    }

    get paginationInfo() {
        const start = (this.currentPage - 1) * this.pageSize + 1;
        const end = Math.min(this.currentPage * this.pageSize, this.filteredProducts.length);
        const total = this.filteredProducts.length;
        return `Showing ${start}-${end} of ${total}`;
    }
    
    handlePrevPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.scrollToProductsTop();
        }
    }
    
    handleNextPage() {
        if (this.currentPage < this.totalPages) {
            this.currentPage++;
            this.scrollToProductsTop();
        }
    }
    
    scrollToProductsTop() {
        setTimeout(() => {
            const productsSection = this.template.querySelector('.featured-section');
            if (productsSection) {
                productsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 100);
    }

    handleCategoryChange(event) {
        this.selectedCategory = event.target.value || '';
        this.currentPage = 1;
    }

    handleCategoryCardClick(event) {
        const category = event.currentTarget.dataset.category;
        // If "All Products" is clicked, clear the category filter
        if (category === 'All Products') {
            this.selectedCategory = '';
        } else {
            this.selectedCategory = category || '';
        }
        this.currentPage = 1;
        
        // Scroll to featured section
        setTimeout(() => {
            const featuredSection = this.template.querySelector('.featured-section');
            if (featuredSection) {
                featuredSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 100);
    }

    handleFamilyChange(event) {
        this.selectedFamily = event.target.value || '';
        this.currentPage = 1;
    }

    handleSearchChange(event) {
        this.searchQuery = event.target.value || '';
        this.currentPage = 1;
    }

    handleClearSearch() {
        this.searchQuery = '';
        this.currentPage = 1;
    }

    handleClearCategory() {
        this.selectedCategory = '';
        this.currentPage = 1;
    }

    handleClearFamily() {
        this.selectedFamily = '';
        this.currentPage = 1;
    }

    handleClearAllFilters() {
        this.searchQuery = '';
        this.selectedCategory = '';
        this.selectedFamily = '';
        this.currentPage = 1;
    }

    prevPage() {
        if (this.currentPage > 1) this.currentPage--;
    }

    nextPage() {
        if (this.currentPage < this.totalPages) this.currentPage++;
    }

    goToPage(evt) {
        const page = Number(evt.currentTarget.dataset.page);
        if (page >= 1 && page <= this.totalPages) this.currentPage = page;
    }

}