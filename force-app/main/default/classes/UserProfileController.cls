public with sharing class UserProfileController {

    @AuraEnabled(cacheable=true)
    public static Map<String, Object> getUserDetails() {

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
        ];

        // Add debug logs
        System.debug('=== getUserDetails ===');
        System.debug('User: ' + u.Name);
        System.debug('Contact: ' + (u.Contact != null ? u.Contact.Id : 'NULL'));
        System.debug('Account: ' + (u.Contact != null && u.Contact.Account != null ? u.Contact.Account.Name : 'NULL'));
        System.debug('Account_Type__c: ' + (u.Contact != null && u.Contact.Account != null ? u.Contact.Account.Account_Type__c : 'NULL'));

        Map<String, Object> result = new Map<String, Object>();
        result.put('user', u);
        result.put('account', u.Contact != null ? u.Contact.Account : null);
        
        // Add Account Type separately for easy access
        String accountType = '';
        if (u.Contact != null && u.Contact.Account != null && u.Contact.Account.Account_Type__c != null) {
            accountType = u.Contact.Account.Account_Type__c;
        }
        System.debug('Final accountType to return: ' + accountType);
        result.put('accountType', accountType);

        return result;
    }
}
