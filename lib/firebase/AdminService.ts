// lib/firebase/adminService.ts
import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  Timestamp, 
  writeBatch, 
  getFirestore 
} from 'firebase/firestore';
import { initializeApp, getApps } from 'firebase/app';
import { User } from '@/types';

export interface AdminUser extends User {
  zoneName?: string;
  wardName?: string;
  appointedBy?: string;
  appointedAt?: Date;
  lastLogin?: Date;
  status: 'active' | 'inactive' | 'suspended';
}

export interface AdminAppointment {
  id: string;
  appointeeEmail: string;
  appointeeName: string;
  role: 'zonalAdmin' | 'wardAdmin';
  zoneId?: string;
  wardId?: string;
  zoneName?: string;
  wardName?: string;
  appointedBy: string;
  status: 'pending' | 'sent' | 'accepted' | 'expired';
  createdAt: Date;
  expiresAt: Date;
  emailSent: boolean;
  tempPassword?: string;
}

export interface Zone {
  id: string;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Ward {
  id: string;
  name: string;
  zoneId: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Collections
const COLLECTIONS = {
  USERS: 'users',
  ADMIN_APPOINTMENTS: 'adminAppointments',
  ZONES: 'zones',
  WARDS: 'wards',
  AUDIT_LOGS: 'auditLogs'
} as const;

// Utility function to convert Firestore timestamp to Date
const convertTimestamp = (timestamp: any): Date => {
  if (timestamp && timestamp.toDate) {
    return timestamp.toDate();
  }
  if (timestamp instanceof Date) {
    return timestamp;
  }
  return new Date(timestamp);
};

// Initialize Firebase app if not already initialized
const firebaseConfig = {
  // TODO: Fill in your Firebase config here or import from a config file
};
if (!getApps().length) {
  initializeApp(firebaseConfig);
}
const db = getFirestore();

// Get all users (for admin selection)
export const getAllUsers = async (): Promise<User[]> => {
  try {
    const usersQuery = query(collection(db, COLLECTIONS.USERS));
    const snapshot = await getDocs(usersQuery);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as User[];
  } catch (error) {
    console.error('Error fetching users:', error);
    throw new Error('Failed to fetch users');
  }
};

// Admin Management Service
export class AdminService {
  // Get all zones
  static async getZones(): Promise<Zone[]> {
    try {
      const zonesQuery = query(
        collection(db, COLLECTIONS.ZONES),
        orderBy('name', 'asc')
      );
      const snapshot = await getDocs(zonesQuery);
     const zones = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: convertTimestamp(doc.data().createdAt),
        updatedAt: convertTimestamp(doc.data().updatedAt),
      }));
      return zones as Zone[];

    } catch (error) {
      console.error('Error fetching zones:', error);
      throw new Error('Failed to fetch zones');
    }
  }

  // Get all wards
  static async getWards(): Promise<Ward[]> {
    try {
      const wardsQuery = query(
        collection(db, COLLECTIONS.WARDS),
        orderBy('name', 'asc')
      );
      const snapshot = await getDocs(wardsQuery);
      const wards = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: convertTimestamp(doc.data().createdAt),
        updatedAt: convertTimestamp(doc.data().updatedAt),
      }));

      // console.log('Wards snapshot:', wards);

      return wards as Ward[];
    } catch (error) {
      console.error('Error fetching wards:', error);
      throw new Error('Failed to fetch wards');
    }
  }

  // Get wards by zone
  static async getWardsByZone(zoneId: string): Promise<Ward[]> {
    try {
      const wardsQuery = query(
        collection(db, COLLECTIONS.WARDS),
        where('zoneId', '==', zoneId),
        orderBy('name', 'asc')
      );
      const snapshot = await getDocs(wardsQuery);

      const wardsbyZone = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: convertTimestamp(doc.data().createdAt),
        updatedAt: convertTimestamp(doc.data().updatedAt),
      }));

      return wardsbyZone as Ward[];
    } catch (error) {
      console.error('Error fetching wards by zone:', error);
      throw new Error('Failed to fetch wards');
    }
  }

  // Get all admin users
  static async getAdmins(): Promise<AdminUser[]> {
    try {
      const adminsQuery = query(
        collection(db, COLLECTIONS.USERS),
        where('role', 'in', ['zonalAdmin', 'wardAdmin']),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(adminsQuery);
      
      // Get zones and wards data for mapping
      const [zones, wards] = await Promise.all([
        this.getZones(),
        this.getWards()
      ]);

      const zoneMap = new Map(zones.map(z => [z.id, z.name]));
      const wardMap = new Map(wards.map(w => [w.id, w.name]));

      const admins = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          zoneName: data.zoneId ? zoneMap.get(data.zoneId) : undefined,
          wardName: data.wardId ? wardMap.get(data.wardId) : undefined,
          createdAt: convertTimestamp(data.createdAt),
          updatedAt: convertTimestamp(data.updatedAt),
          appointedAt: data.appointedAt ? convertTimestamp(data.appointedAt) : undefined,
          lastLogin: data.lastLogin ? convertTimestamp(data.lastLogin) : undefined,
        };
      }) as AdminUser[];
      console.log('Fetched admins:', admins);
      return admins;


      // return snapshot.docs.map(doc => {
      //   const data = doc.data();
      //   return {
      //     id: doc.id,
      //     ...data,
      //     zoneName: data.zoneId ? zoneMap.get(data.zoneId) : undefined,
      //     wardName: data.wardId ? wardMap.get(data.wardId) : undefined,
      //     createdAt: convertTimestamp(data.createdAt),
      //     updatedAt: convertTimestamp(data.updatedAt),
      //     appointedAt: data.appointedAt ? convertTimestamp(data.appointedAt) : undefined,
      //     lastLogin: data.lastLogin ? convertTimestamp(data.lastLogin) : undefined,
      //   };
      // }) as AdminUser[];
    } catch (error) {
       console.error('Error fetching admins:', error);
      throw new Error('Failed to fetch administrators');
    }
  }

  // Get admin appointments
  static async getAdminAppointments(): Promise<AdminAppointment[]> {
    try {
      const appointmentsQuery = query(
        collection(db, COLLECTIONS.ADMIN_APPOINTMENTS),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(appointmentsQuery);
      
      // Get zones and wards data for mapping
      const [zones, wards] = await Promise.all([
        this.getZones(),
        this.getWards()
      ]);

      const zoneMap = new Map(zones.map(z => [z.id, z.name]));
      const wardMap = new Map(wards.map(w => [w.id, w.name]));

      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          zoneName: data.zoneId ? zoneMap.get(data.zoneId) : undefined,
          wardName: data.wardId ? wardMap.get(data.wardId) : undefined,
          createdAt: convertTimestamp(data.createdAt),
          expiresAt: convertTimestamp(data.expiresAt),
        };
      }) as AdminAppointment[];
    } catch (error) {
      console.error('Error fetching admin appointments:', error);
      throw new Error('Failed to fetch admin appointments');
    }
  }

  // Create admin appointment
  static async createAdminAppointment(
    appointmentData: Omit<AdminAppointment, 'id' | 'createdAt' | 'expiresAt' | 'zoneName' | 'wardName'>
  ): Promise<string> {
    try {
      const batch = writeBatch(db);
      
      // Create appointment document
      const appointmentRef = doc(collection(db, COLLECTIONS.ADMIN_APPOINTMENTS));
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

      const appointment = {
        ...appointmentData,
        createdAt: Timestamp.now(),
        expiresAt: Timestamp.fromDate(expiresAt),
      };

      batch.set(appointmentRef, appointment);

      // Log the action
      const auditLogRef = doc(collection(db, COLLECTIONS.AUDIT_LOGS));
      batch.set(auditLogRef, {
        action: 'admin_appointed',
        performedBy: appointmentData.appointedBy,
        targetEmail: appointmentData.appointeeEmail,
        targetRole: appointmentData.role,
        details: {
          appointeeName: appointmentData.appointeeName,
          zoneId: appointmentData.zoneId,
          wardId: appointmentData.wardId,
        },
        timestamp: Timestamp.now(),
      });

      await batch.commit();
      return appointmentRef.id;
    } catch (error) {
      console.error('Error creating admin appointment:', error);
      throw new Error('Failed to create admin appointment');
    }
  }

  // Appoint existing user as admin
 static async appointExistingUserAsAdmin({
    userId,
    role,
    zoneId,
    wardId,
    appointedBy
  }: {
    userId: string;
    role: 'zonalAdmin' | 'wardAdmin';
    zoneId?: string;
    wardId?: string;
    appointedBy: string;
  }): Promise<void> {
    console.log('[DEBUG] appointExistingUserAsAdmin called with:', {
      userId, role, zoneId, wardId, appointedBy
    });

    try {
      // Fetch current user (the one appointing)
      const actorRef = doc(db, COLLECTIONS.USERS, appointedBy);
      const actorSnap = await getDoc(actorRef);

      if (!actorSnap.exists()) {
        console.error('[ERROR] Appointing user not found in database.');
        throw new Error('Permission denied: Appointing user not found');
      }

      const actorData = actorSnap.data();
      console.log('[DEBUG] Appointing user data:', actorData);

      // Check if target user exists
      const userRef = doc(db, COLLECTIONS.USERS, userId);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        console.error('[ERROR] Target user not found');
        throw new Error('User not found');
      }

      const user = userSnap.data() as User;
      console.log('[DEBUG] Target user data before update:', user);

      // Attempt update
      await updateDoc(userRef, {
        role,
        zoneId: zoneId || null,
        wardId: wardId || null,
        status: 'active',
        appointedBy,
        appointedAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      console.log('[DEBUG] User updated successfully in Firestore');

      // Log the action in audit logs
      await addDoc(collection(db, COLLECTIONS.AUDIT_LOGS), {
        action: 'admin_appointed',
        performedBy: appointedBy,
        targetUserId: userId,
        targetEmail: user.email,
        targetRole: role,
        details: {
          userName: user.name,
          zoneId,
          wardId,
        },
        timestamp: Timestamp.now(),
      });

      console.log('[DEBUG] Audit log written');
    } catch (err) {
      console.error('[ERROR] Failed during appointment:', err);
      throw err;
    }
  }

  // Update appointment status
  static async updateAppointmentStatus(
    appointmentId: string, 
    status: AdminAppointment['status'],
    additionalData?: Partial<AdminAppointment>
  ): Promise<void> {
    try {
      const appointmentRef = doc(db, COLLECTIONS.ADMIN_APPOINTMENTS, appointmentId);
      const updateData: any = {
        status,
        updatedAt: Timestamp.now(),
        ...additionalData,
      };

      await updateDoc(appointmentRef, updateData);
    } catch (error) {
      console.error('Error updating appointment status:', error);
      throw new Error('Failed to update appointment status');
    }
  }

  // Accept admin appointment (convert to actual admin user)
  static async acceptAdminAppointment(
    appointmentId: string,
    userData: {
      uid: string;
      password: string;
    }
  ): Promise<void> {
    try {
      const batch = writeBatch(db);

      // Get appointment details
      const appointmentRef = doc(db, COLLECTIONS.ADMIN_APPOINTMENTS, appointmentId);
      const appointmentSnap = await getDoc(appointmentRef);
      
      if (!appointmentSnap.exists()) {
        throw new Error('Appointment not found');
      }

      const appointment = appointmentSnap.data() as AdminAppointment;

      // Create user document
      const userRef = doc(db, COLLECTIONS.USERS, userData.uid);
      const newUser = {
        name: appointment.appointeeName,
        email: appointment.appointeeEmail,
        role: appointment.role,
        zoneId: appointment.zoneId,
        wardId: appointment.wardId,
        verified: true,
        status: 'active',
        appointedBy: appointment.appointedBy,
        appointedAt: convertTimestamp(appointment.createdAt),
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      batch.set(userRef, newUser);

      // Update appointment status
      batch.update(appointmentRef, {
        status: 'accepted',
        acceptedAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      // Log the action
      const auditLogRef = doc(collection(db, COLLECTIONS.AUDIT_LOGS));
      batch.set(auditLogRef, {
        action: 'admin_appointment_accepted',
        performedBy: userData.uid,
        appointmentId: appointmentId,
        details: {
          role: appointment.role,
          zoneId: appointment.zoneId,
          wardId: appointment.wardId,
        },
        timestamp: Timestamp.now(),
      });

      await batch.commit();
    } catch (error) {
      console.error('Error accepting admin appointment:', error);
      throw new Error('Failed to accept admin appointment');
    }
  }

  // Update admin user
  static async updateAdmin(
    adminId: string,
    updateData: Partial<AdminUser>
  ): Promise<void> {
    try {
      const adminRef = doc(db, COLLECTIONS.USERS, adminId);
      const updatedData = {
        ...updateData,
        updatedAt: Timestamp.now(),
      };
      // Remove undefined values
      Object.keys(updatedData).forEach(key => {
        if ((updatedData as any)[key] === undefined) {
          delete (updatedData as any)[key];
        }
      });
      await updateDoc(adminRef, updatedData);
      // Log the action
      await addDoc(collection(db, COLLECTIONS.AUDIT_LOGS), {
        action: 'admin_updated',
        performedBy: (updateData as any).updatedBy || 'system',
        targetUserId: adminId,
        details: updateData,
        timestamp: Timestamp.now(),
      });
    } catch (error) {
      console.error('Error updating admin:', error);
      throw new Error('Failed to update administrator');
    }
  }

  // Suspend admin
  static async suspendAdmin(adminId: string, suspendedBy: string): Promise<void> {
    try {
      await this.updateAdmin(adminId, {
        status: 'suspended',
        // removed suspendedAt, suspendedBy, updatedBy (not in AdminUser interface)
      });
    } catch (error) {
      console.error('Error suspending admin:', error);
      throw new Error('Failed to suspend administrator');
    }
  }

  // Activate admin
  static async activateAdmin(adminId: string, activatedBy: string): Promise<void> {
    try {
      await this.updateAdmin(adminId, {
        status: 'active',
        // removed activatedAt, suspendedAt, suspendedBy, updatedBy (not in AdminUser interface)
      });
    } catch (error) {
      console.error('Error activating admin:', error);
      throw new Error('Failed to activate administrator');
    }
  }

  // Revoke admin role (delete admin user)
  static async revokeAdmin(adminId: string, revokedBy: string): Promise<void> {
    try {
      const batch = writeBatch(db);

      // Get admin details for logging
      const adminRef = doc(db, COLLECTIONS.USERS, adminId);
      const adminSnap = await getDoc(adminRef);
      
      if (!adminSnap.exists()) {
        throw new Error('Administrator not found');
      }

      const adminData = adminSnap.data();

      // Delete admin user
      batch.delete(adminRef);

      // Log the action
      const auditLogRef = doc(collection(db, COLLECTIONS.AUDIT_LOGS));
      batch.set(auditLogRef, {
        action: 'admin_revoked',
        performedBy: revokedBy,
        targetUserId: adminId,
        details: {
          adminName: adminData.name,
          adminEmail: adminData.email,
          role: adminData.role,
          zoneId: adminData.zoneId,
          wardId: adminData.wardId,
        },
        timestamp: Timestamp.now(),
      });

      await batch.commit();
    } catch (error) {
      console.error('Error revoking admin:', error);
      throw new Error('Failed to revoke administrator');
    }
  }

  // Delete admin appointment
  static async deleteAppointment(appointmentId: string, deletedBy: string): Promise<void> {
    try {
      const batch = writeBatch(db);

      // Get appointment details for logging
      const appointmentRef = doc(db, COLLECTIONS.ADMIN_APPOINTMENTS, appointmentId);
      const appointmentSnap = await getDoc(appointmentRef);
      
      if (!appointmentSnap.exists()) {
        throw new Error('Appointment not found');
      }

      const appointmentData = appointmentSnap.data();

      // Delete appointment
      batch.delete(appointmentRef);

      // Log the action
      const auditLogRef = doc(collection(db, COLLECTIONS.AUDIT_LOGS));
      batch.set(auditLogRef, {
        action: 'admin_appointment_cancelled',
        performedBy: deletedBy,
        appointmentId: appointmentId,
        details: {
          appointeeName: appointmentData.appointeeName,
          appointeeEmail: appointmentData.appointeeEmail,
          role: appointmentData.role,
        },
        timestamp: Timestamp.now(),
      });

      await batch.commit();
    } catch (error) {
      console.error('Error deleting appointment:', error);
      throw new Error('Failed to delete appointment');
    }
  }

  // Get admin statistics
  static async getAdminStats(): Promise<{
    totalAdmins: number;
    zonalAdmins: number;
    wardAdmins: number;
    activeAdmins: number;
    inactiveAdmins: number;
    suspendedAdmins: number;
    pendingAppointments: number;
  }> {
    try {
      const [admins, appointments] = await Promise.all([
        this.getAdmins(),
        this.getAdminAppointments()
      ]);

      return {
        totalAdmins: admins.length,
        zonalAdmins: admins.filter(a => a.role === 'zonalAdmin').length,
        wardAdmins: admins.filter(a => a.role === 'wardAdmin').length,
        activeAdmins: admins.filter(a => a.status === 'active').length,
        inactiveAdmins: admins.filter(a => a.status === 'inactive').length,
        suspendedAdmins: admins.filter(a => a.status === 'suspended').length,
        pendingAppointments: appointments.filter(a => ['pending', 'sent'].includes(a.status)).length,
      };
    } catch (error) {
      console.error('Error getting admin stats:', error);
      throw new Error('Failed to get admin statistics');
    }
  }

  // Generate temporary password
  static generateTempPassword(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }

  // Send appointment email (placeholder - implement with your email service)
  static async sendAppointmentEmail(appointment: AdminAppointment): Promise<boolean> {
    try {
      // TODO: Implement email sending logic using Firebase Functions or external service
      // For now, just simulate email sending
      console.log('Sending appointment email to:', appointment.appointeeEmail);
      
      // You would integrate with services like:
      // - Firebase Functions with SendGrid/Mailgun
      // - AWS SES
      // - Other email services
      
      return true;
    } catch (error) {
      console.error('Error sending appointment email:', error);
      return false;
    }
  }
}