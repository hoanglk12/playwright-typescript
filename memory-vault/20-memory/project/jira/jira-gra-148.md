---
name: jira-gra-148
description: "GRA-148 [Story] PayPal Update - Pay in 4 [Checkout] — Critical | Done"
type: project
tags: [memory, project, jira, gra, story]
jira_key: GRA-148
jira_url: https://accentgr.atlassian.net/browse/GRA-148
jira_status: Done
jira_status_category: Done
jira_priority: Critical
jira_assignee: Zhi Wang
jira_labels: none
jira_created: 2024-03-06
jira_updated: 2024-09-02
last_verified: 2026-06-22
---

# GRA-148 — PayPal Update - Pay in 4 [Checkout]

| Field | Value |
|---|---|
| Type | Story |
| Status | **Done** (Done) |
| Priority | Critical |
| Assignee | Zhi Wang |
| Reporter | Supun Dissanayake |
| Labels | none |
| Created | 2024-03-06 |
| Updated | 2024-09-02 |
| Jira | [GRA-148](https://accentgr.atlassian.net/browse/GRA-148) |

## Description

As a Customer, I want to be able to make a payment using Pay Pal Pay in 4 option in the checkout, so that I can make my payments in 4 instalments.

Please Refer to the Parent Request of this story before the development work: https://accentgr.atlassian.net/browse/GRA-124 

Acceptance Criteria (Functional) 

- PayPal Pay in 4 is available as a payment option in checkout [Refer to the Figma design file and the PayPal Pay in 4 as a payment option in the checkout  screenshot below] 
  - PayPal Pay in 4 is available in addition to the PayPal Payments option
- Clicking on the Pay Pal Pay in 4 radio button will select the payment type and open up a text area with context around the payment method  [Refer to the Figma Design files and Paypal Pay in 4 radio button click behaviour screenshot below]
- When the customer clicks “Learn more” in the PayPal Pay in 4 message the standard SDK modal will pop-up, a customer should be able to close it using the 'x' icon at the top right corner of the modal.
  - Please refer to the SDK modal and Modal messaging https://codepen.io/Punna/pen/abKOdEj
- A customer has the ability to checkout using the selected method and by clicking “Place Order” button. i.e. if a customer has selected PayPal Pay in 4 radio button and clicked “Place Order” the PayPal modal should open with Pay in 4 option pre-selected.
- Update Paypal payment method expandable text display as per the designs [Refer to Figma Design files and  Paypal Pay expandable text updates screenshot below] 
  - The existing GRA site text needs to be slightly altered based on business needs
- Update Paypal logo as per the designs 
  - The current GRA sites have the old Paypal logo
- When the customer clicks either of the Pay Pal options, the CTA button will be changed to the proposed native pay pal buttons 
  - Please refer to https://accentgr.atlassian.net/browse/GRA-124?focusedCommentId=52302
- The following validations are added based on Accent Group request (https://accentgr.atlassian.net/browse/GRA-148?focusedCommentId=107241) on 27/05/2024
  - If the order is less than $30 don’t allow checking out/don't display the Pay in 4 payment option in this case.
  - If the payment fails due to a known issue such as insufficient funds, account deactivation etc. 
    - Display the error message - there should be a standard one for such cases.
  - If the payment fails with an unknown issues
    - Display a specific error message - again should be a standard one.

Considerations 

- All 4 GRA sites: PLA AU, SKX AU, VAN AU, DRM AU
- Implementation will work on both the website and the mobile [Designs available below]
- Paypal integration documentation: 
  - https://developer.paypal.com/docs/checkout/pay-later/au/integrate/ (https://developer.paypal.com/docs/checkout/pay-later/au/integrate/)
  -  https://developer.paypal.com/braintree/docs/guides/paypal/pay-later-offers/javascript/v3/ (https://developer.paypal.com/braintree/docs/guides/paypal/pay-later-offers/javascript/v3/)
- Paypal pay in 4 SDK cannot be used for 2 currencies with one client ID. Having one client ID per site is okay at the moment since we are only implementing this for AU GRA sites. However, in the future, if we need to make Pay Pal Pay in 4 work with multiple currencies, we will need multiple client IDs to handle multiple currencies.

Designs 

PayPal Pay in 4 as a payment option in the checkout 

Paypal Pay in 4 radio button click behaviour

NOTE: As discussed and agreed here →  https://accentgr.atlassian.net/browse/GRA-124?focusedCommentId=52302, The Place order button will be changed to native recommended Pay Pal button when the customer clicks the pay pal radio buttons 

Paypal Pay expandable text updates

Please check the full Desktop and Mobile Flow of Pay Pal Pay in 4 designs for GRA: https://www.figma.com/file/l0ahZABxfb7Z6o528u9Dmo/Accent-Sites?type=design&node-id=0-1&mode=design&t=ssCSKbJY0Lb6pj7y-0 

Tasks 

- [BE] Enable Pay Pal Pay in 4 in Adobe Commerce
- [FE] PayPal/PayPal Pay in 4 components implementation
