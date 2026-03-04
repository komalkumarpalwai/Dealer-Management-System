public with sharing class PaymentReceiptController {

    // ─────────────────────────────────────────────────────────────────
    // ORDER DETAILS
    // ─────────────────────────────────────────────────────────────────
    public Order   order                    { get; set; }
    public String  orderNumber              { get; set; }
    public Decimal orderTotalAmount         { get; set; }
    public Decimal amountPaid               { get; set; }
    public Decimal outstandingAmount        { get; set; }
    public String  paymentStatus            { get; set; }
    public Date    orderStartDate           { get; set; }
    public Date    deliveryDate             { get; set; }

    // ─────────────────────────────────────────────────────────────────
    // PAYMENT DETAILS
    // latestPayment = the specific payment being viewed on this receipt
    // ─────────────────────────────────────────────────────────────────
    public Payment__c latestPayment         { get; set; }
    public Boolean    isSpecificPayment     { get; set; }

    // ─────────────────────────────────────────────────────────────────
    // CUSTOMER DETAILS
    // ─────────────────────────────────────────────────────────────────
    public String customerName              { get; set; }
    public String customerPhone             { get; set; }
    public String customerEmail             { get; set; }
    public String billingStreet             { get; set; }
    public String billingCity               { get; set; }
    public String billingPostalCode         { get; set; }
    public String billingCountry            { get; set; }
    public String billingFullAddress        { get; set; }
    public String shippingStreet            { get; set; }
    public String shippingCity              { get; set; }
    public String shippingPostalCode        { get; set; }
    public String shippingCountry           { get; set; }
    public String shippingFullAddress       { get; set; }

    // ─────────────────────────────────────────────────────────────────
    // AMOUNT SUMMARY
    // amountPaidBeforeThis = total paid before this payment
    // amountPaid           = total paid including this payment
    // balanceDue           = orderTotal - amountPaid
    // ─────────────────────────────────────────────────────────────────
    public Decimal amountPaidBeforeThis     { get; set; }
    public Decimal balanceDue               { get; set; }

    // ─────────────────────────────────────────────────────────────────
    // ERROR
    // ─────────────────────────────────────────────────────────────────
    public String errorMessage              { get; set; }

    // ─────────────────────────────────────────────────────────────────
    // CONSTRUCTOR
    // ─────────────────────────────────────────────────────────────────
    public PaymentReceiptController() {
        try {
            String orderId   = ApexPages.currentPage().getParameters().get('orderId');
            String paymentId = ApexPages.currentPage().getParameters().get('paymentId');

            // Initialize defaults
            isSpecificPayment    = false;
            amountPaidBeforeThis = 0;
            amountPaid           = 0;
            balanceDue           = 0;

            if (String.isBlank(orderId)) {
                errorMessage = 'Order ID is required to generate payment receipt.';
                return;
            }

            if (String.isBlank(paymentId)) {
                errorMessage = 'Payment ID is required to generate payment receipt.';
                return;
            }

            // ── STEP 1: Query Order ───────────────────────────────────
            List<Order> orders = [
                SELECT Id,
                       Name,
                       OrderNumber,
                       TotalAmount,
                       Amount_Paid__c,
                       Amount_Paid_From_Payments__c,
                       Outstanding_Amount__c,
                       Status,
                       EffectiveDate,
                       Delivery_Date__c,
                       AccountId
                FROM Order
                WHERE Id = :orderId
                LIMIT 1
            ];

            if (orders.isEmpty()) {
                errorMessage = 'Order not found.';
                return;
            }

            order             = orders[0];
            orderNumber       = order.OrderNumber;
            orderTotalAmount  = order.TotalAmount                  != null ? order.TotalAmount                  : 0;
            outstandingAmount = order.Outstanding_Amount__c        != null ? order.Outstanding_Amount__c        : 0;
            orderStartDate    = order.EffectiveDate;
            deliveryDate      = order.Delivery_Date__c;

            // ── STEP 2: Query Account ─────────────────────────────────
            if (order.AccountId != null) {
                List<Account> accounts = [
                    SELECT Id,
                           Name,
                           Phone,
                           BillingStreet,
                           BillingCity,
                           BillingPostalCode,
                           BillingCountry,
                           ShippingStreet,
                           ShippingCity,
                           ShippingPostalCode,
                           ShippingCountry
                    FROM Account
                    WHERE Id = :order.AccountId
                    LIMIT 1
                ];

                if (!accounts.isEmpty()) {
                    Account acc        = accounts[0];
                    customerName       = acc.Name              != null ? acc.Name              : '';
                    customerPhone      = acc.Phone             != null ? acc.Phone             : '';
                    customerEmail      = '';
                    billingStreet      = acc.BillingStreet     != null ? acc.BillingStreet     : '';
                    billingCity        = acc.BillingCity       != null ? acc.BillingCity       : '';
                    billingPostalCode  = acc.BillingPostalCode != null ? acc.BillingPostalCode : '';
                    billingCountry     = acc.BillingCountry    != null ? acc.BillingCountry    : '';
                    billingFullAddress = buildAddressString(billingStreet, billingCity, billingPostalCode, billingCountry);
                    shippingStreet     = acc.ShippingStreet     != null ? acc.ShippingStreet     : '';
                    shippingCity       = acc.ShippingCity       != null ? acc.ShippingCity       : '';
                    shippingPostalCode = acc.ShippingPostalCode != null ? acc.ShippingPostalCode : '';
                    shippingCountry    = acc.ShippingCountry    != null ? acc.ShippingCountry    : '';
                    shippingFullAddress = buildAddressString(shippingStreet, shippingCity, shippingPostalCode, shippingCountry);
                }
            }

            // ── STEP 3: Query the specific payment ────────────────────
            List<Payment__c> payments = [
                SELECT Id,
                       Name,
                       Order__c,
                       Amount__c,
                       Payment_Date__c,
                       Payment_Mode__c,
                       Payment_Status__c,
                       Transaction_Id__c,
                       UPI_Reference_Number__c,
                       UPI_Id__c,
                       UPI_Name__c,
                       UPI_App_Name__c,
                       Transfer_Reference_Number__c,
                       Cash_Receipt_Number__c,
                       Cash_Received_By__c,
                       Bank_Name__c,
                       Account_Number__c,
                       Card_Holder_Name__c,
                       Card_Number__c,
                       Card_Type__c,
                       IFSC_Code__c,
                       Notes__c,
                       CreatedDate
                FROM Payment__c
                WHERE Id       = :paymentId
                AND   Order__c = :orderId
                LIMIT 1
            ];

            if (payments.isEmpty()) {
                errorMessage = 'Payment record not found.';
                return;
            }

            latestPayment     = payments[0];
            isSpecificPayment = true;

            // Payment status shown on receipt = this payment's status
            paymentStatus = latestPayment.Payment_Status__c;

            // ── STEP 4: Calculate cumulative amounts ──────────────────
            // Sum all payments made BEFORE this one (chronologically)
            List<Payment__c> allPriorPayments = [
                SELECT Id,
                       Amount__c,
                       Payment_Date__c,
                       CreatedDate
                FROM Payment__c
                WHERE Order__c      = :orderId
                AND   Payment_Status__c = 'Success'
                AND   (Payment_Date__c < :latestPayment.Payment_Date__c
                       OR (Payment_Date__c = :latestPayment.Payment_Date__c
                           AND CreatedDate < :latestPayment.CreatedDate))
                ORDER BY Payment_Date__c ASC, CreatedDate ASC
            ];

            Decimal totalBeforeThis = 0;
            for (Payment__c p : allPriorPayments) {
                totalBeforeThis += (p.Amount__c != null ? p.Amount__c : 0);
            }

            amountPaidBeforeThis = totalBeforeThis;

            // amountPaid = all prior + this payment
            Decimal thisAmount = latestPayment.Amount__c != null ? latestPayment.Amount__c : 0;
            amountPaid         = totalBeforeThis + thisAmount;

            // balanceDue = orderTotal - amountPaid
            balanceDue = orderTotalAmount - amountPaid;
            if (balanceDue < 0) balanceDue = 0;

        } catch (Exception e) {
            errorMessage = 'Error loading payment receipt: ' + e.getMessage();
        }
    }

    // ─────────────────────────────────────────────────────────────────
    // HELPER — Build address string
    // ─────────────────────────────────────────────────────────────────
    private String buildAddressString(String street, String city, String postal, String country) {
        List<String> parts = new List<String>();
        if (String.isNotBlank(street))  parts.add(street);
        if (String.isNotBlank(city))    parts.add(city);
        if (String.isNotBlank(postal))  parts.add(postal);
        if (String.isNotBlank(country)) parts.add(country);
        return String.join(parts, ', ');
    }

    // ─────────────────────────────────────────────────────────────────
    // GENERATE & SAVE RECEIPT AS PDF
    // ─────────────────────────────────────────────────────────────────
    public PageReference generateAndSaveReceipt() {
        if (order == null || order.Id == null) {
            errorMessage = 'Cannot generate receipt: Order not loaded.';
            return null;
        }
        try {
            PageReference pdfPage = Page.PaymentReceiptPage;
            pdfPage.getParameters().put('orderId', order.Id);
            if (latestPayment != null) {
                pdfPage.getParameters().put('paymentId', latestPayment.Id);
            }

            Blob pdfBlob;
            if (Test.isRunningTest()) {
                pdfBlob = Blob.valueOf('MOCK_PDF_FOR_UNIT_TEST');
            } else {
                pdfBlob = pdfPage.getContentAsPDF();
            }

            String paymentRef = (latestPayment != null) ? latestPayment.Name : 'NoPmt';
            String datePart   = System.today().format().replace('/', '-');
            String fileName   = 'Payment_Receipt_' + orderNumber + '_' + paymentRef + '_' + datePart + '.pdf';

            ContentVersion cv  = new ContentVersion();
            cv.Title           = fileName;
            cv.PathOnClient    = fileName;
            cv.VersionData     = pdfBlob;
            cv.IsMajorVersion  = true;
            cv.ContentLocation = 'S';
            insert cv;

            ContentVersion inserted = [SELECT ContentDocumentId FROM ContentVersion WHERE Id = :cv.Id LIMIT 1];

            List<ContentDocumentLink> existingLinks = [
                SELECT Id FROM ContentDocumentLink
                WHERE ContentDocumentId = :inserted.ContentDocumentId
                AND   LinkedEntityId    = :order.Id
                LIMIT 1
            ];

            if (existingLinks.isEmpty()) {
                ContentDocumentLink cdl = new ContentDocumentLink();
                cdl.ContentDocumentId   = inserted.ContentDocumentId;
                cdl.LinkedEntityId      = order.Id;
                cdl.ShareType           = 'V';
                cdl.Visibility          = 'AllUsers';
                insert cdl;
            }

            PageReference download = new PageReference('/sfc/servlet.shepherd/document/download/' + inserted.ContentDocumentId);
            download.setRedirect(true);
            return download;

        } catch (Exception e) {
            errorMessage = 'Error generating receipt: ' + e.getMessage();
            return null;
        }
    }

    // ─────────────────────────────────────────────────────────────────
    // NAVIGATE BACK TO ORDER
    // ─────────────────────────────────────────────────────────────────
    public PageReference navigateToOrder() {
        if (order != null && order.Id != null) {
            return new PageReference('/' + order.Id);
        }
        return null;
    }
}