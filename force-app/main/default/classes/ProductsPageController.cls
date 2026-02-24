public with sharing class ProductsPageController {

    /**
     * Determines the appropriate Pricebook ID based on Account Type
     * Maps Account Types to their corresponding Pricebook names
     * Handles case-insensitive matching and provides fallback
     */
    private static Id determinePricebookId(String accountType) {

        List<Pricebook2> allPricebooks = [
            SELECT Id, Name, IsStandard, IsActive
            FROM Pricebook2
            ORDER BY Name ASC
        ];

        Map<String, Id> pricebookMap = new Map<String, Id>();
        Id standardPricebookId = null;

        for (Pricebook2 pb : allPricebooks) {
            pricebookMap.put(pb.Name.toLowerCase(), pb.Id);
            if (pb.IsStandard) {
                standardPricebookId = pb.Id;
            }
        }

        Id selectedPricebookId = standardPricebookId;

        if (String.isNotBlank(accountType)) {

            String accountTypeLower = accountType.toLowerCase().trim();

            // Exact match
            if (pricebookMap.containsKey(accountTypeLower)) {
                selectedPricebookId = pricebookMap.get(accountTypeLower);
            }
            else {
                // Partial match
                for (String pbName : pricebookMap.keySet()) {
                    if (pbName.contains(accountTypeLower) || accountTypeLower.contains(pbName)) {
                        selectedPricebookId = pricebookMap.get(pbName);
                        break;
                    }
                }
            }
        }

        if (selectedPricebookId == null && standardPricebookId != null) {
            selectedPricebookId = standardPricebookId;
        }

        return selectedPricebookId;
    }

    /**
     * Public method to get the Pricebook ID for the current user
     * Used by OrderPage component
     */
    @AuraEnabled(cacheable=true)
    public static String getPricebookIdForUser() {
        try {
            User u = [
                SELECT Id,
                       Contact.Account.Account_Type__c
                FROM User
                WHERE Id = :UserInfo.getUserId()
                LIMIT 1
            ];

            String accountType = (u.Contact != null && u.Contact.Account != null)
                ? u.Contact.Account.Account_Type__c
                : null;

            Id pricebookId = determinePricebookId(accountType);
            return pricebookId;
        } catch (Exception e) {
            throw new AuraHandledException('Error determining pricebook: ' + e.getMessage());
        }
    }


    @AuraEnabled(cacheable=true)
    public static Map<String, Object> getPageData() {

        User u = [
            SELECT Id,
                   Name,
                   Email,
                   Username,
                   Profile.Name,
                   Contact.Account.Id,
                   Contact.Account.Name,
                   Contact.Account.Account_Type__c,
                   Contact.Account.Phone,
                   Contact.Account.BillingCity,
                   Contact.Account.BillingState,
                   Contact.Account.Industry
            FROM User
            WHERE Id = :UserInfo.getUserId()
            LIMIT 1
        ];

        String accountType = (u.Contact != null && u.Contact.Account != null)
            ? u.Contact.Account.Account_Type__c
            : null;

        Id pricebookId = determinePricebookId(accountType);

        List<Product2> products = [
            SELECT Id,
                   Name,
                   ProductCode,
                   Description,
                   Product_Description__c,
                   Family,
                   Product_Category__c,
                   Brand__c,
                   Net_Weight__c,
                   Product_Specification__c,
                   IsActive,
                   CurrencyIsoCode,
                   QuantityUnitOfMeasure,
                   StockKeepingUnit,
                   CreatedDate,
                   Maximum_Retail_Price__c
            FROM Product2
            WHERE IsActive = true
            ORDER BY Name ASC
        ];

        Map<Id, Decimal> productPrices = new Map<Id, Decimal>();

        if (!products.isEmpty()) {

            List<PricebookEntry> pricebookEntries = [
                SELECT Product2Id, UnitPrice
                FROM PricebookEntry
                WHERE Pricebook2Id = :pricebookId
                AND IsActive = true
                AND Product2Id IN :products
            ];

            for (PricebookEntry entry : pricebookEntries) {
                productPrices.put(entry.Product2Id, entry.UnitPrice);
            }
        }

        Set<Id> productIds = new Set<Id>();
        for (Product2 p : products) {
            productIds.add(p.Id);
        }

        System.debug('===== STOCK QUERY DEBUG =====');
        System.debug('Product IDs Count: ' + productIds.size());
        System.debug('Product IDs: ' + productIds);

        // Get Stock Quantities
        Map<Id, Decimal> productStockMap = new Map<Id, Decimal>();
        if (!productIds.isEmpty()) {
            // Query with aggregation - filter out null Product__c
            List<AggregateResult> stockResults = [
                SELECT Product__c, SUM(Quantity__c) totalQty
                FROM Stock__c
                WHERE Product__c IN :productIds
                AND Product__c != null
                GROUP BY Product__c
            ];

            System.debug('Aggregated Stock Results Count: ' + stockResults.size());
            for (AggregateResult ar : stockResults) {
                Id prodId = (Id) ar.get('Product__c');
                Decimal total = (Decimal) ar.get('totalQty');
                productStockMap.put(prodId, total);
                System.debug('Stock Mapped - Product ID: ' + prodId + ', Quantity: ' + total);
            }
            System.debug('Final Stock Map Size: ' + productStockMap.size());
            System.debug('Final Stock Map: ' + productStockMap);
        } else {
            System.debug('No product IDs found!');
        }

        Map<Id, Id> productToContentVersion = new Map<Id, Id>();

        if (!productIds.isEmpty()) {

            List<ContentDocumentLink> links = [
                SELECT LinkedEntityId,
                       ContentDocument.LatestPublishedVersionId
                FROM ContentDocumentLink
                WHERE LinkedEntityId IN :productIds
            ];

            for (ContentDocumentLink link : links) {
                if (link.ContentDocument != null &&
                    link.ContentDocument.LatestPublishedVersionId != null) {

                    if (!productToContentVersion.containsKey(link.LinkedEntityId)) {
                        productToContentVersion.put(
                            link.LinkedEntityId,
                            link.ContentDocument.LatestPublishedVersionId
                        );
                    }
                }
            }
        }

        Set<String> categoriesSet = new Set<String>();
        List<Map<String, Object>> productsWithPrice = new List<Map<String, Object>>();

        for (Product2 product : products) {

            Map<String, Object> productMap = new Map<String, Object>();

            productMap.put('Id', product.Id);
            productMap.put('Name', product.Name);
            productMap.put('ProductCode', product.ProductCode);
            productMap.put('Description', product.Description);
            productMap.put('Product_Description__c', product.Product_Description__c);
            productMap.put('Family', product.Family);
            productMap.put('Product_Category__c', product.Product_Category__c);
            productMap.put('Brand__c', product.Brand__c);
            productMap.put('Net_Weight__c', product.Net_Weight__c);
            productMap.put('Product_Specification__c', product.Product_Specification__c);
            productMap.put('IsActive', product.IsActive);
            productMap.put('CurrencyIsoCode', product.CurrencyIsoCode);
            productMap.put('QuantityUnitOfMeasure', product.QuantityUnitOfMeasure);
            productMap.put('StockKeepingUnit', product.StockKeepingUnit);
            productMap.put('CreatedDate', product.CreatedDate);
            productMap.put('MaximumRetailPrice', product.Maximum_Retail_Price__c);
            productMap.put('UnitPrice', productPrices.get(product.Id));

            // Add Stock Quantity
            Decimal stockQty = productStockMap.containsKey(product.Id) ? productStockMap.get(product.Id) : 0;
            productMap.put('AvailableStock', stockQty);

            // Debug: Log Product Name and Stock Quantity
            System.debug('Product: ' + product.Name + ' | Stock Quantity: ' + stockQty);

            if (productToContentVersion.containsKey(product.Id)) {
                productMap.put('ContentVersionId', productToContentVersion.get(product.Id));
            }

            productsWithPrice.add(productMap);

            if (product.Product_Category__c != null) {
                categoriesSet.add(product.Product_Category__c);
            }
        }

        List<String> categories = new List<String>();
        categories.addAll(categoriesSet);
        categories.sort();

        Map<String, Object> result = new Map<String, Object>();
        result.put('user', u);
        result.put('account', u.Contact != null ? u.Contact.Account : null);
        result.put('products', productsWithPrice);
        result.put('categories', categories);
        result.put('accountType', accountType != null ? accountType : '');
        result.put('pricebookUsed', pricebookId != null ? pricebookId : '');

        return result;
    }


    @AuraEnabled(cacheable=true)
    public static Map<String, Object> getCurrentUserInfo() {

        Map<String, Object> result = new Map<String, Object>();

        result.put('Id', '');
        result.put('Name', '');
        result.put('Email', '');
        result.put('AccountId', '');
        result.put('AccountName', '');
        result.put('AccountType', '');

        try {

            User u = [
                SELECT Id,
                       Name,
                       Email,
                       Contact.Id,
                       Contact.Account.Id
                FROM User
                WHERE Id = :UserInfo.getUserId()
                LIMIT 1
            ];

            result.put('Id', u.Id);
            result.put('Name', u.Name);
            result.put('Email', u.Email);

            String accountId = '';
            String accountName = '';
            String accountType = '';

            if (u.Contact != null && u.Contact.Account != null) {

                accountId = u.Contact.Account.Id;

                if (String.isNotBlank(accountId)) {

                    Account acc = [
                        SELECT Id, Name, Account_Type__c
                        FROM Account
                        WHERE Id = :accountId
                        LIMIT 1
                    ];

                    accountName = acc.Name;
                    accountType = acc.Account_Type__c;
                }
            }

            result.put('AccountId', accountId);
            result.put('AccountName', accountName);
            result.put('AccountType', accountType);

        } catch (Exception e) {
            // ignore
        }

        return result;
    }

    @AuraEnabled(cacheable=true)
    public static List<Map<String, Object>> getProductImages(String productId) {
        List<Map<String, Object>> imagesList = new List<Map<String, Object>>();

        try {
            List<ContentDocumentLink> links = [
                SELECT ContentDocument.Id,
                       ContentDocument.Title,
                       ContentDocument.LatestPublishedVersionId,
                       ContentDocument.CreatedDate
                FROM ContentDocumentLink
                WHERE LinkedEntityId = :productId
                ORDER BY ContentDocument.CreatedDate DESC
            ];

            System.debug('Product Images Count: ' + links.size());

            for (ContentDocumentLink link : links) {
                if (link.ContentDocument != null && link.ContentDocument.LatestPublishedVersionId != null) {
                    Map<String, Object> imageMap = new Map<String, Object>();
                    imageMap.put('DocumentId', link.ContentDocument.Id);
                    imageMap.put('Title', link.ContentDocument.Title);
                    imageMap.put('VersionId', link.ContentDocument.LatestPublishedVersionId);
                    imageMap.put('CreatedDate', link.ContentDocument.CreatedDate);
                    imageMap.put('ImageUrl', '/sfc/servlet.shepherd/version/download/' + link.ContentDocument.LatestPublishedVersionId);
                    imagesList.add(imageMap);
                }
            }

        } catch (Exception e) {
            System.debug('Error fetching product images: ' + e.getMessage());
        }

        return imagesList;
    }
}