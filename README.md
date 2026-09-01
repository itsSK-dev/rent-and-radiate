# Rent & Radiate

Build a full-stack web application for a rental marketplace focused on dresses and jewellery.

APP OVERVIEW:

The platform connects users with nearby stores where they can rent dresses and jewellery. Users can browse products, rent items for a specific duration, pay online, and return the product later to receive a refundable deposit.

USER ROLES:

1. Customer (end user)

2. Store Owner (vendor)

3. Admin

CORE FEATURES:

1. AUTHENTICATION:

- User signup/login (email & password)

- Role-based access (customer, store owner, admin)

2. LOCATION-BASED SEARCH:

- Detect user location or allow manual input

- Show nearby stores and available products

- Sort by distance, price, rating

3. PRODUCT LISTING:

- Categories: Dresses, Jewellery

- Each product should include:

  - Images

  - Price per day

  - Security deposit

  - Store name

  - Availability calendar

  - Product condition details

4. RENTAL SYSTEM:

- User selects rental start and end date

- Automatically calculate total price

- Pricing formula:

  Total Payment = Rental Price + Security Deposit

- Show clear cost breakdown

5. ORDER & BOOKING:

- Book product

- Order status: Pending, Confirmed, Delivered, Returned, Cancelled

- Track rental duration

6. PAYMENT INTEGRATION:

- Integrate Razorpay or Stripe

- Payment includes rental fee + security deposit

- Store payment status securely

7. DELIVERY SYSTEM:

- Option for delivery or store pickup

- User enters address

- Basic delivery tracking status

8. RETURN & REFUND SYSTEM:

- Customer initiates return

- Store/Admin verifies item condition

- Refund is based on condition:

  - Perfect condition → 100% deposit refund

  - Minor damage → 70–80% refund

  - Major damage → 30–50% refund

  - Lost item → 0% refund

- Refund processed after verification

9. FRAUD PREVENTION SYSTEM:

- Mandatory image upload:

  - Before delivery (by store)

  - At delivery (by delivery agent or customer)

  - After return (by store)

- Store item condition before and after rental

- Maintain proof images for dispute resolution

10. DISPUTE MANAGEMENT:

- If customer or store raises dispute:

  - Admin reviews images and order details

  - Admin decides refund manually

- Maintain dispute logs

11. TRUST & RATING SYSTEM:

- Customers can rate stores

- Stores can rate customers

- Maintain trust score for each user

- Flag or block suspicious users

12. STORE OWNER DASHBOARD:

- Add/edit/delete products

- Upload product images and condition

- View bookings and orders

- Manage returns and approve refunds

- View earnings

13. ADMIN PANEL:

- Manage users and stores

- Approve store registrations

- Handle disputes and refunds

- Monitor fraud activity

- Block users if necessary

UI/UX REQUIREMENTS:

- Modern clean UI (similar to Myntra/Ajio style)

- Mobile responsive design

- Product cards with images and pricing

- Easy navigation, filters, and search

TECHNICAL REQUIREMENTS:

- React frontend

- Node.js + Express backend

- MongoDB or Supabase database

- REST API architecture

- Proper folder structure (client/server)

- Secure authentication using JWT

EXTRA FEATURES (if possible):

- Wishlist

- Notifications (order updates)

- Email/SMS alerts

- Order history

OUTPUT REQUIREMENTS:

- Generate full working code

- Include frontend + backend + database schema

- Include API routes and models

- Make project ready for GitHub export

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://rent-and-radiate.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/975ce3eb-1db0-470c-a1b5-5cdc2bd784f0).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
