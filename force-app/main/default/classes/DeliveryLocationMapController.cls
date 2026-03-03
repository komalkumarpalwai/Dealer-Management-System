public with sharing class DeliveryLocationMapController {

    @AuraEnabled(cacheable=false)
    public static Map<String, Object> getDeliveryLocations() {

        Map<String, Object> result = new Map<String, Object>();

        try {

            User currentUser = [
                SELECT Contact.Account.Id,
                       Contact.Account.Name,

                       // Shipping
                       Contact.Account.ShippingStreet,
                       Contact.Account.ShippingCity,
                       Contact.Account.ShippingState,
                       Contact.Account.ShippingPostalCode,
                       Contact.Account.ShippingCountry,

                       // Billing
                       Contact.Account.BillingStreet,
                       Contact.Account.BillingCity,
                       Contact.Account.BillingState,
                       Contact.Account.BillingPostalCode,
                       Contact.Account.BillingCountry

                FROM User
                WHERE Id = :UserInfo.getUserId()
                LIMIT 1
            ];

            if (currentUser.Contact == null || currentUser.Contact.Account == null) {
                result.put('success', false);
                result.put('message', 'User is not associated with a Contact or Account.');
                return result;
            }

            Account acc = currentUser.Contact.Account;

            // Shipping validation
            if (String.isBlank(acc.ShippingCity) || String.isBlank(acc.ShippingCountry)) {
                result.put('success', false);
                result.put('message', 'Shipping address is incomplete. City and Country are required.');
                return result;
            }

            // Billing validation
            if (String.isBlank(acc.BillingCity) || String.isBlank(acc.BillingCountry)) {
                result.put('success', false);
                result.put('message', 'Billing address is incomplete. City and Country are required.');
                return result;
            }

            Http http = new Http();

            // --------- SHIPPING GEOCODE ----------
            String shippingEndpoint = 'https://nominatim.openstreetmap.org/search?format=json&limit=1';

            if (String.isNotBlank(acc.ShippingStreet))
                shippingEndpoint += '&street=' + EncodingUtil.urlEncode(acc.ShippingStreet, 'UTF-8');

            shippingEndpoint += '&city=' + EncodingUtil.urlEncode(acc.ShippingCity, 'UTF-8');

            if (String.isNotBlank(acc.ShippingState))
                shippingEndpoint += '&state=' + EncodingUtil.urlEncode(acc.ShippingState, 'UTF-8');

            if (String.isNotBlank(acc.ShippingPostalCode))
                shippingEndpoint += '&postalcode=' + EncodingUtil.urlEncode(acc.ShippingPostalCode, 'UTF-8');

            shippingEndpoint += '&country=' + EncodingUtil.urlEncode(acc.ShippingCountry, 'UTF-8');

            Map<String, Object> shippingCoords = geocode(http, shippingEndpoint);

            if (shippingCoords == null) {
                result.put('success', false);
                result.put('message', 'No coordinates found for the shipping address.');
                return result;
            }

            // --------- BILLING GEOCODE ----------
            String billingEndpoint = 'https://nominatim.openstreetmap.org/search?format=json&limit=1';

            if (String.isNotBlank(acc.BillingStreet))
                billingEndpoint += '&street=' + EncodingUtil.urlEncode(acc.BillingStreet, 'UTF-8');

            billingEndpoint += '&city=' + EncodingUtil.urlEncode(acc.BillingCity, 'UTF-8');

            if (String.isNotBlank(acc.BillingState))
                billingEndpoint += '&state=' + EncodingUtil.urlEncode(acc.BillingState, 'UTF-8');

            if (String.isNotBlank(acc.BillingPostalCode))
                billingEndpoint += '&postalcode=' + EncodingUtil.urlEncode(acc.BillingPostalCode, 'UTF-8');

            billingEndpoint += '&country=' + EncodingUtil.urlEncode(acc.BillingCountry, 'UTF-8');

            Map<String, Object> billingCoords = geocode(http, billingEndpoint);

            if (billingCoords == null) {
                result.put('success', false);
                result.put('message', 'No coordinates found for the billing address.');
                return result;
            }

            // --------- BUILD SHIPPING STRING ----------
            List<String> shippingParts = new List<String>();
            if (String.isNotBlank(acc.ShippingStreet))     shippingParts.add(acc.ShippingStreet);
            if (String.isNotBlank(acc.ShippingCity))       shippingParts.add(acc.ShippingCity);
            if (String.isNotBlank(acc.ShippingState))      shippingParts.add(acc.ShippingState);
            if (String.isNotBlank(acc.ShippingPostalCode)) shippingParts.add(acc.ShippingPostalCode);
            if (String.isNotBlank(acc.ShippingCountry))    shippingParts.add(acc.ShippingCountry);

            // --------- BUILD BILLING STRING ----------
            List<String> billingParts = new List<String>();
            if (String.isNotBlank(acc.BillingStreet))     billingParts.add(acc.BillingStreet);
            if (String.isNotBlank(acc.BillingCity))       billingParts.add(acc.BillingCity);
            if (String.isNotBlank(acc.BillingState))      billingParts.add(acc.BillingState);
            if (String.isNotBlank(acc.BillingPostalCode)) billingParts.add(acc.BillingPostalCode);
            if (String.isNotBlank(acc.BillingCountry))    billingParts.add(acc.BillingCountry);

            result.put('success', true);
            result.put('accountId', acc.Id);
            result.put('accountName', acc.Name);

            result.put('shippingAddress', String.join(shippingParts, ', '));
            result.put('shippingLat', shippingCoords.get('lat'));
            result.put('shippingLon', shippingCoords.get('lon'));

            result.put('billingAddress', String.join(billingParts, ', '));
            result.put('billingLat', billingCoords.get('lat'));
            result.put('billingLon', billingCoords.get('lon'));

        } catch (Exception e) {
            result.put('success', false);
            result.put('message', 'Unexpected error: ' + e.getMessage());
        }

        return result;
    }

    private static Map<String, Object> geocode(Http http, String endpoint) {

        try {
            HttpRequest req = new HttpRequest();
            req.setEndpoint(endpoint);
            req.setMethod('GET');
            req.setHeader('User-Agent', 'SalesforceDeliveryMapApp/1.0');
            req.setHeader('Accept', 'application/json');

            HttpResponse res = http.send(req);

            if (res.getStatusCode() != 200) return null;

            List<Object> data = (List<Object>) JSON.deserializeUntyped(res.getBody());
            if (data == null || data.isEmpty()) return null;

            Map<String, Object> first = (Map<String, Object>) data[0];

            String lat = (String) first.get('lat');
            String lon = (String) first.get('lon');

            if (String.isBlank(lat) || String.isBlank(lon)) return null;

            Map<String, Object> coords = new Map<String, Object>();
            coords.put('lat', lat);
            coords.put('lon', lon);

            return coords;

        } catch (Exception e) {
            return null;
        }
    }
}