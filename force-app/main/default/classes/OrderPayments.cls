public with sharing class OrderPayments {
    
    /**
     * Gets all payments for a specific order - returns raw Payment__c records
     * @param orderId - The order ID to fetch payments for
     * @return Map containing list of payments and success status
     */
    @AuraEnabled
    public static Map<String, Object> getPaymentsByOrder(String orderId) {
        
        Map<String, Object> response = new Map<String, Object>();
        List<Object> paymentsList = new List<Object>();
        
        try {
            // Bulk-safe query: Fetch all payments for the given order ID
            List<Payment__c> paymentRecords = [
                SELECT Id,
                       Account__c,
                       Account_Number__c,
                       Amount__c,
                       Bank_Name__c,
                       Card_Holder_Name__c,
                       Card_Number__c,
                       Card_Type__c,
                       Cash_Receipt_Number__c,
                       Cash_Received_By__c,
                       CreatedById,
                       CurrencyIsoCode,
                       IFSC_Code__c,
                       LastModifiedById,
                       Notes__c,
                       Order__c,
                       Payment_Date__c,
                       Name,
                       Payment_Mode__c,
                       Payment_Status__c,
                       Transaction_Id__c,
                       Transfer_Reference_Number__c,
                       UPI_App_Name__c,
                       UPI_Id__c,
                       UPI_Name__c,
                       UPI_Reference_Number__c
                FROM Payment__c
                WHERE Order__c = :orderId
                ORDER BY Payment_Date__c DESC
            ];
            
            // Add all payments to list
            for (Payment__c payment : paymentRecords) {
                paymentsList.add(payment);
            }
            
            response.put('payments', paymentsList);
            response.put('success', true);
            response.put('message', 'Payments retrieved successfully');
            
        } catch (Exception e) {
            response.put('success', false);
            response.put('message', 'Error fetching payments: ' + e.getMessage());
            System.debug('Error in getPaymentsByOrder: ' + e.getStackTraceString());
        }
        
        return response;
    }

    /**
     * Gets all payments for multiple orders (bulk operation)
     * @param orderIds - List of order IDs to fetch payments for
     * @return Map of order ID to list of payments
     */
    @AuraEnabled
    public static Map<String, Object> getPaymentsByOrders(List<String> orderIds) {
        
        Map<String, Object> response = new Map<String, Object>();
        Map<String, List<Object>> paymentsByOrder = new Map<String, List<Object>>();
        
        try {
            // Bulk-safe query: Fetch all payments for the given order IDs
            List<Payment__c> paymentRecords = [
                SELECT Id,
                       Account__c,
                       Account_Number__c,
                       Amount__c,
                       Bank_Name__c,
                       Card_Holder_Name__c,
                       Card_Number__c,
                       Card_Type__c,
                       Cash_Receipt_Number__c,
                       Cash_Received_By__c,
                       CreatedById,
                       CurrencyIsoCode,
                       IFSC_Code__c,
                       LastModifiedById,
                       Notes__c,
                       Order__c,
                       Payment_Date__c,
                       Name,
                       Payment_Mode__c,
                       Payment_Status__c,
                       Transaction_Id__c,
                       Transfer_Reference_Number__c,
                       UPI_App_Name__c,
                       UPI_Id__c,
                       UPI_Name__c,
                       UPI_Reference_Number__c
                FROM Payment__c
                WHERE Order__c IN :orderIds
                ORDER BY Order__c, Payment_Date__c DESC
            ];
            
            // Initialize maps for each order ID
            for (String orderId : orderIds) {
                paymentsByOrder.put(orderId, new List<Object>());
            }
            
            // Add payments to appropriate order lists
            for (Payment__c payment : paymentRecords) {
                if (paymentsByOrder.containsKey(payment.Order__c)) {
                    paymentsByOrder.get(payment.Order__c).add(payment);
                }
            }
            
            response.put('paymentsByOrder', paymentsByOrder);
            response.put('success', true);
            response.put('message', 'Payments retrieved successfully');
            
        } catch (Exception e) {
            response.put('success', false);
            response.put('message', 'Error fetching payments: ' + e.getMessage());
            System.debug('Error in getPaymentsByOrders: ' + e.getStackTraceString());
        }
        
        return response;
    }

    /**
     * Creates a new Payment__c record with method-specific fields
     * @param paymentData - Map containing payment details (orderId, amount, method, formData, accountId, outstandingAmount)
     * @return Map containing success status, payment ID, and message
     */
    @AuraEnabled
    public static Map<String, Object> createPayment(Map<String, Object> paymentData) {
        
        Map<String, Object> response = new Map<String, Object>();
        
        try {
            // Extract and validate payment data
            String orderId = (String) paymentData.get('orderId');
            String accountId = (String) paymentData.get('accountId');
            Object amountObj = paymentData.get('amount');
            String paymentMethod = (String) paymentData.get('paymentMethod');
            Object outstandingObj = paymentData.get('outstandingAmount');
            
            // Get formData object - will be handled as generic Object
            Object formDataObj = paymentData.get('formData');
            Map<String, Object> formData = new Map<String, Object>();
            
            // If formData is provided, extract Strings from it safely
            if (formDataObj != null) {
                try {
                    String jsonStr = JSON.serialize(formDataObj);
                    Map<String, Object> parsed = (Map<String, Object>) JSON.deserializeUntyped(jsonStr);
                    if (parsed != null) {
                        formData = parsed;
                    }
                } catch (Exception parseErr) {
                    System.debug('Could not parse formData: ' + parseErr.getMessage());
                }
            }
            
            System.debug('=== Payment Creation Debug ===');
            System.debug('orderId: ' + orderId);
            System.debug('accountId: ' + accountId);
            System.debug('amount: ' + amountObj);
            System.debug('paymentMethod: ' + paymentMethod);
            System.debug('outstandingAmount: ' + outstandingObj);
            System.debug('formData: ' + formData);
            
            // Convert amount to Decimal
            Decimal amount = null;
            if (amountObj instanceof Decimal) {
                amount = (Decimal) amountObj;
            } else if (amountObj instanceof Double) {
                amount = Decimal.valueOf((Double) amountObj);
            } else if (amountObj instanceof String) {
                amount = Decimal.valueOf((String) amountObj);
            } else {
                amount = (Decimal) amountObj;
            }
            
            // Convert outstanding amount
            Decimal outstandingAmount = null;
            if (outstandingObj != null) {
                if (outstandingObj instanceof Decimal) {
                    outstandingAmount = (Decimal) outstandingObj;
                } else if (outstandingObj instanceof Double) {
                    outstandingAmount = Decimal.valueOf((Double) outstandingObj);
                } else if (outstandingObj instanceof String) {
                    outstandingAmount = Decimal.valueOf((String) outstandingObj);
                } else {
                    outstandingAmount = (Decimal) outstandingObj;
                }
            }
            
            // Validate required fields
            if (String.isBlank(orderId)) {
                response.put('success', false);
                response.put('message', 'Order ID is required');
                return response;
            }
            
            if (String.isBlank(accountId)) {
                response.put('success', false);
                response.put('message', 'Account ID is required');
                return response;
            }
            
            if (amount == null || amount <= 0) {
                response.put('success', false);
                response.put('message', 'Amount must be greater than 0');
                return response;
            }
            
            if (outstandingAmount != null && amount > outstandingAmount) {
                response.put('success', false);
                response.put('message', 'Payment amount cannot exceed outstanding amount of ' + outstandingAmount);
                return response;
            }
            
            if (String.isBlank(paymentMethod)) {
                response.put('success', false);
                response.put('message', 'Payment method is required');
                return response;
            }
            
            // Create Payment__c record with common fields
            Payment__c payment = new Payment__c();
            payment.Order__c = orderId;
            payment.Account__c = accountId;
            payment.Amount__c = amount;
            payment.Payment_Mode__c = paymentMethod;
            payment.Payment_Status__c = 'Success';
            payment.Payment_Date__c = System.now();
            
            // Set optional common fields
            if (formData != null) {
                String notes = (String) formData.get('notes');
                
                if (String.isNotBlank(notes)) {
                    payment.Notes__c = notes;
                }
                
                // Auto-generate Transaction ID for digital payment methods
                if (paymentMethod == 'UPI' || paymentMethod == 'Card' || paymentMethod == 'Bank Transfer') {
                    payment.Transaction_Id__c = generateTransactionId(paymentMethod);
                }
                
                // Set method-specific fields
                if (paymentMethod == 'Cash') {
                    String cashReceivedBy = (String) formData.get('cashReceivedBy');
                    String cashReceiptNumber = (String) formData.get('cashReceiptNumber');
                    
                    if (String.isNotBlank(cashReceivedBy)) {
                        payment.Cash_Received_By__c = cashReceivedBy;
                    }
                    if (String.isNotBlank(cashReceiptNumber)) {
                        payment.Cash_Receipt_Number__c = cashReceiptNumber;
                    }
                    
                } else if (paymentMethod == 'UPI') {
                    String upiId = (String) formData.get('upiId');
                    String upiName = (String) formData.get('upiName');
                    String upiAppName = (String) formData.get('upiAppName');
                    String upiReferenceNumber = (String) formData.get('upiReferenceNumber');
                    
                    if (String.isNotBlank(upiId)) {
                        payment.UPI_Id__c = upiId;
                    }
                    if (String.isNotBlank(upiName)) {
                        payment.UPI_Name__c = upiName;
                    }
                    if (String.isNotBlank(upiAppName)) {
                        payment.UPI_App_Name__c = upiAppName;
                    }
                    if (String.isNotBlank(upiReferenceNumber)) {
                        payment.UPI_Reference_Number__c = upiReferenceNumber;
                    }
                    
                } else if (paymentMethod == 'Card') {
                    String cardHolderName = (String) formData.get('cardHolderName');
                    String cardNumber = (String) formData.get('cardNumber');
                    String cardType = (String) formData.get('cardType');
                    
                    if (String.isNotBlank(cardHolderName)) {
                        payment.Card_Holder_Name__c = cardHolderName;
                    }
                    if (String.isNotBlank(cardNumber)) {
                        payment.Card_Number__c = cardNumber;
                    }
                    if (String.isNotBlank(cardType)) {
                        payment.Card_Type__c = cardType;
                    }
                    
                } else if (paymentMethod == 'Bank Transfer') {
                    String bankName = (String) formData.get('bankName');
                    String accountNumber = (String) formData.get('accountNumber');
                    String ifscCode = (String) formData.get('ifscCode');
                    String transferReferenceNumber = (String) formData.get('transferReferenceNumber');
                    
                    if (String.isNotBlank(bankName)) {
                        payment.Bank_Name__c = bankName;
                    }
                    if (String.isNotBlank(accountNumber)) {
                        payment.Account_Number__c = accountNumber;
                    }
                    if (String.isNotBlank(ifscCode)) {
                        payment.IFSC_Code__c = ifscCode;
                    }
                    if (String.isNotBlank(transferReferenceNumber)) {
                        payment.Transfer_Reference_Number__c = transferReferenceNumber;
                    }
                }
            }
            
            System.debug('Payment record to insert: ' + payment);
            
            // Insert payment record
            insert payment;
            
            System.debug('Payment inserted successfully with ID: ' + payment.Id);
            
            response.put('success', true);
            response.put('paymentId', payment.Id);
            response.put('message', 'Payment recorded successfully');
            
        } catch (DmlException e) {
            System.debug('DML Error: ' + e.getMessage());
            System.debug('DML Error Stack: ' + e.getStackTraceString());
            response.put('success', false);
            response.put('message', 'Error saving payment: ' + e.getMessage());
        } catch (Exception e) {
            System.debug('General Error: ' + e.getMessage());
            System.debug('Error Stack: ' + e.getStackTraceString());
            response.put('success', false);
            response.put('message', 'Error recording payment: ' + e.getMessage());
        }
        
        return response;
    }
    
    /**
     * Generates a unique transaction ID for digital payment methods
     * @param paymentMethod - The payment method (UPI, Card, Bank Transfer)  
     * @return String - The generated transaction ID
     */
    private static String generateTransactionId(String paymentMethod) {
        String prefix = paymentMethod.equals('Bank Transfer') ? 'BANK' : paymentMethod.substring(0, 3).toUpperCase();
        Long timestamp = System.now().getTime();
        String randomPart = String.valueOf(Math.abs(Math.random() * 1000000)).substring(0, 6);
        return prefix + '-' + timestamp + '-' + randomPart;
    }
}
