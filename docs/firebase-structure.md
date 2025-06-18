# Firebase Firestore Structure

## Collections Overview

### Users Collection `/users/{userId}`
```typescript
{
  id: string,                    // Firebase UID
  email: string,                 // User email
  name: string,                  // Full name
  role: 'superAdmin' | 'zonalAdmin' | 'wardAdmin' | 'member',
  zoneId?: string,              // Reference to zone (for admins and members)
  wardId?: string,              // Reference to ward (for ward admins and members)
  verified: boolean,            // Verification status
  createdAt: Timestamp,
  updatedAt: Timestamp,
  phone?: string,               // Phone number
  address?: string,             // Physical address
  idNumber?: string,            // Government ID number
  appointedBy?: string,         // User ID of who appointed this admin
  appointedAt?: Timestamp       // When admin role was assigned
}
```

### Zones Collection `/zones/{zoneId}`
```typescript
{
  id: string,                   // Auto-generated zone ID
  name: string,                 // Zone name
  description?: string,         // Zone description
  adminId?: string,             // User ID of zonal admin
  createdAt: Timestamp,
  updatedAt: Timestamp,
  createdBy: string,           // User ID who created the zone
  memberCount: number,         // Cached count of members in this zone
  wardCount: number            // Cached count of wards in this zone
}
```

### Wards Collection `/wards/{wardId}`
```typescript
{
  id: string,                   // Auto-generated ward ID
  name: string,                 // Ward name
  zoneId: string,              // Reference to parent zone
  adminId?: string,            // User ID of ward admin
  description?: string,         // Ward description
  createdAt: Timestamp,
  updatedAt: Timestamp,
  createdBy: string,           // User ID who created the ward
  memberCount: number          // Cached count of members in this ward
}
```

### Pending Users Collection `/pendingUsers/{requestId}`
```typescript
{
  id: string,                   // Auto-generated request ID
  userData: {                   // Complete user data for registration
    name: string,
    email: string,
    phone: string,
    address: string,
    idNumber: string,
    role: 'member'              // Always member for public registrations
  },
  status: 'pending' | 'approved' | 'rejected',
  assignedTo?: string,          // Admin responsible for approval
  zoneId: string,              // Target zone for membership
  wardId: string,              // Target ward for membership
  createdAt: Timestamp,
  updatedAt: Timestamp,
  reviewedAt?: Timestamp,      // When the request was reviewed
  reviewedBy?: string,         // Admin who reviewed the request
  rejectionReason?: string,    // Reason for rejection
  comments?: string            // Additional comments from reviewer
}
```

### Admin Appointments Collection `/adminAppointments/{appointmentId}`
```typescript
{
  id: string,                   // Auto-generated appointment ID
  appointeeEmail: string,       // Email of person being appointed
  appointeeData: {             // Data for new admin account
    name: string,
    email: string,
    role: 'zonalAdmin' | 'wardAdmin',
    zoneId?: string,           // For zonal admins
    wardId?: string            // For ward admins
  },
  appointedBy: string,         // User ID of appointing admin
  status: 'pending' | 'sent' | 'accepted' | 'expired',
  createdAt: Timestamp,
  expiresAt: Timestamp,        // Appointment link expiration
  tempPassword: string,        // Temporary password (hashed)
  emailSent: boolean,          // Whether notification email was sent
  acceptedAt?: Timestamp       // When appointment was accepted
}
```

## Security Rules

### Super Admin Rules
- Full read/write access to all collections
- Can create/modify zones and wards
- Can appoint zonal and ward admins
- Can view all user data and statistics

### Zonal Admin Rules
- Read/write access to users in their zone only
- Read/write access to wards in their zone
- Can appoint ward admins for wards in their zone
- Cannot modify zones or other zones' data

### Ward Admin Rules
- Read/write access to users in their ward only
- Read access to their ward data
- Can approve pending users for their ward
- Can bulk upload users to their ward

### Member Rules
- Read/write access to their own user document only
- Read access to public zone/ward information

## Example Security Rules
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users collection
    match /users/{userId} {
      // Users can read/write their own data
      allow read, write: if request.auth != null && request.auth.uid == userId;
      
      // Super admin can access all users
      allow read, write: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'superAdmin';
      
      // Zonal admin can access users in their zone
      allow read, write: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'zonalAdmin' &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.zoneId == resource.data.zoneId;
      
      // Ward admin can access users in their ward
      allow read, write: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'wardAdmin' &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.wardId == resource.data.wardId;
    }
    
    // Zones collection
    match /zones/{zoneId} {
      // Super admin has full access
      allow read, write: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'superAdmin';
      
      // Zonal admin can read their zone
      allow read: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.zoneId == zoneId;
    }
    
    // Wards collection  
    match /wards/{wardId} {
      // Super admin has full access
      allow read, write: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'superAdmin';
      
      // Zonal admin can access wards in their zone
      allow read, write: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'zonalAdmin' &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.zoneId == resource.data.zoneId;
      
      // Ward admin can read their ward
      allow read: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.wardId == wardId;
    }
    
    // Pending users collection
    match /pendingUsers/{requestId} {
      // Public can create (register)
      allow create: if request.auth == null;
      
      // Admins can read/write based on zone/ward
      allow read, write: if request.auth != null && 
        (get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'superAdmin' ||
         (get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'zonalAdmin' &&
          get(/databases/$(database)/documents/users/$(request.auth.uid)).data.zoneId == resource.data.zoneId) ||
         (get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'wardAdmin' &&
          get(/databases/$(database)/documents/users/$(request.auth.uid)).data.wardId == resource.data.wardId));
    }
  }
}
```

## Cloud Functions

### Email Notification Function
```typescript
// functions/src/sendAdminInvite.ts
exports.sendAdminInvite = functions.https.onCall(async (data, context) => {
  // Verify caller is authorized
  // Generate temporary password
  // Send email with login credentials
  // Create admin appointment record
});
```

### User Statistics Function
```typescript
// functions/src/updateUserStats.ts
exports.updateUserStats = functions.firestore
  .document('users/{userId}')
  .onWrite(async (change, context) => {
    // Update zone and ward member counts
    // Update verification statistics
  });
```