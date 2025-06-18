'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  Shield, 
  Plus, 
  Edit, 
  Trash2, 
  Users, 
  MapPin, 
  Building2,
  Mail,
  Phone,
  Calendar,
  Crown,
  UserCheck,
  UserX,
  MoreHorizontal,
  AlertTriangle,
  Search,
  Filter,
  Eye,
  Send,
  Key,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw
} from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc, 
  addDoc, 
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Alert,
  AlertDescription,
} from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';

interface AdminUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: 'superAdmin' | 'zonalAdmin' | 'wardAdmin';
  zoneId?: string;
  wardId?: string;
  zoneName?: string;
  wardName?: string;
  verified: boolean;
  appointedBy?: string;
  appointedAt?: Date;
  lastLogin?: Date;
  status: 'active' | 'inactive' | 'suspended';
  createdAt: Date;
  updatedAt: Date;
}

interface AdminAppointment {
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

interface Zone {
  id: string;
  name: string;
  description?: string;
  createdAt: Timestamp;
}

interface Ward {
  id: string;
  name: string;
  zoneId: string;
  description?: string;
  createdAt: Timestamp;
}

interface RegularUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  verified: boolean;
  zoneId?: string;
  wardId?: string;
  createdAt: Timestamp;
}

export default function AdminManagementPage() {
  const { user } = useAuth();
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [appointments, setAppointments] = useState<AdminAppointment[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);
  const [regularUsers, setRegularUsers] = useState<RegularUser[]>([]);
  const [filteredAdmins, setFilteredAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedZone, setSelectedZone] = useState<string>('all');
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  
  // Dialog states
  const [isAppointDialogOpen, setIsAppointDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState<AdminUser | null>(null);
  const [appointmentData, setAppointmentData] = useState({
    userId: '',
    role: '' as 'zonalAdmin' | 'wardAdmin' | '',
    zoneId: '',
    wardId: '',
  });
  const [editData, setEditData] = useState({
    name: '',
    email: '',
    phone: '',
    zoneId: '',
    wardId: '',
  });
  const [submitting, setSubmitting] = useState(false);

  // Role-based permissions
  const isSuperAdmin = user?.role === 'superAdmin';
  const isZonalAdmin = user?.role === 'zonalAdmin';
  const isWardAdmin = user?.role === 'wardAdmin';
  const canManageAllAdmins = isSuperAdmin;
  const canManageZonalAdmins = isSuperAdmin;
  const canManageWardAdmins = isSuperAdmin || isZonalAdmin;

  // Get accessible zones based on user role
  const getAccessibleZones = useCallback(() => {
    if (isSuperAdmin) {
      return zones; // Super admin can see all zones
    }
    if (isZonalAdmin && user?.zoneId) {
      return zones.filter(zone => zone.id === user.zoneId); // Zonal admin can only see their zone
    }
    if (isWardAdmin && user?.wardId) {
      const userWard = wards.find(w => w.id === user.wardId);
      return zones.filter(zone => zone.id === userWard?.zoneId); // Ward admin can see their zone
    }
    return [];
  }, [zones, wards, isSuperAdmin, isZonalAdmin, isWardAdmin, user]);

  // Get accessible wards based on user role
  const getAccessibleWards = useCallback(() => {
    if (isSuperAdmin) {
      return wards; // Super admin can see all wards
    }
    if (isZonalAdmin && user?.zoneId) {
      return wards.filter(ward => ward.zoneId === user.zoneId); // Zonal admin can see wards in their zone
    }
    if (isWardAdmin && user?.wardId) {
      return wards.filter(ward => ward.id === user.wardId); // Ward admin can only see their ward
    }
    return [];
  }, [wards, isSuperAdmin, isZonalAdmin, isWardAdmin, user]);

  // Check if user can perform action on target admin
  const canPerformAction = useCallback((targetAdmin: AdminUser, action: string) => {
    if (!user) return false;

    // Super admin can do everything except manage other super admins
    if (isSuperAdmin) {
      if (targetAdmin.role === 'superAdmin' && targetAdmin.id !== user.id) {
        return false; // Super admins cannot manage other super admins
      }
      return true;
    }

    // Users cannot manage themselves for certain actions
    if (targetAdmin.id === user.id && ['suspend', 'revoke'].includes(action)) {
      return false;
    }

    // Zonal admin can manage ward admins in their zone
    if (isZonalAdmin) {
      const canManageUser = targetAdmin.zoneId === user.zoneId;
      const canManageRole = targetAdmin.role === 'wardAdmin';
      return canManageUser && canManageRole;
    }

    // Ward admin cannot manage other admins
    if (isWardAdmin) {
      return false;
    }

    return false;
  }, [user, isSuperAdmin, isZonalAdmin, isWardAdmin]);

  // Load all data
  const loadAdminData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      console.log(`Loading admin data for ${user.role}...`);
      setLoading(true);

      // Load zones
      const zonesRef = collection(db, 'zones');
      let zonesQuery = query(zonesRef, orderBy('createdAt', 'desc'));

      if (isZonalAdmin && user?.zoneId) {
        zonesQuery = query(zonesRef, where('__name__', '==', user.zoneId));
      } else if (isWardAdmin && user?.wardId) {
        // For ward admin, get their ward's zone
        const wardRef = collection(db, 'wards');
        const wardQuery = query(wardRef, where('__name__', '==', user.wardId));
        const wardSnapshot = await getDocs(wardQuery);
        
        if (!wardSnapshot.empty) {
          const wardData = wardSnapshot.docs[0].data();
          zonesQuery = query(zonesRef, where('__name__', '==', wardData.zoneId));
        }
      }

      const zonesSnapshot = await getDocs(zonesQuery);
      const zonesData: Zone[] = zonesSnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name,
        description: doc.data().description,
        createdAt: doc.data().createdAt || Timestamp.now(),
      }));

      console.log(`Zones loaded: ${zonesData.length}`);
      setZones(zonesData);

      // Load wards
      const wardsRef = collection(db, 'wards');
      let wardsQuery = query(wardsRef, orderBy('createdAt', 'desc'));

      if (isZonalAdmin && user?.zoneId) {
        wardsQuery = query(wardsRef, where('zoneId', '==', user.zoneId), orderBy('createdAt', 'desc'));
      } else if (isWardAdmin && user?.wardId) {
        wardsQuery = query(wardsRef, where('__name__', '==', user.wardId));
      }

      const wardsSnapshot = await getDocs(wardsQuery);
      const wardsData: Ward[] = wardsSnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name,
        zoneId: doc.data().zoneId,
        description: doc.data().description,
        createdAt: doc.data().createdAt || Timestamp.now(),
      }));

      console.log(`Wards loaded: ${wardsData.length}`);
      setWards(wardsData);

      // Load admin users
      const usersRef = collection(db, 'users');
      let adminQuery = query(
        usersRef, 
        where('role', 'in', ['superAdmin', 'zonalAdmin', 'wardAdmin']),
        orderBy('createdAt', 'desc')
      );

      // Apply role-based filtering for admins
      if (isZonalAdmin && user?.zoneId) {
        adminQuery = query(
          usersRef,
          where('role', 'in', ['zonalAdmin', 'wardAdmin']),
          where('zoneId', '==', user.zoneId),
          orderBy('createdAt', 'desc')
        );
      } else if (isWardAdmin && user?.wardId) {
        adminQuery = query(
          usersRef,
          where('role', '==', 'wardAdmin'),
          where('wardId', '==', user.wardId),
          orderBy('createdAt', 'desc')
        );
      }

      const adminSnapshot = await getDocs(adminQuery);
      const adminData: AdminUser[] = adminSnapshot.docs.map(doc => {
        const data = doc.data();
        const zone = zonesData.find(z => z.id === data.zoneId);
        const ward = wardsData.find(w => w.id === data.wardId);
        
        return {
          id: doc.id,
          name: data.name || data.displayName || '',
          email: data.email || '',
          phone: data.phone,
          role: data.role,
          zoneId: data.zoneId,
          wardId: data.wardId,
          zoneName: zone?.name,
          wardName: ward?.name,
          verified: data.verified || false,
          appointedBy: data.appointedBy,
          appointedAt: data.appointedAt?.toDate(),
          lastLogin: data.lastLogin?.toDate(),
          status: data.status || 'active',
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        };
      });

      console.log(`Admins loaded: ${adminData.length}`);
      setAdmins(adminData);
      setFilteredAdmins(adminData);

      // Load regular users for appointment (only for super admin and zonal admin)
      if (isSuperAdmin || isZonalAdmin) {
        let regularUsersQuery = query(
          usersRef,
          where('role', '==', 'member'),
          where('verified', '==', true),
          orderBy('createdAt', 'desc')
        );

        if (isZonalAdmin && user?.zoneId) {
          regularUsersQuery = query(
            usersRef,
            where('role', '==', 'member'),
            where('verified', '==', true),
            where('zoneId', '==', user.zoneId),
            orderBy('createdAt', 'desc')
          );
        }

        const regularUsersSnapshot = await getDocs(regularUsersQuery);
        const regularUsersData: RegularUser[] = regularUsersSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.name || data.displayName || '',
            email: data.email || '',
            phone: data.phone,
            role: data.role,
            verified: data.verified || false,
            zoneId: data.zoneId,
            wardId: data.wardId,
            createdAt: data.createdAt || Timestamp.now(),
          };
        });

        console.log(`Regular users loaded: ${regularUsersData.length}`);
        setRegularUsers(regularUsersData);
      }

      // Load appointments (placeholder for now)
      setAppointments([]);

    } catch (error) {
      console.error('Error loading admin data:', error);
      toast({
        title: "Error",
        description: "Failed to load admin data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [user, isZonalAdmin, isWardAdmin, isSuperAdmin]);

  // Initial data load
  useEffect(() => {
    if (user) {
      loadAdminData();
    }
  }, [user, loadAdminData]);

  // Filter admins based on search and filters
  useEffect(() => {
    let filtered = admins;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(admin =>
        admin.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        admin.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Zone filter
    if (selectedZone !== 'all') {
      filtered = filtered.filter(admin => admin.zoneId === selectedZone);
    }

    // Role filter
    if (selectedRole !== 'all') {
      filtered = filtered.filter(admin => admin.role === selectedRole);
    }

    // Status filter
    if (selectedStatus !== 'all') {
      filtered = filtered.filter(admin => admin.status === selectedStatus);
    }

    setFilteredAdmins(filtered);
  }, [admins, searchTerm, selectedZone, selectedRole, selectedStatus]);

  // Appoint admin
  const handleAppointAdmin = async () => {
    if (
      !appointmentData.userId ||
      !appointmentData.role ||
      !appointmentData.zoneId ||
      (appointmentData.role === 'wardAdmin' && !appointmentData.wardId)
    ) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    // Check permissions
    if (!canManageZonalAdmins && appointmentData.role === 'zonalAdmin') {
      toast({
        title: "Error",
        description: "You don't have permission to appoint zonal admins.",
        variant: "destructive",
      });
      return;
    }

    if (!canManageWardAdmins && appointmentData.role === 'wardAdmin') {
      toast({
        title: "Error",
        description: "You don't have permission to appoint ward admins.",
        variant: "destructive",
      });
      return;
    }

    // Validate zone access for zonal admin
    if (isZonalAdmin && appointmentData.zoneId !== user?.zoneId) {
      toast({
        title: "Error",
        description: "You can only appoint admins in your assigned zone.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const userRef = doc(db, 'users', appointmentData.userId);
      const updateData = {
        role: appointmentData.role,
        zoneId: appointmentData.zoneId,
        wardId: appointmentData.wardId || null,
        appointedBy: user?.id,
        appointedAt: serverTimestamp(),
        status: 'active',
        updatedAt: serverTimestamp(),
      };

      await updateDoc(userRef, updateData);

      // Log appointment activity
      await addDoc(collection(db, 'activities'), {
        type: 'admin_appointed',
        description: `Appointed ${appointmentData.role} for ${zones.find(z => z.id === appointmentData.zoneId)?.name}${appointmentData.wardId ? ` - ${wards.find(w => w.id === appointmentData.wardId)?.name}` : ''}`,
        userId: user?.id,
        targetUserId: appointmentData.userId,
        metadata: {
          role: appointmentData.role,
          zoneId: appointmentData.zoneId,
          wardId: appointmentData.wardId,
        },
        createdAt: serverTimestamp(),
      });

      toast({
        title: "Success",
        description: "Admin appointed successfully.",
      });

      setAppointmentData({ userId: '', role: '', zoneId: '', wardId: '' });
      setIsAppointDialogOpen(false);
      loadAdminData();
    } catch (error) {
      console.error('Error appointing admin:', error);
      toast({
        title: "Error",
        description: "Failed to appoint admin. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Edit admin
  const handleEditAdmin = async () => {
    if (!selectedAdmin || !editData.name || !editData.email) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    if (!canPerformAction(selectedAdmin, 'edit')) {
      toast({
        title: "Error",
        description: "You don't have permission to edit this admin.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const adminRef = doc(db, 'users', selectedAdmin.id);
      const updateData = {
        name: editData.name,
        email: editData.email,
        phone: editData.phone || null,
        zoneId: editData.zoneId,
        wardId: editData.wardId || null,
        updatedAt: serverTimestamp(),
      };

      await updateDoc(adminRef, updateData);

      toast({
        title: "Success",
        description: "Admin updated successfully.",
      });

      setEditData({ name: '', email: '', phone: '', zoneId: '', wardId: '' });
      setSelectedAdmin(null);
      setIsEditDialogOpen(false);
      loadAdminData();
    } catch (error) {
      console.error('Error updating admin:', error);
      toast({
        title: "Error",
        description: "Failed to update admin. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Revoke admin
  const handleRevokeAdmin = async (adminId: string) => {
    const admin = admins.find(a => a.id === adminId);
    if (!admin || !canPerformAction(admin, 'revoke')) {
      toast({
        title: "Error",
        description: "You don't have permission to revoke this admin.",
        variant: "destructive",
      });
      return;
    }

    try {
      const adminRef = doc(db, 'users', adminId);
      await updateDoc(adminRef, {
        role: 'member',
        zoneId: null,
        wardId: null,
        appointedBy: null,
        appointedAt: null,
        status: 'active',
        updatedAt: serverTimestamp(),
      });

      toast({
        title: "Success",
        description: "Admin role revoked successfully.",
      });

      loadAdminData();
    } catch (error) {
      console.error('Error revoking admin:', error);
      toast({
        title: "Error",
        description: "Failed to revoke admin role. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Suspend admin
  const handleSuspendAdmin = async (adminId: string) => {
    const admin = admins.find(a => a.id === adminId);
    if (!admin || !canPerformAction(admin, 'suspend')) {
      toast({
        title: "Error",
        description: "You don't have permission to suspend this admin.",
        variant: "destructive",
      });
      return;
    }

    try {
      const adminRef = doc(db, 'users', adminId);
      await updateDoc(adminRef, {
        status: 'suspended',
        updatedAt: serverTimestamp(),
      });

      toast({
        title: "Success",
        description: "Admin suspended successfully.",
      });

      loadAdminData();
    } catch (error) {
      console.error('Error suspending admin:', error);
      toast({
        title: "Error",
        description: "Failed to suspend admin. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Activate admin
  const handleActivateAdmin = async (adminId: string) => {
    const admin = admins.find(a => a.id === adminId);
    if (!admin || !canPerformAction(admin, 'activate')) {
      toast({
        title: "Error",
        description: "You don't have permission to activate this admin.",
        variant: "destructive",
      });
      return;
    }

    try {
      const adminRef = doc(db, 'users', adminId);
      await updateDoc(adminRef, {
        status: 'active',
        updatedAt: serverTimestamp(),
      });

      toast({
        title: "Success",
        description: "Admin activated successfully.",
      });

      loadAdminData();
    } catch (error) {
      console.error('Error activating admin:', error);
      toast({
        title: "Error",
        description: "Failed to activate admin. Please try again.",
        variant: "destructive",
      });
    }
  };

  const openEditDialog = (admin: AdminUser) => {
    if (!canPerformAction(admin, 'edit')) {
      toast({
        title: "Error",
        description: "You don't have permission to edit this admin.",
        variant: "destructive",
      });
      return;
    }

    setSelectedAdmin(admin);
    setEditData({
      name: admin.name,
      email: admin.email,
      phone: admin.phone || '',
      zoneId: admin.zoneId || '',
      wardId: admin.wardId || '',
    });
    setIsEditDialogOpen(true);
  };

  const openAppointDialog = () => {
    if (!canManageWardAdmins && !canManageZonalAdmins) {
      toast({
        title: "Error",
        description: "You don't have permission to appoint admins.",
        variant: "destructive",
      });
      return;
    }

    // Pre-select zone for zonal admin
    const initialZoneId = isZonalAdmin ? user?.zoneId || '' : '';
    setAppointmentData({ userId: '', role: '', zoneId: initialZoneId, wardId: '' });
    setIsAppointDialogOpen(true);
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'superAdmin':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'zonalAdmin':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'wardAdmin':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <Badge className="bg-green-100 text-green-800 border-green-200">
            <CheckCircle className="w-3 h-3 mr-1" />
            Active
          </Badge>
        );
      case 'inactive':
        return (
          <Badge className="bg-gray-100 text-gray-800 border-gray-200">
            <Clock className="w-3 h-3 mr-1" />
            Inactive
          </Badge>
        );
      case 'suspended':
        return (
          <Badge className="bg-red-100 text-red-800 border-red-200">
            <XCircle className="w-3 h-3 mr-1" />
            Suspended
          </Badge>
        );
      default:
        return null;
    }
  };

  const accessibleZones = getAccessibleZones();
  const accessibleWards = getAccessibleWards();
  const availableWards = appointmentData.zoneId
    ? wards.filter(ward => ward.zoneId === appointmentData.zoneId)
    : [];
  const editAvailableWards = editData.zoneId
    ? wards.filter(ward => ward.zoneId === editData.zoneId)
    : [];

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/4 animate-pulse"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                  <div className="h-8 bg-gray-200 rounded w-1/3"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const stats = {
    totalAdmins: admins.length,
    zonalAdmins: admins.filter(a => a.role === 'zonalAdmin').length,
    wardAdmins: admins.filter(a => a.role === 'wardAdmin').length,
    pendingAppointments: appointments.filter(a => a.status === 'pending' || a.status === 'sent').length,
  };

  // Role-based title and description
  const getRoleBasedTitle = () => {
    if (isSuperAdmin) {
      return 'Admin Management - System Wide';
    }
    if (isZonalAdmin) {
      const zoneName = zones.find(z => z.id === user?.zoneId)?.name || 'Zone';
      return `Admin Management - ${zoneName}`;
    }
    if (isWardAdmin) {
      const wardName = wards.find(w => w.id === user?.wardId)?.name || 'Ward';
      return `Admin Management - ${wardName}`;
    }
    return 'Admin Management';
  };

  const getRoleBasedDescription = () => {
    if (isSuperAdmin) {
      return 'Appoint and manage zonal and ward administrators across the entire system';
    }
    if (isZonalAdmin) {
      return 'Appoint and manage ward administrators within your zone';
    }
    if (isWardAdmin) {
      return 'View administrators in your ward';
    }
    return 'Manage administrators';
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Role-based access notification */}
        {!isSuperAdmin && (
          <Alert className="border-blue-200 bg-blue-50">
            <Shield className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800">
              You have {isZonalAdmin ? 'zonal' : 'ward'} admin access. 
              {isZonalAdmin 
                ? ' You can appoint and manage ward administrators within your zone.'
                : ' You can view administrators in your ward but cannot make changes.'}
            </AlertDescription>
          </Alert>
        )}

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{getRoleBasedTitle()}</h1>
            <p className="text-gray-600 mt-1">
              {getRoleBasedDescription()}
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <Button
              variant="outline"
              onClick={loadAdminData}
              disabled={loading}
              className="border-gray-200 hover:bg-gray-50"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            {(canManageZonalAdmins || canManageWardAdmins) && (
              <Button onClick={openAppointDialog} className="bg-blue-600 hover:bg-blue-700">
                <Plus className="w-4 h-4 mr-2" />
                Appoint Admin
              </Button>
            )}
          </div>
        </motion.div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[
            {
              title: 'Total Admins',
              value: stats.totalAdmins,
              icon: Shield,
              color: 'blue',
              description: 'Active administrators',
            },
            {
              title: 'Zonal Admins',
              value: stats.zonalAdmins,
              icon: MapPin,
              color: 'purple',
              description: 'Zone administrators',
            },
            {
              title: 'Ward Admins',
              value: stats.wardAdmins,
              icon: Building2,
              color: 'green',
              description: 'Ward administrators',
            },
            {
              title: 'Pending Appointments',
              value: stats.pendingAppointments,
              icon: Clock,
              color: 'yellow',
              description: 'Awaiting acceptance',
            },
          ].map((stat, index) => (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                      <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
                      <p className="text-xs text-gray-500 mt-1">{stat.description}</p>
                    </div>
                    <div className={`p-3 bg-${stat.color}-50 rounded-full`}>
                      <stat.icon className={`h-6 w-6 text-${stat.color}-600`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Main Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          {/* Filters */}
          <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5 text-blue-600" />
                Filters & Search
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search admins..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                
                {/* Zone filter - only show if user has access to multiple zones */}
                {accessibleZones.length > 1 && (
                  <Select value={selectedZone} onValueChange={setSelectedZone}>
                    <SelectTrigger className="border-gray-200 focus:border-blue-500 focus:ring-blue-500">
                      <SelectValue placeholder="All Zones" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Zones</SelectItem>
                      {accessibleZones.map((zone) => (
                        <SelectItem key={zone.id} value={zone.id}>
                          {zone.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger className="border-gray-200 focus:border-blue-500 focus:ring-blue-500">
                    <SelectValue placeholder="All Roles" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    {isSuperAdmin && <SelectItem value="superAdmin">Super Admins</SelectItem>}
                    {(isSuperAdmin || isZonalAdmin) && <SelectItem value="zonalAdmin">Zonal Admins</SelectItem>}
                    <SelectItem value="wardAdmin">Ward Admins</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger className="border-gray-200 focus:border-blue-500 focus:ring-blue-500">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Admins Table */}
          <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-blue-600" />
                Administrators ({filteredAdmins.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredAdmins.length === 0 ? (
                <div className="text-center py-12">
                  <Shield className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No administrators found</h3>
                  <p className="text-gray-500 mb-4">
                    {searchTerm || selectedZone !== 'all' || selectedRole !== 'all' || selectedStatus !== 'all'
                      ? 'Try adjusting your search filters.'
                      : 'No administrators have been appointed yet.'}
                  </p>
                  {(canManageZonalAdmins || canManageWardAdmins) && !searchTerm && selectedZone === 'all' && selectedRole === 'all' && selectedStatus === 'all' && (
                    <Button onClick={openAppointDialog} className="bg-blue-600 hover:bg-blue-700">
                      <Plus className="w-4 h-4 mr-2" />
                      Appoint Admin
                    </Button>
                  )}
                </div>
              ) : (
                <div className="rounded-md border border-gray-200">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="font-semibold">Administrator</TableHead>
                        <TableHead className="font-semibold">Role</TableHead>
                        <TableHead className="font-semibold">Assignment</TableHead>
                        <TableHead className="font-semibold">Status</TableHead>
                        <TableHead className="font-semibold">Last Login</TableHead>
                        <TableHead className="font-semibold">Appointed</TableHead>
                        <TableHead className="text-right font-semibold">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAdmins.map((admin) => (
                        <TableRow key={admin.id} className="hover:bg-gray-50 transition-colors">
                          <TableCell>
                            <div className="flex items-center space-x-3">
                              <Avatar className="h-10 w-10 border-2 border-gray-200">
                                <AvatarFallback className="bg-blue-100 text-blue-700 font-semibold">
                                  {admin.name.charAt(0).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="font-medium text-gray-900">{admin.name}</div>
                                <div className="text-sm text-gray-500 flex items-center gap-1">
                                  <Mail className="w-3 h-3" />
                                  {admin.email}
                                </div>
                                {admin.phone && (
                                  <div className="text-sm text-gray-500 flex items-center gap-1">
                                    <Phone className="w-3 h-3" />
                                    {admin.phone}
                                  </div>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={getRoleBadgeColor(admin.role)}>
                              {admin.role === 'superAdmin' && (
                                <>
                                  <Crown className="w-3 h-3 mr-1" />
                                  Super Admin
                                </>
                              )}
                              {admin.role === 'zonalAdmin' && (
                                <>
                                  <MapPin className="w-3 h-3 mr-1" />
                                  Zonal Admin
                                </>
                              )}
                              {admin.role === 'wardAdmin' && (
                                <>
                                  <Building2 className="w-3 h-3 mr-1" />
                                  Ward Admin
                                </>
                              )}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              {admin.zoneName && (
                                <div className="flex items-center text-sm text-gray-700">
                                  <MapPin className="w-3 h-3 mr-1 text-gray-400" />
                                  {admin.zoneName}
                                </div>
                              )}
                              {admin.wardName && (
                                <div className="flex items-center text-sm text-gray-500">
                                  <Building2 className="w-3 h-3 mr-1 text-gray-400" />
                                  {admin.wardName}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(admin.status)}
                          </TableCell>
                          <TableCell className="text-sm text-gray-500">
                            {admin.lastLogin ? (
                              <div>
                                <div className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {admin.lastLogin.toLocaleDateString()}
                                </div>
                                <div className="text-xs">
                                  {Math.ceil((new Date().getTime() - admin.lastLogin.getTime()) / (1000 * 60 * 60 * 24))} days ago
                                </div>
                              </div>
                            ) : (
                              'Never'
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-gray-500">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {admin.appointedAt?.toLocaleDateString() || 'N/A'}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                
                                {canPerformAction(admin, 'view') && (
                                  <Dialog>
                                    <DialogTrigger asChild>
                                      <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                        <Eye className="mr-2 h-4 w-4" />
                                        View Details
                                      </DropdownMenuItem>
                                    </DialogTrigger>
                                    <DialogContent className="max-w-2xl">
                                      <DialogHeader>
                                        <DialogTitle className="flex items-center gap-2">
                                          <Shield className="h-5 w-5 text-blue-600" />
                                          Administrator Details - {admin.name}
                                        </DialogTitle>
                                        <DialogDescription>
                                          Complete information for this administrator
                                        </DialogDescription>
                                      </DialogHeader>
                                      <div className="grid grid-cols-2 gap-6 py-4">
                                        <div className="space-y-4">
                                          <div>
                                            <label className="text-sm font-medium text-gray-600">Full Name</label>
                                            <p className="text-gray-900">{admin.name}</p>
                                          </div>
                                          <div>
                                            <label className="text-sm font-medium text-gray-600">Email</label>
                                            <p className="text-gray-900">{admin.email}</p>
                                          </div>
                                          <div>
                                            <label className="text-sm font-medium text-gray-600">Phone</label>
                                            <p className="text-gray-900">{admin.phone || 'Not provided'}</p>
                                          </div>
                                          <div>
                                            <label className="text-sm font-medium text-gray-600">Role</label>
                                            <Badge className={getRoleBadgeColor(admin.role)}>
                                              {admin.role}
                                            </Badge>
                                          </div>
                                        </div>
                                        <div className="space-y-4">
                                          <div>
                                            <label className="text-sm font-medium text-gray-600">Zone</label>
                                            <p className="text-gray-900">{admin.zoneName || 'Not assigned'}</p>
                                          </div>
                                          <div>
                                            <label className="text-sm font-medium text-gray-600">Ward</label>
                                            <p className="text-gray-900">{admin.wardName || 'Not assigned'}</p>
                                          </div>
                                          <div>
                                            <label className="text-sm font-medium text-gray-600">Status</label>
                                            <div>{getStatusBadge(admin.status)}</div>
                                          </div>
                                          <div>
                                            <label className="text-sm font-medium text-gray-600">Appointed Date</label>
                                            <p className="text-gray-900">
                                              {admin.appointedAt?.toLocaleDateString() || 'Unknown'}
                                            </p>
                                          </div>
                                        </div>
                                      </div>
                                    </DialogContent>
                                  </Dialog>
                                )}
                                
                                {canPerformAction(admin, 'edit') && (
                                  <DropdownMenuItem onClick={() => openEditDialog(admin)}>
                                    <Edit className="mr-2 h-4 w-4" />
                                    Edit Details
                                  </DropdownMenuItem>
                                )}

                                {canPerformAction(admin, 'suspend') && admin.status === 'active' && (
                                  <DropdownMenuItem onClick={() => handleSuspendAdmin(admin.id)}>
                                    <UserX className="mr-2 h-4 w-4" />
                                    Suspend Admin
                                  </DropdownMenuItem>
                                )}

                                {canPerformAction(admin, 'activate') && admin.status === 'suspended' && (
                                  <DropdownMenuItem onClick={() => handleActivateAdmin(admin.id)}>
                                    <UserCheck className="mr-2 h-4 w-4" />
                                    Activate Admin
                                  </DropdownMenuItem>
                                )}

                                {canPerformAction(admin, 'revoke') && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <DropdownMenuItem 
                                          className="text-red-600"
                                          onSelect={(e) => e.preventDefault()}
                                        >
                                          <Trash2 className="mr-2 h-4 w-4" />
                                          Revoke Admin Role
                                        </DropdownMenuItem>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle className="flex items-center gap-2">
                                            <AlertTriangle className="h-5 w-5 text-red-600" />
                                            Revoke Admin Role
                                          </AlertDialogTitle>
                                          <AlertDialogDescription>
                                            Are you sure you want to revoke {admin.name}&apos;s admin role? 
                                            This will remove all their administrative privileges and cannot be undone.
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                                          <AlertDialogAction
                                            onClick={() => handleRevokeAdmin(admin.id)}
                                            className="bg-red-600 hover:bg-red-700"
                                          >
                                            Revoke Role
                                          </AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  </>
                                )}

                                {!canPerformAction(admin, 'view') && (
                                  <DropdownMenuItem disabled>
                                    <AlertTriangle className="mr-2 h-4 w-4" />
                                    No permissions
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Appoint Admin Dialog */}
        <Dialog open={isAppointDialogOpen} onOpenChange={setIsAppointDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-blue-600" />
                Appoint New Administrator
              </DialogTitle>
              <DialogDescription>
                Select a verified user and assign them administrative privileges for a specific zone and ward.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-4">
              <div className="space-y-2">
                <Label htmlFor="userId">Select User</Label>
                <Select 
                  value={appointmentData.userId} 
                  onValueChange={(userId) => setAppointmentData(prev => ({ ...prev, userId }))}
                  disabled={submitting}
                >
                  <SelectTrigger className="border-gray-200 focus:border-blue-500 focus:ring-blue-500">
                    <SelectValue placeholder="Select a verified user" />
                  </SelectTrigger>
                  <SelectContent>
                    {regularUsers.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name} ({user.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {regularUsers.length === 0 && (
                  <p className="text-xs text-gray-500">No verified users available for appointment</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="adminRole">Admin Role</Label>
                <Select 
                  value={appointmentData.role} 
                  onValueChange={(role) => setAppointmentData(prev => ({ ...prev, role: role as 'zonalAdmin' | 'wardAdmin', wardId: '' }))}
                  disabled={submitting}
                >
                  <SelectTrigger className="border-gray-200 focus:border-blue-500 focus:ring-blue-500">
                    <SelectValue placeholder="Select admin role" />
                  </SelectTrigger>
                  <SelectContent>
                    {canManageZonalAdmins && (
                      <SelectItem value="zonalAdmin">Zonal Administrator</SelectItem>
                    )}
                    {canManageWardAdmins && (
                      <SelectItem value="wardAdmin">Ward Administrator</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="assignZone">Assign to Zone</Label>
                  <Select 
                    value={appointmentData.zoneId} 
                    onValueChange={(zoneId) => setAppointmentData(prev => ({ ...prev, zoneId, wardId: '' }))}
                    disabled={submitting || (isZonalAdmin && accessibleZones.length === 1)}
                  >
                    <SelectTrigger className="border-gray-200 focus:border-blue-500 focus:ring-blue-500">
                      <SelectValue placeholder="Select zone" />
                    </SelectTrigger>
                    <SelectContent>
                      {accessibleZones.map((zone) => (
                        <SelectItem key={zone.id} value={zone.id}>
                          {zone.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {isZonalAdmin && (
                    <p className="text-xs text-gray-500">
                      You can only appoint admins in your assigned zone.
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="assignWard">Assign to Ward</Label>
                  <Select
                    value={appointmentData.wardId}
                    onValueChange={(wardId) => setAppointmentData(prev => ({ ...prev, wardId }))}
                    disabled={submitting || !(appointmentData.role === 'wardAdmin' && appointmentData.zoneId)}
                  >
                    <SelectTrigger className="border-gray-200 focus:border-blue-500 focus:ring-blue-500">
                      <SelectValue placeholder={
                        appointmentData.role !== 'wardAdmin' 
                          ? 'Select admin role first' 
                          : (!appointmentData.zoneId ? 'Select zone first' : 'Select ward')
                      } />
                    </SelectTrigger>
                    <SelectContent>
                      {appointmentData.role === 'wardAdmin' && appointmentData.zoneId
                        ? availableWards.map((ward) => (
                            <SelectItem key={ward.id} value={ward.id}>
                              {ward.name}
                            </SelectItem>
                          ))
                        : null}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <div className="flex items-start space-x-3">
                  <Mail className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-blue-900">Appointment Process</h4>
                    <p className="text-sm text-blue-700 mt-1">
                      The selected user will be immediately granted administrative privileges. 
                      They will receive an email notification about their new role and responsibilities.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setIsAppointDialogOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAppointAdmin}
                disabled={
                  submitting ||
                  !appointmentData.userId ||
                  !appointmentData.role ||
                  !appointmentData.zoneId ||
                  (appointmentData.role === 'wardAdmin' && !appointmentData.wardId)
                }
                className="bg-blue-600 hover:bg-blue-700"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Appointing...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Appoint Admin
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Admin Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Edit className="h-5 w-5 text-blue-600" />
                Edit Administrator
              </DialogTitle>
              <DialogDescription>
                Update administrator information and assignments.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="editName">Full Name</Label>
                  <Input
                    id="editName"
                    value={editData.name}
                    onChange={(e) => setEditData(prev => ({ ...prev, name: e.target.value }))}
                    disabled={submitting}
                    className="border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editEmail">Email Address</Label>
                  <Input
                    id="editEmail"
                    type="email"
                    value={editData.email}
                    onChange={(e) => setEditData(prev => ({ ...prev, email: e.target.value }))}
                    disabled={submitting}
                    className="border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="editPhone">Phone Number</Label>
                <Input
                  id="editPhone"
                  value={editData.phone}
                  onChange={(e) => setEditData(prev => ({ ...prev, phone: e.target.value }))}
                  disabled={submitting}
                  className="border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="editZone">Zone Assignment</Label>
                  <Select 
                    value={editData.zoneId} 
                    onValueChange={(value) => setEditData(prev => ({ ...prev, zoneId: value, wardId: '' }))}
                    disabled={submitting || (isZonalAdmin && accessibleZones.length === 1)}
                  >
                    <SelectTrigger className="border-gray-200 focus:border-blue-500 focus:ring-blue-500">
                      <SelectValue placeholder="Select zone" />
                    </SelectTrigger>
                    <SelectContent>
                      {accessibleZones.map((zone) => (
                        <SelectItem key={zone.id} value={zone.id}>
                          {zone.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedAdmin?.role === 'wardAdmin' && (
                  <div className="space-y-2">
                    <Label htmlFor="editWard">Ward Assignment</Label>
                    <Select 
                      value={editData.wardId} 
                      onValueChange={(value) => setEditData(prev => ({ ...prev, wardId: value }))}
                      disabled={submitting || !editData.zoneId}
                    >
                      <SelectTrigger className="border-gray-200 focus:border-blue-500 focus:ring-blue-500">
                        <SelectValue placeholder="Select ward" />
                      </SelectTrigger>
                      <SelectContent>
                        {editAvailableWards.map((ward) => (
                          <SelectItem key={ward.id} value={ward.id}>
                            {ward.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setIsEditDialogOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleEditAdmin}
                disabled={submitting || !editData.name || !editData.email || !editData.zoneId}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}