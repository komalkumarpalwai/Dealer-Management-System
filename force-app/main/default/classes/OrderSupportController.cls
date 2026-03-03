public without sharing class OrderSupportController {
    
    @AuraEnabled
    public static String createCase(Id orderId, String subject, String description, String internalComments) {
        try {
            if (String.isBlank(subject) || String.isBlank(description)) {
                throw new AuraHandledException('Subject and Description are required');
            }
            
            Order orderRecord = [
                SELECT Id, AccountId
                FROM Order
                WHERE Id = :orderId
                WITH SECURITY_ENFORCED
                LIMIT 1
            ];
            
            Id contactId = null;
            List<Contact> contacts = [
                SELECT Id
                FROM Contact
                WHERE AccountId = :orderRecord.AccountId
                WITH SECURITY_ENFORCED
                LIMIT 1
            ];
            
            if (!contacts.isEmpty()) {
                contactId = contacts[0].Id;
            }
            
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
            throw new AuraHandledException('Error creating case: ' + e.getMessage());
        }
    }

    @AuraEnabled
    public static List<Case> getCasesByOrder(Id orderId) {
        try {
            if (orderId == null) {
                throw new AuraHandledException('Order ID is required');
            }

            List<Case> cases = [
                SELECT Id, CaseNumber, Subject, Description, Status, Priority, CreatedDate, Order__c
                FROM Case
                WHERE Order__c = :orderId
                ORDER BY CreatedDate DESC
            ];
            
            return cases;
            
        } catch (AuraHandledException e) {
            throw e;
        } catch (Exception e) {
            throw new AuraHandledException('Error fetching cases: ' + e.getMessage());
        }
    }
}