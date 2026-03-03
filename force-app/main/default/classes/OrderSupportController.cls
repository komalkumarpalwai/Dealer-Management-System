public with sharing class OrderSupportController {
    
    /**
     * Creates a Case from an Order with an internal comment
     * @param orderId The Id of the Order
     * @param subject The Case subject
     * @param description The Case description
     * @param internalComments Internal comments for the Case
     * @return The Case Number of the newly created Case
     */
    @AuraEnabled
    public static String createCase(Id orderId, String subject, String description, String internalComments) {
        try {
            // Validate inputs
            if (String.isBlank(subject) || String.isBlank(description)) {
                throw new AuraHandledException('Subject and Description are required');
            }
            
            // Query the Order record with AccountId
            Order orderRecord = [
                SELECT Id, AccountId
                FROM Order
                WHERE Id = :orderId
                WITH SECURITY_ENFORCED
                LIMIT 1
            ];
            
            if (orderRecord == null) {
                throw new AuraHandledException('Order not found');
            }
            
            // Query for a Contact related to the Account
            Id contactId = null;
            List<Contact> contacts = [
                SELECT Id
                FROM Contact
                WHERE AccountId = :orderRecord.AccountId
                LIMIT 1
            ];
            
            if (!contacts.isEmpty()) {
                contactId = contacts[0].Id;
            }
            
            // Create a new Case record
            Case newCase = new Case(
                AccountId = orderRecord.AccountId,
                ContactId = contactId,
                Origin = 'Web',
                Status = 'New',
                Subject = subject,
                Description = description,
                Comments = internalComments,
                Order__c = orderId
            );
            
            insert newCase;
            
            return newCase.CaseNumber;
            
        } catch (AuraHandledException e) {
            throw e;
        } catch (Exception e) {
            System.debug('Error creating case: ' + e.getMessage() + ' | Stack: ' + e.getStackTraceString());
            throw new AuraHandledException('Error creating case: ' + e.getMessage());
        }
    }

    /**
     * Retrieves all Cases related to an Order
     * @param orderId The Id of the Order
     * @return List of Case records related to the Order
     */
    @AuraEnabled
    public static List<Case> getCasesByOrder(Id orderId) {
        try {
            List<Case> cases = [
                SELECT Id, CaseNumber, Subject, Description, Status, Priority, CreatedDate
                FROM Case
                WHERE Order__c = :orderId
                WITH SECURITY_ENFORCED
                ORDER BY CreatedDate DESC
            ];
            return cases;
        } catch (Exception e) {
            System.debug('Error fetching cases: ' + e.getMessage());
            throw new AuraHandledException('Error fetching cases: ' + e.getMessage());
        }
    }
}
