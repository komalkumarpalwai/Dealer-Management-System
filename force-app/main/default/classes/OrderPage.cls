public with sharing class OrderPage {

    /**
     * Wrapper class to hold order item details from the frontend
     */
    public class OrderItemRequest {
        @AuraEnabled public String productId { get; set; }
        @AuraEnabled public Decimal quantity { get; set; }
        @AuraEnabled public Decimal unitPrice { get; set; }
        @AuraEnabled public String priceBookEntryId { get; set; }
    }

    /**
     * Wrapper class for order creation request
     */
    public class CreateOrderRequest {
        @AuraEnabled public String accountId { get; set; }
        @AuraEnabled public String pricebookId { get; set; }
        @AuraEnabled public String orderName { get; set; }
        @AuraEnabled public Date effectiveDate { get; set; }
        @AuraEnabled public String status { get; set; }
        @AuraEnabled public String description { get; set; }
        @AuraEnabled public List<OrderItemRequest> orderItems { get; set; }
    }

    /**
     * Wrapper class for order response
     */
    public class OrderResponse {
        @AuraEnabled public String orderId { get; set; }
        @AuraEnabled public String orderNumber { get; set; }
        @AuraEnabled public Boolean success { get; set; }
        @AuraEnabled public String message { get; set; }
    }

    /**
     * Creates an Order and its associated OrderLineItems
     * Called when user clicks the Buy Now button
     * @param orderRequest - Contains order and line items details
     * @return OrderResponse with order creation status
     */
    @AuraEnabled
    public static OrderResponse createOrderWithLineItems(CreateOrderRequest orderRequest) {
        
        OrderResponse response = new OrderResponse();
        
        try {
            
            // Validate required fields
            if (String.isBlank(orderRequest.accountId)) {
                response.success = false;
                response.message = 'Account ID is required to create an order';
                return response;
            }
            
            if (String.isBlank(orderRequest.pricebookId)) {
                response.success = false;
                response.message = 'Pricebook ID is required to create an order';
                return response;
            }
            
            if (orderRequest.orderItems == null || orderRequest.orderItems.isEmpty()) {
                response.success = false;
                response.message = 'At least one order item is required';
                return response;
            }
            
            // Get product IDs FIRST to query pricebook entries and their currency
            Set<String> productIds = new Set<String>();
            for (OrderItemRequest itemRequest : orderRequest.orderItems) {
                if (String.isNotBlank(itemRequest.productId)) {
                    productIds.add(itemRequest.productId);
                }
            }
            
            // Query the Pricebook2 to get its default currency
            Pricebook2 pb = [
                SELECT Id, CurrencyIsoCode
                FROM Pricebook2
                WHERE Id = :orderRequest.pricebookId
                LIMIT 1
            ];
            
            String orderCurrency = pb.CurrencyIsoCode;
            System.debug('Pricebook Currency: ' + orderCurrency);
            
            // Query PricebookEntries with the SAME currency as the pricebook
            Map<String, String> productToPricebookEntryMap = new Map<String, String>();
            
            if (!productIds.isEmpty()) {
                List<PricebookEntry> pricebookEntries = [
                    SELECT Id, Product2Id, CurrencyIsoCode
                    FROM PricebookEntry
                    WHERE Pricebook2Id = :orderRequest.pricebookId
                    AND Product2Id IN :productIds
                    AND CurrencyIsoCode = :orderCurrency
                    AND IsActive = true
                ];
                
                System.debug('Pricebook Entries found with matching currency: ' + pricebookEntries.size());
                
                for (PricebookEntry entry : pricebookEntries) {
                    productToPricebookEntryMap.put(entry.Product2Id, entry.Id);
                }
            }
            
            if (productToPricebookEntryMap.isEmpty()) {
                response.success = false;
                response.message = 'No valid order items found in the pricebook with currency ' + orderCurrency + '. Please ensure all products are available in this currency.';
                return response;
            }
            
            // Now create the Order with the CORRECT currency from Pricebook
            Order newOrder = new Order();
            newOrder.AccountId = orderRequest.accountId;
            newOrder.Pricebook2Id = orderRequest.pricebookId;
            newOrder.CurrencyIsoCode = orderCurrency;
            newOrder.Status = String.isBlank(orderRequest.status) ? 'Draft' : orderRequest.status;
            newOrder.EffectiveDate = orderRequest.effectiveDate != null ? orderRequest.effectiveDate : Date.today();
            newOrder.Name = String.isBlank(orderRequest.orderName) ? 'New Order - ' + Datetime.now().format() : orderRequest.orderName;
            newOrder.Description = orderRequest.description;
            
            insert newOrder;
            
            response.orderId = newOrder.Id;
            response.orderNumber = newOrder.OrderNumber;
            
            // Create OrderLineItems using the already-fetched pricebook entries
            List<OrderItem> orderLineItems = new List<OrderItem>();
            
            System.debug('=== Order Creation Debug ===');
            System.debug('Order Currency: ' + orderCurrency);
            System.debug('Product IDs to process: ' + productIds.size());
            
            for (OrderItemRequest itemRequest : orderRequest.orderItems) {
                
                if (itemRequest.quantity == null || itemRequest.quantity <= 0) {
                    System.debug('Skipping item - invalid quantity: ' + itemRequest.quantity);
                    continue; // Skip invalid quantities
                }
                
                // Get the PricebookEntry ID - must be from the matched currency entries
                String pricebookEntryId = itemRequest.priceBookEntryId;
                if (String.isBlank(pricebookEntryId) && productToPricebookEntryMap.containsKey(itemRequest.productId)) {
                    pricebookEntryId = productToPricebookEntryMap.get(itemRequest.productId);
                }
                
                if (String.isBlank(pricebookEntryId)) {
                    // Skip this item if no pricebook entry found with matching currency
                    System.debug('Skipping item - no pricebook entry found for product: ' + itemRequest.productId + ' with currency: ' + orderCurrency);
                    continue;
                }
                
                System.debug('Creating OrderItem - Product: ' + itemRequest.productId + ', Qty: ' + itemRequest.quantity);
                
                OrderItem lineItem = new OrderItem();
                lineItem.OrderId = newOrder.Id;
                lineItem.PricebookEntryId = pricebookEntryId;
                lineItem.UnitPrice = itemRequest.unitPrice;
                lineItem.Quantity = itemRequest.quantity;
                
                orderLineItems.add(lineItem);
            }
            
            System.debug('Total OrderItems to insert: ' + orderLineItems.size());
            
            if (!orderLineItems.isEmpty()) {
                insert orderLineItems;
                response.success = true;
                response.message = 'Order created successfully with ' + orderLineItems.size() + ' line item(s)';
            } else {
                response.success = false;
                response.message = 'No valid order items to add. Please ensure all products are available in the pricebook with currency ' + orderCurrency + '.';
                // Delete the order if no items were created
                delete newOrder;
            }
            
            return response;
            
        } catch (DmlException e) {
            response.success = false;
            String errorMsg = 'Error creating order: ';
            for (Integer i = 0; i < e.getNumDml(); i++) {
                errorMsg += e.getDmlMessage(i) + ' | ';
            }
            response.message = errorMsg.removeEnd(' | ');
            return response;
        } catch (QueryException e) {
            response.success = false;
            response.message = 'Error querying data: ' + e.getMessage();
            return response;
        } catch (Exception e) {
            response.success = false;
            response.message = 'Unexpected error: ' + e.getMessage() + ' (Line: ' + e.getLineNumber() + ')';
            return response;
        }
    }

    /**
     * Gets the user's account details for order creation
     * @return Map containing user and account information
     */
    @AuraEnabled(cacheable=true)
    public static Map<String, Object> getUserAccountDetails() {
        
        Map<String, Object> result = new Map<String, Object>();
        
        try {
            User currentUser = [
                SELECT Id,
                       Name,
                       Email,
                       Contact.AccountId,
                       Contact.Account.Name,
                       Contact.Account.Account_Type__c
                FROM User
                WHERE Id = :UserInfo.getUserId()
                LIMIT 1
            ];
            
            if (currentUser.Contact != null && currentUser.Contact.AccountId != null) {
                result.put('accountId', currentUser.Contact.AccountId);
                result.put('accountName', currentUser.Contact.Account.Name);
                result.put('accountType', currentUser.Contact.Account.Account_Type__c);
                result.put('success', true);
            } else {
                result.put('success', false);
                result.put('message', 'User is not associated with an account');
            }
            
        } catch (Exception e) {
            result.put('success', false);
            result.put('message', e.getMessage());
        }
        
        return result;
    }

    /**
     * Gets available price book entries for products
     * @param pricebookId - The pricebook to query
     * @param productIds - List of product IDs
     * @return Map of Product ID to PricebookEntry details
     */
    @AuraEnabled(cacheable=true)
    public static Map<String, Object> getPricebookEntries(String pricebookId, List<String> productIds) {
        
        Map<String, Object> result = new Map<String, Object>();
        
        try {
            List<PricebookEntry> entries = [
                SELECT Id,
                       Product2Id,
                       Product2.Name,
                       UnitPrice,
                       IsActive,
                       CurrencyIsoCode
                FROM PricebookEntry
                WHERE Pricebook2Id = :pricebookId
                AND Product2Id IN :productIds
                AND IsActive = true
            ];
            
            Map<String, Map<String, Object>> entryMap = new Map<String, Map<String, Object>>();
            
            for (PricebookEntry entry : entries) {
                Map<String, Object> entryDetails = new Map<String, Object>();
                entryDetails.put('pricebookEntryId', entry.Id);
                entryDetails.put('productId', entry.Product2Id);
                entryDetails.put('productName', entry.Product2.Name);
                entryDetails.put('unitPrice', entry.UnitPrice);
                entryDetails.put('currencyIsoCode', entry.CurrencyIsoCode);
                
                entryMap.put(entry.Product2Id, entryDetails);
            }
            
            result.put('entries', entryMap);
            result.put('success', true);
            
        } catch (Exception e) {
            result.put('success', false);
            result.put('message', e.getMessage());
        }
        
        return result;
    }

    /**
     * Retrieves order details including line items
     * @param orderId - The order ID to retrieve
     * @return Order details with line items
     */
    @AuraEnabled(cacheable=false)
    public static Map<String, Object> getOrderDetails(String orderId) {
        
        Map<String, Object> result = new Map<String, Object>();
        
        try {
            Order orderRecord = [
                SELECT Id,
                       OrderNumber,
                       Status,
                       Name,
                       Description,
                       Account.Name,
                       EffectiveDate,
                       TotalAmount,
                       CreatedDate
                FROM Order
                WHERE Id = :orderId
                LIMIT 1
            ];
            
            List<OrderItem> lineItems = [
                SELECT Id,
                       Product2.Name,
                       Product2.ProductCode,
                       Quantity,
                       UnitPrice,
                       TotalPrice
                FROM OrderItem
                WHERE OrderId = :orderId
            ];
            
            result.put('order', orderRecord);
            result.put('lineItems', lineItems);
            result.put('success', true);
            
        } catch (Exception e) {
            result.put('success', false);
            result.put('message', e.getMessage());
        }
        
        return result;
    }

    /**
     * Gets all orders for a specific account
     * @param accountId - The account ID to fetch orders for
     * @return Map containing list of orders and success status
     */
    @AuraEnabled
    public static Map<String, Object> getAccountOrders(String accountId) {
        
        Map<String, Object> result = new Map<String, Object>();
        
        try {
            List<Order> orders = [
                SELECT Id,
                       OrderNumber,
                       Status,
                       Name,
                       CreatedDate,
                       EffectiveDate,
                       TotalAmount
                FROM Order
                WHERE AccountId = :accountId
                ORDER BY CreatedDate DESC
            ];
            
            // Get order IDs for counting line items
            Set<Id> orderIds = new Set<Id>();
            for (Order order : orders) {
                orderIds.add(order.Id);
            }
            
            // Count line items for each order
            Map<Id, Integer> orderLineItemCounts = new Map<Id, Integer>();
            if (!orderIds.isEmpty()) {
                List<AggregateResult> counts = [
                    SELECT OrderId, COUNT(Id) lineCount
                    FROM OrderItem
                    WHERE OrderId IN :orderIds
                    GROUP BY OrderId
                ];
                
                for (AggregateResult ar : counts) {
                    orderLineItemCounts.put((Id) ar.get('OrderId'), (Integer) ar.get('lineCount'));
                }
            }
            
            List<Map<String, Object>> ordersList = new List<Map<String, Object>>();
            
            for (Order order : orders) {
                Map<String, Object> orderMap = new Map<String, Object>();
                orderMap.put('Id', order.Id);
                orderMap.put('OrderNumber', order.OrderNumber);
                orderMap.put('Status', order.Status);
                orderMap.put('Name', order.Name);
                orderMap.put('CreatedDate', order.CreatedDate);
                orderMap.put('EffectiveDate', order.EffectiveDate);
                orderMap.put('TotalAmount', order.TotalAmount);
                orderMap.put('LineItemCount__c', orderLineItemCounts.containsKey(order.Id) ? orderLineItemCounts.get(order.Id) : 0);
                
                ordersList.add(orderMap);
            }
            
            result.put('orders', ordersList);
            result.put('success', true);
            
        } catch (Exception e) {
            result.put('success', false);
            result.put('message', e.getMessage());
        }
        
        return result;
    }

    /**
     * Gets the current user's account information
     * @return Map containing user's account ID and name
     */
    @AuraEnabled(cacheable=true)
    public static Map<String, Object> getUserAccount() {
        
        Map<String, Object> result = new Map<String, Object>();
        
        try {
            User currentUser = [
                SELECT Id,
                       Contact.Account.Id,
                       Contact.Account.Name,
                       Contact.Account.Email__c,
                       Contact.Account.Phone,
                       Contact.Account.Shop_Name__c,
                       Contact.Account.Brand_Name__c,
                       Contact.Account.GST_Number__c,
                       Contact.Account.PAN_Number__c,
                       Contact.Account.Status__c,
                       Contact.Account.Type,
                       Contact.Account.Website,
                       Contact.Account.Industry,
                       Contact.Account.AnnualRevenue,
                       Contact.Account.Years_in_Business__c,
                       Contact.Account.ShippingStreet,
                       Contact.Account.ShippingCity,
                       Contact.Account.ShippingState,
                       Contact.Account.ShippingPostalCode,
                       Contact.Account.ShippingCountry
                FROM User
                WHERE Id = :UserInfo.getUserId()
                LIMIT 1
            ];
            
            if (currentUser.Contact != null && currentUser.Contact.Account != null) {
                Account acc = currentUser.Contact.Account;
                result.put('accountId', acc.Id);
                result.put('accountName', acc.Name);
                result.put('businessName', acc.Shop_Name__c != null ? acc.Shop_Name__c : acc.Name);
                result.put('email', acc.Email__c);
                result.put('phone', acc.Phone);
                result.put('brandname', acc.Brand_Name__c);
                result.put('gstNumber', acc.GST_Number__c);
                result.put('panNumber', acc.PAN_Number__c);
                result.put('status', acc.Status__c);
                result.put('type', acc.Type);
                result.put('website', acc.Website);
                result.put('industry', acc.Industry);
                result.put('annualRevenue', acc.AnnualRevenue);
                result.put('yearsInBusiness', acc.Years_in_Business__c);
                result.put('billingStreet', acc.ShippingStreet);
                result.put('billingCity', acc.ShippingCity);
                result.put('billingState', acc.ShippingState);
                result.put('billingPostalCode', acc.ShippingPostalCode);
                result.put('billingCountry', acc.ShippingCountry);
                result.put('success', true);
            } else {
                result.put('success', false);
                result.put('message', 'User is not associated with an account');
            }
            
        } catch (Exception e) {
            result.put('success', false);
            result.put('message', e.getMessage());
        }
        
        return result;
    }

    /**
     * Updates the billing address for the given account
     * @param accountId - The ID of the account to update
     * @param billingStreet - Street address
     * @param billingCity - City
     * @param billingState - State
     * @param billingPostalCode - Postal code
     * @param billingCountry - Country
     * @return Map containing success status and message
     */
    @AuraEnabled
    public static Map<String, Object> updateShippingAddress(
        String accountId,
        String shippingStreet,
        String shippingCity,
        String shippingState,
        String shippingPostalCode,
        String shippingCountry
    ) {
        
        Map<String, Object> result = new Map<String, Object>();
        
        try {
            // Validate accountId
            if (String.isBlank(accountId)) {
                result.put('success', false);
                result.put('message', 'Account ID is required');
                return result;
            }
            
            // Query the account
            Account acc = [
                SELECT Id, ShippingStreet, ShippingCity, ShippingState, ShippingPostalCode, ShippingCountry
                FROM Account
                WHERE Id = :accountId
                LIMIT 1
            ];
            
            // Update shipping address fields
            acc.ShippingStreet = shippingStreet;
            acc.ShippingCity = shippingCity;
            acc.ShippingState = shippingState;
            acc.ShippingPostalCode = shippingPostalCode;
            acc.ShippingCountry = shippingCountry;
            
            // Update the record
            update acc;
            
            result.put('success', true);
            result.put('message', 'Shipping address updated successfully');
            result.put('billingStreet', acc.ShippingStreet);
            result.put('billingCity', acc.ShippingCity);
            result.put('billingState', acc.ShippingState);
            result.put('billingPostalCode', acc.ShippingPostalCode);
            result.put('billingCountry', acc.ShippingCountry);
            
        } catch (QueryException e) {
            result.put('success', false);
            result.put('message', 'Account not found: ' + e.getMessage());
        } catch (DmlException e) {
            result.put('success', false);
            result.put('message', 'Error updating billing address: ' + e.getMessage());
        } catch (Exception e) {
            result.put('success', false);
            result.put('message', 'Unexpected error: ' + e.getMessage());
        }
        
        return result;
    }

    /**
     * Gets order summary metrics for the current user's account
     * @return Map containing total orders, pending orders, and total spent this month
     */
    @AuraEnabled
    public static Map<String, Object> getOrderSummary(String accountId) {
        
        Map<String, Object> result = new Map<String, Object>();
        
        try {
            // Get total orders
            Integer totalOrders = [SELECT COUNT() FROM Order WHERE AccountId = :accountId];
            
            // Get pending orders (Draft status)
            Integer pendingOrders = [SELECT COUNT() FROM Order WHERE AccountId = :accountId AND Status = 'Draft'];
            
            // Get total spent this month
            Decimal totalSpentThisMonth = 0;
            Date firstDayOfMonth = Date.today().toStartOfMonth();
            
           List<AggregateResult> monthlyTotal = [
    SELECT SUM(TotalAmount) totalAmount
    FROM Order
    WHERE AccountId = :accountId
    AND CreatedDate >= :firstDayOfMonth
];
            
            if (!monthlyTotal.isEmpty() && monthlyTotal[0].get('totalAmount') != null) {
                totalSpentThisMonth = (Decimal) monthlyTotal[0].get('totalAmount');
            }
            
            // Calculate average order value
          List<AggregateResult> avgTotal = [
    SELECT AVG(TotalAmount) avgAmount
    FROM Order
    WHERE AccountId = :accountId
];
            
            Decimal avgOrderValue = 0;
            if (!avgTotal.isEmpty() && avgTotal[0].get('avgAmount') != null) {
                avgOrderValue = (Decimal) avgTotal[0].get('avgAmount');
            }
            
            result.put('totalOrders', totalOrders);
            result.put('pendingOrders', pendingOrders);
            result.put('totalSpentThisMonth', totalSpentThisMonth);
            result.put('averageOrderValue', avgOrderValue);
            result.put('success', true);
            
        } catch (Exception e) {
            result.put('success', false);
            result.put('message', e.getMessage());
        }
        
        return result;
    }

    /**
     * Gets order trends aggregated by date for the current user's account
     * @return Map containing orders grouped by date
     */
    @AuraEnabled
    public static Map<String, Object> getOrderTrends(String accountId) {
        
        Map<String, Object> result = new Map<String, Object>();
        
        try {
            List<Order> orders = [
                SELECT Id, CreatedDate, TotalAmount, Status
                FROM Order
                WHERE AccountId = :accountId
                ORDER BY CreatedDate DESC
                LIMIT 90
            ];
            
            // Aggregate orders by date
            Map<String, Decimal> dailyOrders = new Map<String, Decimal>();
            Map<String, Integer> dailyCount = new Map<String, Integer>();
            
            for (Order order : orders) {
                String dateStr = order.CreatedDate.date().format();
                
                if (!dailyOrders.containsKey(dateStr)) {
                    dailyOrders.put(dateStr, 0);
                    dailyCount.put(dateStr, 0);
                }
                
                Decimal currentAmount = dailyOrders.get(dateStr);
                Integer currentCount = dailyCount.get(dateStr);
                
                dailyOrders.put(dateStr, currentAmount + (order.TotalAmount != null ? order.TotalAmount : 0));
                dailyCount.put(dateStr, currentCount + 1);
            }
            
            List<Map<String, Object>> trendData = new List<Map<String, Object>>();
            for (String dateStr : dailyOrders.keySet()) {
                Map<String, Object> trendMap = new Map<String, Object>();
                trendMap.put('date', dateStr);
                trendMap.put('amount', dailyOrders.get(dateStr));
                trendMap.put('count', dailyCount.get(dateStr));
                trendData.add(trendMap);
            }
            
            result.put('trends', trendData);
            result.put('success', true);
            
        } catch (Exception e) {
            result.put('success', false);
            result.put('message', e.getMessage());
        }
        
        return result;
    }

    /**
     * Gets the top products ordered by the customer
     * @return Map containing most frequently purchased products
     */
    @AuraEnabled
    public static Map<String, Object> getTopProducts(String accountId) {
        
        Map<String, Object> result = new Map<String, Object>();
        
        try {
            // Get all order items for the account
            List<OrderItem> orderItems = [
                SELECT Product2Id, Product2.Name, Quantity
                FROM OrderItem
                WHERE Order.AccountId = :accountId
                ORDER BY Product2Id
            ];
            
            // Aggregate by product
            Map<Id, Map<String, Object>> productMap = new Map<Id, Map<String, Object>>();
            
            for (OrderItem item : orderItems) {
                Id prodId = item.Product2Id;
                if (!productMap.containsKey(prodId)) {
                    productMap.put(prodId, new Map<String, Object>{
                        'productId' => prodId,
                        'productName' => item.Product2.Name,
                        'totalQuantity' => 0,
                        'orderCount' => 0
                    });
                }
                
                Map<String, Object> prodData = productMap.get(prodId);
                prodData.put('totalQuantity', (Decimal) prodData.get('totalQuantity') + (item.Quantity != null ? item.Quantity : 0));
                prodData.put('orderCount', (Integer) prodData.get('orderCount') + 1);
            }
            
            // Sort by quantity and get top 5
            List<Map<String, Object>> sortedProducts = new List<Map<String, Object>>(productMap.values());
            sortedProducts.sort(new QuantityComparator());
            
            List<Map<String, Object>> topFive = new List<Map<String, Object>>();
            for (Integer i = 0; i < Math.min(5, sortedProducts.size()); i++) {
                topFive.add(sortedProducts[i]);
            }
            
            result.put('products', topFive);
            result.put('success', true);
            
        } catch (Exception e) {
            result.put('success', false);
            result.put('message', e.getMessage());
        }
        
        return result;
    }
    
    /**
     * Comparator for sorting products by quantity in descending order
     */
    private class QuantityComparator implements Comparator<Map<String, Object>> {
        public Integer compare(Map<String, Object> a, Map<String, Object> b) {
            Decimal qtyA = (Decimal) a.get('totalQuantity');
            Decimal qtyB = (Decimal) b.get('totalQuantity');
            if (qtyA > qtyB) return -1;
            if (qtyA < qtyB) return 1;
            return 0;
        }
    }

    /**
     * Gets order status breakdown for pie chart
     * @return Map containing counts of orders by status
     */
    @AuraEnabled
    public static Map<String, Object> getOrderStatusBreakdown(String accountId) {
        
        Map<String, Object> result = new Map<String, Object>();
        
        try {
            List<AggregateResult> statusBreakdown = [
                SELECT Status, COUNT(Id) statusCount
                FROM Order
                WHERE AccountId = :accountId
                GROUP BY Status
            ];
            
            Map<String, Integer> statusMap = new Map<String, Integer>();
            
            for (AggregateResult ar : statusBreakdown) {
                String status = (String) ar.get('Status');
                Integer count = (Integer) ar.get('statusCount');
                statusMap.put(status, count);
            }
            
            result.put('statusBreakdown', statusMap);
            result.put('success', true);
            
        } catch (Exception e) {
            result.put('success', false);
            result.put('message', e.getMessage());
        }
        
        return result;
    }
}