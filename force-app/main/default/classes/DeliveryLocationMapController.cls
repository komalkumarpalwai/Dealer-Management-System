public with sharing class DeliveryLocationMapController {

    @AuraEnabled(cacheable=false)
    public static Map<String, Object> getDeliveryLocations() {

        Map<String, Object> result = new Map<String, Object>();

        try {

            User currentUser = [
                SELECT Contact.Account.Id,
                       Contact.Account.Name,
                       Contact.Account.ShippingStreet,
                       Contact.Account.ShippingCity,
                       Contact.Account.ShippingState,
                       Contact.Account.ShippingPostalCode,
                       Contact.Account.ShippingCountry
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

            if (String.isBlank(acc.ShippingCity) || String.isBlank(acc.ShippingCountry)) {
                result.put('success', false);
                result.put('message', 'Shipping address is incomplete. City and Country are required.');
                return result;
            }

            Http http = new Http();

            // ── Geocode Shipping Address ──
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

            // ── Hardcoded Billing Address: KRISH CARBON PVT LTD ──
            // IndiaLand Tech Park, Coimbatore, Tamil Nadu 641035, India
            // Will be replaced with dynamic Account.BillingAddress in future
            String billingEndpoint =
                'https://nominatim.openstreetmap.org/search?format=json&limit=1' +
                '&street=' + EncodingUtil.urlEncode('IndiaLand Tech Park', 'UTF-8') +
                '&city='   + EncodingUtil.urlEncode('Coimbatore', 'UTF-8') +
                '&state='  + EncodingUtil.urlEncode('Tamil Nadu', 'UTF-8') +
                '&postalcode=' + EncodingUtil.urlEncode('641035', 'UTF-8') +
                '&country=' + EncodingUtil.urlEncode('India', 'UTF-8');

            Map<String, Object> billingCoords = geocode(http, billingEndpoint);

            // Fallback: if full query fails, try just city + postalcode
            if (billingCoords == null) {
                String billingFallback =
                    'https://nominatim.openstreetmap.org/search?format=json&limit=1' +
                    '&city=' + EncodingUtil.urlEncode('Coimbatore', 'UTF-8') +
                    '&postalcode=' + EncodingUtil.urlEncode('641035', 'UTF-8') +
                    '&country=' + EncodingUtil.urlEncode('India', 'UTF-8');
                billingCoords = geocode(http, billingFallback);
            }

            if (billingCoords == null) {
                result.put('success', false);
                result.put('message', 'No coordinates found for the billing address.');
                return result;
            }

            // ── Build Shipping Address String ──
            List<String> shippingParts = new List<String>();
            if (String.isNotBlank(acc.ShippingStreet))     shippingParts.add(acc.ShippingStreet);
            if (String.isNotBlank(acc.ShippingCity))       shippingParts.add(acc.ShippingCity);
            if (String.isNotBlank(acc.ShippingState))      shippingParts.add(acc.ShippingState);
            if (String.isNotBlank(acc.ShippingPostalCode)) shippingParts.add(acc.ShippingPostalCode);
            if (String.isNotBlank(acc.ShippingCountry))    shippingParts.add(acc.ShippingCountry);

            result.put('success', true);
            result.put('accountId', acc.Id);
            result.put('accountName', acc.Name);
            result.put('shippingAddress', String.join(shippingParts, ', '));
            result.put('shippingLat', shippingCoords.get('lat'));
            result.put('shippingLon', shippingCoords.get('lon'));
            result.put('billingAddress', 'IndiaLand Tech Park, Coimbatore, Tamil Nadu 641035, India');
            result.put('billingLat', billingCoords.get('lat'));
            result.put('billingLon', billingCoords.get('lon'));

        } catch (Exception e) {
            result.put('success', false);
            result.put('message', 'Unexpected error: ' + e.getMessage());
        }

        return result;
    }

    // ── Helper: Geocode an address endpoint ──
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