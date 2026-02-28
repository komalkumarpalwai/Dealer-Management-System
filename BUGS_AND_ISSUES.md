# DMS Application - Bugs and Issues Log

---

## 🔴 CRITICAL BUG FIXED

**ProductsPageController.cls Line 170:** Fixed AggregateResult field name mismatch
- Changed: `ar.get('Product__c')` 
- To: `ar.get('AMERP_Product__c')`
- This was causing a 500 Server Error and blocking the entire products page

**File Changed:** [force-app/main/default/classes/ProductsPageController.cls](force-app/main/default/classes/ProductsPageController.cls#L170)

---

## Issue #1: Products Not Displaying on Products Page (HIGH PRIORITY)

**Date Reported:** February 28, 2026  
**Component:** `productsPage` (LWC)  
**Status:** FIXED  
**Severity:** CRITICAL (Was blocking entire products page)  

### Description
Products page was throwing a 500 Server Error and no products were displaying.

### Affected Files
- [force-app/main/default/classes/ProductsPageController.cls](force-app/main/default/classes/ProductsPageController.cls)

### Root Cause (FOUND & FIXED) ✅

**Critical Field Name Mismatch in Stock Query**
- **Location:** [ProductsPageController.cls line 170](force-app/main/default/classes/ProductsPageController.cls#L170)
- **Issue:** The SOQL query selects `AMERP_Product__c` but the code was trying to retrieve `Product__c` from the result
- **Code Error:**
  ```apex
  List<AggregateResult> stockResults = [
      SELECT AMERP_Product__c, SUM(AMERP_Quantity__c) totalQty
      FROM AMERP_Stock__c
      ...
  ];
  
  for (AggregateResult ar : stockResults) {
      Id prodId = (Id) ar.get('Product__c');  // ❌ WRONG - doesn't exist!
      ...
  }
  ```
- **Fix Applied:**
  ```apex
  Id prodId = (Id) ar.get('AMERP_Product__c');  // ✅ CORRECT
  ```
- **Impact:** This field name mismatch caused a NullPointerException in Apex, resulting in the 500 error and complete failure of the products page load

### Secondary Issues (May still exist in filtering):

1. **Missing Product_Category__c Field**
   - **Location:** [productsPage.js line 649-653](force-app/main/default/lwc/productsPage/productsPage.js#L649-L653)
   - **Issue:** When `selectedCategory` filter is applied, products without `Product_Category__c` value are filtered out
   - **Impact:** May hide products after page loads successfully

2. **Missing Family Field**
   - **Location:** [productsPage.js line 657-661](force-app/main/default/lwc/productsPage/productsPage.js#L657-L661)
   - **Issue:** Products without a `Family` value are filtered out when family filter is applied
   - **Impact:** May hide products when family filter is selected

### Diagnostic Steps

1. **Check Browser Console**
   - Open DevTools (F12) → Console tab
   - Look for any JavaScript errors during product load

2. **Check Salesforce Debug Logs**
   - Enable debug logging for ProductsPageController
   - Look for log statements showing product count and stock map size
   - Search for: "===== STOCK QUERY DEBUG ====="

3. **Verify Product Data**
   - Check if all products have `Product_Category__c` populated
   - Verify products exist in the selected Pricebook
   - Confirm stock records exist in `AMERP_Stock__c` for products

4. **Test Scenarios**
   - Load page without any filters (All Products)
   - Check if missing products appear
   - Apply category filter and count displayed products
   - Compare total product count in Salesforce vs displayed products

### Solution Approaches

**Option 1: Handle Missing Fields Gracefully**
- Update filtering logic to not exclude products with missing fields
- Only apply filters if field has a value

**Option 2: Ensure Data Completeness**
- Create data migration to populate missing `Product_Category__c` values
- Add validation rules to enforce field population

**Option 3: Display All Products Regardless of Filter Status**
- Remove strict filtering requirements for category/family
- Use "undefined category" or "uncategorized" for products without values

### Required Actions

- [x] Fixed field name mismatch in ProductsPageController (AMERP_Product__c vs Product__c)
- [ ] Test products page load to confirm 500 error is resolved
- [ ] Verify all products now display correctly
- [ ] Check if any products still missing after main issue is fixed
- [ ] Address secondary filtering issues if products still hidden

### Next Steps
1. **Deploy the fix** - Push the ProductsPageController.cls change to your Salesforce org
2. **Clear browser cache** - Hard refresh the page (Ctrl+Shift+R or Cmd+Shift+R)
3. **Test the products page** - All products should now load without 500 error
4. **If products still missing** - Check the secondary issues (filtering logic) in productsPage.js
5. **Verify stock data** - Ensure products have corresponding AMERP_Stock__c records

---

## Quick Debug Commands

```sql
-- Find products without a category
SELECT Id, Name, Product_Category__c 
FROM Product2 
WHERE IsActive = true AND Product_Category__c = null;

-- Find products without family
SELECT Id, Name, Family 
FROM Product2 
WHERE IsActive = true AND Family = null;

-- Check products in pricebook
SELECT COUNT() 
FROM PricebookEntry 
WHERE Pricebook2Id = 'PRICEBOOK_ID' AND IsActive = true;

-- Check products with stock
SELECT AMERP_Product__c, SUM(AMERP_Quantity__c) 
FROM AMERP_Stock__c 
GROUP BY AMERP_Product__c;
```

---
