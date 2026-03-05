public without sharing class PaymentReceiptController {

    public Order order {get;set;}
    public Payment__c latestPayment {get;set;}

    public String orderNumber {get;set;}
    public Decimal orderTotalAmount {get;set;}
    public Decimal amountPaid {get;set;}
    public Decimal amountPaidBeforeThis {get;set;}
    public Decimal balanceDue {get;set;}

    public Date orderStartDate {get;set;}
    public Date deliveryDate {get;set;}

    public String customerName {get;set;}
    public String customerEmail {get;set;}
    public String customerPhone {get;set;}
    public String billingStreet {get;set;}
    public String billingCity {get;set;}
    public String billingPostalCode {get;set;}
    public String billingCountry {get;set;}

    public String paymentStatus {get;set;}
    public String errorMessage {get;set;}

    public PaymentReceiptController(){

        try{

            String orderId = ApexPages.currentPage().getParameters().get('orderId');
            String paymentId = ApexPages.currentPage().getParameters().get('paymentId');

            System.debug('OrderId: ' + orderId);
            System.debug('PaymentId: ' + paymentId);

            if(String.isBlank(orderId) || String.isBlank(paymentId)){
                errorMessage = 'OrderId or PaymentId missing';
                return;
            }

            /* ---------------- ORDER ---------------- */

            order = [
                SELECT Id,
                       OrderNumber,
                       TotalAmount,
                       EffectiveDate,
                       Delivery_Date__c,
                       AccountId
                FROM Order
                WHERE Id = :orderId
                LIMIT 1
            ];

            orderNumber = order.OrderNumber;
            orderTotalAmount = order.TotalAmount;
            orderStartDate = order.EffectiveDate;
            deliveryDate = order.Delivery_Date__c;

            /* ---------------- ACCOUNT ---------------- */

            if(order.AccountId != null){

                Account acc = [
                    SELECT Name, Phone, Email__c, BillingStreet, BillingCity, BillingPostalCode, BillingCountry
                    FROM Account
                    WHERE Id = :order.AccountId
                    LIMIT 1
                ];

                customerName = acc.Name;
                customerPhone = acc.Phone;
                customerEmail = acc.Email__c;
                billingStreet = acc.BillingStreet;
                billingCity = acc.BillingCity;
                billingPostalCode = acc.BillingPostalCode;
                billingCountry = acc.BillingCountry;
            }

            /* ---------------- PAYMENT ---------------- */

            latestPayment = [
                SELECT Id,
                       Name,
                       Amount__c,
                       Payment_Date__c,
                       Payment_Mode__c,
                       Payment_Status__c,
                       Transaction_Id__c,
                       UPI_Reference_Number__c,
                       Transfer_Reference_Number__c,
                       Cash_Receipt_Number__c,
                       CreatedDate
                FROM Payment__c
                WHERE Id = :paymentId
                LIMIT 1
            ];

            paymentStatus = latestPayment.Payment_Status__c;

            /* ---------------- PAYMENT CALCULATION ---------------- */

            List<Payment__c> previousPayments = [
                SELECT Amount__c
                FROM Payment__c
                WHERE Order__c = :orderId
                AND CreatedDate < :latestPayment.CreatedDate
            ];

            Decimal totalBefore = 0;

            for(Payment__c p : previousPayments){
                if(p.Amount__c != null){
                    totalBefore += p.Amount__c;
                }
            }

            amountPaidBeforeThis = totalBefore;

            Decimal thisPayment = latestPayment.Amount__c != null ? latestPayment.Amount__c : 0;

            amountPaid = totalBefore + thisPayment;

            balanceDue = orderTotalAmount - amountPaid;

            if(balanceDue < 0){
                balanceDue = 0;
            }

        }
        catch(Exception e){

            errorMessage = 'Error: ' + e.getMessage();
            System.debug('Controller Error: ' + e);
        }
    }
}