# Project Bolt - Zone & Ward Management Dashboard

This application is a React (Next.js) dashboard for managing **Zones** and **Wards** within Local Governments. It supports role-based access for Super Admins, Ward Admins, and Zonal Admins, and is integrated with Firebase for data storage and authentication.

---

## Features

- **Role-Based Access Control**
  - **Super Admin:** Full access to all wards and zones, can create, edit, and delete.
  - **Ward Admin:** Manage all zones under their assigned ward.
  - **Zonal Admin:** Manage and view only their assigned zone.

- **Zone & Ward Management**
  - Create, edit, and delete zones under wards.
  - Assign zones to wards.
  - View statistics for users in each zone (total, verified, pending).
  - View and manage wards.

- **User Management**
  - Assign users to zones and wards.
  - View user statistics per zone.

- **Modern UI**
  - Built with React, Next.js, and Tailwind CSS.
  - Uses Framer Motion for smooth animations.
  - Responsive and accessible design.

- **Firebase Integration**
  - Firestore for data storage.
  - Firebase Auth for authentication.
  - Real-time updates.

---

## Getting Started

### Prerequisites

- Node.js (v18+ recommended)
- Yarn or npm
- Firebase project (Firestore & Auth enabled)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-org/project-bolt.git
   cd project-bolt
   ```

2. **Install dependencies:**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Configure Firebase:**
   - Copy `.env.example` to `.env.local` and fill in your Firebase credentials.

4. **Run the development server:**
   ```bash
   npm run dev
   # or
   yarn dev
   ```

5. **Open in your browser:**
   ```
   http://localhost:3000
   ```

---

## Project Structure

- `/app` - Next.js app directory (pages, components, layouts)
- `/components` - Reusable UI components
- `/contexts` - React context providers (e.g., Auth)
- `/lib` - Firebase configuration and utilities

---

## Key Files

- `app/dashboard/wards/page.tsx` - Ward management UI and logic
- `app/dashboard/zones/page.tsx` - Zone management UI and logic
- `contexts/AuthContext.tsx` - Authentication context and hooks
- `lib/firebase.ts` - Firebase initialization

---

## Customization

- **Roles:** Adjust role logic in `AuthContext` and dashboard pages as needed.
- **UI:** Customize Tailwind classes and components for your branding.
- **Data Model:** Update Firestore rules and data structure to match your organization.

---

## Deployment

This app can be deployed to any platform supporting Next.js (Vercel, Azure Static Web Apps, etc.).

1. **Build the app:**
   ```bash
   npm run build
   # or
   yarn build
   ```

2. **Deploy using your preferred platform.**

---

## License

MIT

---

## Contact

For support or questions, please contact the project maintainer.
