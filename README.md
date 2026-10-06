# THE WEAR — Complete E-commerce Website

A brand-new, self-contained fashion/headwear storefront inspired by the shopping structure of BRIM PAK, but with an original THE WEAR visual identity.

## Included

Customer:
- Home page
- Shop / all products
- Search
- Category filter
- Sorting
- Product detail
- Add to cart
- Cart
- Checkout
- Cash on Delivery
- Place order
- Order success
- About
- Shipping
- Returns
- Privacy
- Contact

Admin:
- Admin login
- Dashboard
- Product list / delete
- Orders
- Order status
- Customers
- Revenue / product / order counters

## Demo login
Email: admin@thewear.pk
Password: admin123

The demo admin uses browser storage so the project can be opened immediately without Node.js.

## Production database

The project includes a Firebase configuration template and Firestore rules under /firebase.
For production, create a NEW Firebase project only for THE WEAR and connect its credentials. Do not connect the existing Iqbal Sweet House Firebase project.

## Domain

Publish this project to:
https://thewear.iqbalsweets.com.pk

## Important

The included localStorage mode is fully usable for design/testing, but it is not a production database. Before accepting real customer orders at scale, connect Firebase/Firestore and Firebase Authentication, then tighten Firestore rules around your admin UID.
