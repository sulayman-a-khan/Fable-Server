# Fable — Digital Ebook Sharing Platform

**Live URL**: [https://fable-book.vercel.app](https://fable-book.vercel.app)

Fable is a premium, secure, and visually stunning digital platform built using the MERN stack and Next.js 16. It connects ebook lovers, readers, and collectors with talented independent writers.

## Project Structure

```
assignment10/
├── client/              # Next.js 16 Frontend (React 19, App Router)
│   ├── src/
│   │   ├── app/         # Pages and layouts
│   │   ├── components/  # Reusable UI components
│   │   ├── contexts/    # Auth context provider
│   │   ├── lib/         # API service layer (Axios)
│   │   └── proxy.js     # Route protection (Next.js 16)
│   ├── public/          # Static assets
│   ├── .env.local       # Client environment variables
│   ├── next.config.mjs  # Next.js configuration
│   └── package.json     # Client dependencies
│
├── server/              # Express.js Backend API
│   ├── src/
│   │   ├── controllers/ # Route handlers
│   │   ├── middleware/   # Auth, RBAC, validation
│   │   ├── models/      # Mongoose schemas
│   │   ├── routes/      # API route definitions
│   │   ├── utils/       # Helpers (error handler, secrets)
│   │   └── index.js     # Server entry point
│   ├── .env             # Server environment variables
│   ├── .env.example     # Server env template
│   └── package.json     # Server dependencies
│
├── .gitignore
├── package.json         # Root scripts (convenience)
└── README.md
```

## Features

### Reader / User Features
- **Library Discovery**: Browse all published books with advanced client-side search, filtering (by genre/price), sorting, and pagination.
- **Digital Bookshelf**: Access a centralized dashboard tracking purchase history, unlocked library books, bookmarked titles, and profile details.
- **Secure Purchases**: Buy books securely via integrated Stripe Checkout.
- **Fable Premium Reader**: Read purchased or free ebooks directly inside the browser using a custom-designed luxurious reading interface.
- **Interactive Bookmarks**: Toggle bookmarks on ebooks to build a personal reading list.

### Writer Features
- **Creations Management**: Upload new books, configure details (title, genre, price, cover art), edit, or delete listings.
- **imgBB Proxy Uploads**: Upload book cover images securely via a proxy server with file type validation, size constraints, and direct URL copy fallbacks.
- **Analytics Overview**: Track publication metrics (total creations, total sales count, total revenue).
- **Earnings & Sales History**: View a descriptive log detailing individual customer orders and income.

### Administrative Features
- **Analytics & Trends**: View platform overview statistics (total users, writers, books, sales, revenue) accompanied by beautiful visual trend graphs (Monthly Sales and Genre Distribution).
- **Submissions Audit**: Toggle publication visibility (Publish/Unpublish) or permanently delete books from the system.
- **Account Control**: Audit user credentials, delete accounts, or change user authorization roles ('user', 'writer', 'admin').
- **Audit Logs**: View a detailed, system-wide log of transactions.

## Technologies Used

### Client (Next.js 16 App Router)
- **Next.js 16 & React 19**
- **Vanilla CSS** (Custom Design System with dark luxurious theme)
- **Framer Motion** (Micro-animations and transitions)
- **Axios** (HTTP client with HttpOnly credential options)
- **Recharts** (Interactive dashboard graphs)
- **React Icons** (Standard iconography)
- **React Hot Toast** (Toast notifications)

### Server (Express.js API)
- **Node.js & Express.js**
- **MongoDB & Mongoose ODM**
- **JSON Web Tokens (JWT)** (Secure HttpOnly cookies)
- **Bcrypt** (Password hashing, 12 salt rounds)
- **Helmet, CORS, rate-limiting** (Stricter security rules)
- **Stripe SDK** (Payment processing)
- **Multer** (File uploading validation)

---

## Installation & Setup

### 1. Prerequisites
- Node.js (v18+)
- MongoDB (Local instance or MongoDB Atlas Cluster URI)
- Stripe Account (for publishable and secret keys)
- imgBB Account (for API Key)

### 2. Install Dependencies
```bash
# From the project root — install both client and server
npm run install:all

# Or install individually
cd client && npm install
cd ../server && npm install
```

### 3. Configure Server Environment Variables
Create a `.env` file inside the `server/` directory (copy from `.env.example`):
```env
PORT=5000
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/fable
JWT_SECRET=your_secure_jwt_secret_here
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
IMGBB_API_KEY=...
CLIENT_URL=http://localhost:3000
```

### 4. Configure Client Environment Variables
Create a `.env.local` file inside the `client/` directory:
```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

### 5. Run the Application

#### Start the Server Backend
```bash
cd server
npm run dev     # Launches with nodemon on port 5000
```

#### Start the Client Frontend
```bash
cd client
npm run dev     # Launches Next.js dev server on port 3000
```

#### Or from the project root
```bash
npm run dev:server   # Start backend
npm run dev:client   # Start frontend (in separate terminal)
```

Visit `http://localhost:3000` to interact with Fable.

---

## Seed Admin Credentials
To access the administrative dashboard, sign in using the automatically seeded credentials:
- **Email**: `admin@fable.com`
- **Password**: `Admin@123`

---

## Security Compliance & Protections
- **CORS Protection**: Origin restrictions configured dynamically.
- **CSRF & Token Security**: JWT credentials stored exclusively in `HttpOnly` cookie context.
- **Rate-Limiting**: IP requests are throttled at a maximum of 200 per 15 mins (20 per 15 mins for auth).
- **Validation**: Strict validation of input types using `express-validator` on the server-side.
