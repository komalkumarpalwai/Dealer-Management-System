public with sharing class PartnerApplicationController {

    @AuraEnabled
    public static String createPartnerApplication(Map<String, Object> appData) {

        try {

            Partner_Application__c app = new Partner_Application__c();

            // ── Business Information ───────────────────────────────────────
            app.Business_Name__c                      = (String)  appData.get('Business_Name__c');
            app.Business_Type__c                      = (String)  appData.get('Business_Type__c');
            app.Brand_Name__c                         = (String)  appData.get('Brand_Name__c');
            app.AMERP_Business_Registration_Number__c = (String)  appData.get('AMERP_Business_Registration_Number__c');
            app.Year_Started__c                       = appData.get('Year_Started__c') != null ? Integer.valueOf(String.valueOf(appData.get('Year_Started__c'))) : null;
            app.Years_in_Business__c                  = appData.get('Years_in_Business__c') != null ? Integer.valueOf(String.valueOf(appData.get('Years_in_Business__c'))) : null;

            // ── Financial Information ─────────────────────────────────────
            app.Annual_Revenue__c                     = appData.get('Annual_Revenue__c') != null ? Decimal.valueOf(String.valueOf(appData.get('Annual_Revenue__c'))) : null;
            app.Monthly_Sales_Target__c               = appData.get('Monthly_Sales_Target__c') != null ? Decimal.valueOf(String.valueOf(appData.get('Monthly_Sales_Target__c'))) : null;
            app.AMERP_Expected_Monthly_Sales__c       = appData.get('AMERP_Expected_Monthly_Sales__c') != null ? Decimal.valueOf(String.valueOf(appData.get('AMERP_Expected_Monthly_Sales__c'))) : null;
            app.Credit_Limit_Requested__c             = appData.get('Credit_Limit_Requested__c') != null ? Decimal.valueOf(String.valueOf(appData.get('Credit_Limit_Requested__c'))) : null;

            // ── Tax Information ───────────────────────────────────────────
            app.GST_Number__c                         = (String)  appData.get('GST_Number__c');
            app.PAN_Number__c                         = (String)  appData.get('PAN_Number__c');
            app.AMERP_TAN_Number__c                   = (String)  appData.get('AMERP_TAN_Number__c');

            // ── Contact Information ───────────────────────────────────────
            app.Primary_Contact_Name__c               = (String)  appData.get('Primary_Contact_Name__c');
            app.Email__c                              = (String)  appData.get('Email__c');
            app.Phone__c                              = (String)  appData.get('Phone__c');
            app.Account_Holder_Name__c                = (String)  appData.get('Account_Holder_Name__c');

            // ── Address Information ───────────────────────────────────────
            app.Billing_Address__c                    = (String)  appData.get('Billing_Address__c');
            app.Warehouse_Address__c                  = (String)  appData.get('Warehouse_Address__c');
            app.AMERP_City__c                         = (String)  appData.get('AMERP_City__c');
            app.AMERP_District__c                     = (String)  appData.get('AMERP_District__c');
            app.AMERP_State__c                        = (String)  appData.get('AMERP_State__c');
            app.AMERP_Country__c                      = (String)  appData.get('AMERP_Country__c');
            app.AMERP_Pincode__c                      = (String)  appData.get('AMERP_Pincode__c');

            // ── Bank Information ──────────────────────────────────────────
            app.AMERP_Bank_Name__c                    = (String)  appData.get('AMERP_Bank_Name__c');
            app.AMERP_Bank_Branch__c                  = (String)  appData.get('AMERP_Bank_Branch__c');
            app.AMERP_Bank_Account_Number__c          = (String)  appData.get('AMERP_Bank_Account_Number__c');
            app.AMERP_IFSC_Code__c                    = (String)  appData.get('AMERP_IFSC_Code__c');
            app.AMERP_UPI_ID__c                       = (String)  appData.get('AMERP_UPI_ID__c');

            // ── Operational Information ───────────────────────────────────
            app.AMERP_Shop_License_Number__c          = (String)  appData.get('AMERP_Shop_License_Number__c');
            app.AMERP_Delivery_Vehicles__c            = appData.get('AMERP_Delivery_Vehicles__c') != null ? Integer.valueOf(String.valueOf(appData.get('AMERP_Delivery_Vehicles__c'))) : null;
            app.AMERP_Number_of_Sales_Staff__c        = (String)  appData.get('AMERP_Number_of_Sales_Staff__c');
            app.AMERP_Warehouse_Size__c               = appData.get('AMERP_Warehouse_Size__c') != null ? Decimal.valueOf(String.valueOf(appData.get('AMERP_Warehouse_Size__c'))) : null;
            app.CurrencyIsoCode                       = (String)  appData.get('CurrencyIsoCode');

            // ── Default Status ────────────────────────────────────────────
            if (app.Status__c == null) {
                app.Status__c = 'Draft';
            }

            insert app;

            return 'SUCCESS';

        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }
}