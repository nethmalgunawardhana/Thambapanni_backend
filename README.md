# Thambapanni Backend

The backend server for Thambapanni - a revolutionary travel app for Sri Lankan tourism that connects travelers with authentic local experiences while empowering Sri Lankan guides and communities.

## 🚀 Features

- User authentication and profile management
- Guide verification and management
- Trip listing
- payment processing
- AI-powered trip genaration
- password Reset process with otp
- Email notifications
- Bookmarks
  


## 🔧 Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: Firebase Firestore
- **Authentication**: JWT (JSON Web Tokens)
- **APIs Integration**:
  - Google Gemini (for AI-powered recommendations)
  - Stripe (for payment processing)
  - SendGrid (for email notifications)
  - ImageKit.io (for image processing and storage)
- **Deployment**: Railway

## 📋 Prerequisites

- Node.js v16+
- npm or yarn
- Firebase account
- API keys for:
  - Firebase
  - Google Gemini
  - Stripe
  - SendGrid
  - ImageKit.io

## 🛠️ Installation and Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/nethmalgunawardhana/Thambapanni_backend.git
   cd Thambapanni_backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Setup environment variables**
   Create a `.env` file in the root directory with the following variables:
   ```
   PORT=8000
   NODE_ENV=development
   
   # Firebase
   FIREBASE_API_KEY=your_firebase_api_key
   FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
   FIREBASE_PROJECT_ID=your_firebase_project_id
   FIREBASE_STORAGE_BUCKET=your_firebase_storage_bucket
   FIREBASE_MESSAGING_SENDER_ID=your_firebase_messaging_sender_id
   FIREBASE_APP_ID=your_firebase_app_id
   
   # JWT
   JWT_SECRET=your_jwt_secret
   JWT_EXPIRES_IN=90d
   
   # Google Gemini
   GEMINI_API_KEY=your_gemini_api_key
   
   # Stripe
   STRIPE_SECRET_KEY=your_stripe_secret_key
   STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
   
   # SendGrid
   SENDGRID_API_KEY=your_sendgrid_api_key
   SENDGRID_FROM_EMAIL=your_verified_sender_email
   
   # ImageKit
   IMAGEKIT_PUBLIC_KEY=your_imagekit_public_key
   IMAGEKIT_PRIVATE_KEY=your_imagekit_private_key
   IMAGEKIT_URL_ENDPOINT=your_imagekit_url_endpoint
   ```

## 👥 Team

- **Nethmal Gunawardhana** - Team Leader
- **Aditha Buwaneka**
- **Randitha Kulasekara**
- **Lasitha Hasaranga**

## 📜 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🔗 Related Projects

- [Thambapanni Frontend](https://github.com/nethmalgunawardhana/Thambapanni)
- [Thambapanni Website](https://github.com/RandithaK/Thambapanni_Website)
