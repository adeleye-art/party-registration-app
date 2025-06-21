export interface User {
  id: string;
  email: string;
  name: string;
  role: 'superAdmin' | 'zonalAdmin' | 'wardAdmin' | 'member';
  zoneId?: string;
  wardId?: string;
  verified: boolean;
  createdAt: Date;
  updatedAt: Date;
  phone?: string;
  address?: string;
  idNumber?: string;
  idType?: string;
  occupation?: string;
  qualification?: string;
  dob?: string;
  profilePicture?: string;
  localGovt?: string;

}

export interface Zone {
  id: string;
  name: string;
  wardId?: string;
  description?: string;
  adminId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Ward {
  id: string;
  name: string;
  localGovt: string;
  adminId?: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface localGovt {
  id: string;
  name: string;
 
}

export interface PendingUser {
  id: string;
  userData: Omit<User, 'id' | 'verified' | 'createdAt' | 'updatedAt'>;
  status: 'pending' | 'approved' | 'rejected';
  verified?: boolean;
  assignedTo?: string;
  zoneId: string;
  wardId: string;
  createdAt: Date;
  updatedAt: Date;
  rejectionReason?: string;
}

export interface DashboardStats {
  totalUsers: number;
  verifiedUsers: number;
  pendingUsers: number;
  totalZones: number;
  totalWards: number;
  zonalStats?: {
    [zoneId: string]: {
      totalUsers: number;
      verifiedUsers: number;
      pendingUsers: number;
      totalWards: number;
    };
  };
  wardStats?: {
    [wardId: string]: {
      totalUsers: number;
      verifiedUsers: number;
      pendingUsers: number;
    };
  };
}