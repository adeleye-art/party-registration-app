'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  User, 
  MapPin, 
  Building2, 
  Search, 
  Filter,
  Eye,
  UserCheck,
  UserX,
  AlertTriangle,
  Mail,
  Phone,
  FileText,
  Calendar,
  MoreHorizontal,
  Shield,
  IdCard,
  Download
} from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
// Firebase imports
import { 
  collection, 
  query, 
  onSnapshot, 
  doc, 
  updateDoc, 
  orderBy, 
  where,
  addDoc,
  serverTimestamp,
  Timestamp,
  deleteDoc,
  getDocs
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from '@/hooks/use-toast';

interface Ward {
  id: string;
  name: string;
  description?: string;
  createdAt?: Timestamp;
}

interface Zone {
  id: string;
  name: string;
  wardId: string; // Zone belongs to a ward
  createdAt?: Timestamp;
}

interface UserData {
  name: string;
  email: string;
  phone: string;
  idNumber: string;
  address: string;
  dob?: string;
  idType?: string;
  localGovt?: string;
  occupation?: string;
  qualification?: string;
}

interface PendingUserWithLocation {
  id: string;
  userData: UserData;
  zoneId: string;
  wardId: string;
  role: string;
  verified: boolean;
  createdAt: Date;
  updatedAt: Date;
  rejectionReason?: string;
  zoneName?: string;
  wardName?: string;
}

export default function ApprovalsPage() {
  const { user } = useAuth();
  const [pendingUsers, setPendingUsers] = useState<PendingUserWithLocation[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<PendingUserWithLocation[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedZone, setSelectedZone] = useState<string>('all');
  const [selectedWard, setSelectedWard] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('pending');
  const [selectedUser, setSelectedUser] = useState<PendingUserWithLocation | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [reassignmentData, setReassignmentData] = useState({
    zoneId: '',
    wardId: '',
  });

  // Role-based permissions
  const isSuperAdmin = user?.role === 'superAdmin';
  const isZonalAdmin = user?.role === 'zonalAdmin';
  const isWardAdmin = user?.role === 'wardAdmin';

  // Get accessible wards based on user role
  const getAccessibleWards = () => {
    if (isSuperAdmin) return wards;
    if (isWardAdmin && user?.wardId) {
      return wards.filter(ward => ward.id === user.wardId);
    }
    if (isZonalAdmin && user?.zoneId) {
      // Find the ward that contains the user's zone
      const userZone = zones.find(zone => zone.id === user.zoneId);
      return wards.filter(ward => ward.id === userZone?.wardId);
    }
    return [];
  };

  // Get accessible zones based on user role
  const getAccessibleZones = () => {
    if (isSuperAdmin) return zones;
    if (isWardAdmin && user?.wardId) {
      // Ward admin can see all zones under their ward
      return zones.filter(zone => zone.wardId === user.wardId);
    }
    if (isZonalAdmin && user?.zoneId) {
      // Zonal admin can only see their assigned zone
      return zones.filter(zone => zone.id === user.zoneId);
    }
    return [];
  };

  // Check if user can perform action on target user
  const canPerformAction = (targetUser: PendingUserWithLocation, action: string) => {
    if (!user) return false;

    // Super admin can do everything
    if (isSuperAdmin) return true;

    // Users cannot manage themselves for certain actions
    if (targetUser.id === user.id && ['approve', 'reject'].includes(action)) {
      return false;
    }

    // Ward admin can manage users in zones under their ward
    if (isWardAdmin && user?.wardId) {
      const canManageUser = targetUser.wardId === user.wardId;
      const canManageRole = !['superAdmin', 'zonalAdmin', 'wardAdmin'].includes(targetUser.role) || 
                           (targetUser.role === 'member');
      return canManageUser && canManageRole;
    }

    // Zonal admin can only manage users in their specific zone
    if (isZonalAdmin && user?.zoneId) {
      const canManageUser = targetUser.zoneId === user.zoneId;
      const canManageRole = targetUser.role === 'member';
      return canManageUser && canManageRole;
    }

    return false;
  };

  // Load wards and zones from Firebase with role-based filtering
  useEffect(() => {
    const loadWardsAndZones = async () => {
      try {
        // Load wards based on user role
        let wardsQuery;
        if (isSuperAdmin) {
          wardsQuery = query(collection(db, 'wards'), orderBy('name'));
        } else if (isWardAdmin && user?.wardId) {
          wardsQuery = query(collection(db, 'wards'), where('__name__', '==', user.wardId));
        } else if (isZonalAdmin && user?.zoneId) {
          // For zonal admin, we need to find their ward through their zone
          const zonesSnapshot = await getDocs(query(collection(db, 'zones'), where('__name__', '==', user.zoneId)));
          if (!zonesSnapshot.empty) {
            const userZone = zonesSnapshot.docs[0].data();
            wardsQuery = query(collection(db, 'wards'), where('__name__', '==', userZone.wardId));
          } else {
            wardsQuery = query(collection(db, 'wards'), orderBy('name'));
          }
        } else {
          wardsQuery = query(collection(db, 'wards'), orderBy('name'));
        }

        const wardsSnapshot = await getDocs(wardsQuery);
        const wardsData = wardsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Ward[];
        setWards(wardsData);

        // Load zones based on user role
        let zonesQuery;
        if (isSuperAdmin) {
          zonesQuery = query(collection(db, 'zones'), orderBy('name'));
        } else if (isWardAdmin && user?.wardId) {
          zonesQuery = query(collection(db, 'zones'), where('wardId', '==', user.wardId), orderBy('name'));
        } else if (isZonalAdmin && user?.zoneId) {
          zonesQuery = query(collection(db, 'zones'), where('__name__', '==', user.zoneId));
        } else {
          zonesQuery = query(collection(db, 'zones'), orderBy('name'));
        }

        const zonesSnapshot = await getDocs(zonesQuery);
        const zonesData = zonesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Zone[];
        setZones(zonesData);

      } catch (error) {
        console.error('Error fetching wards and zones:', error);
        toast({
          title: "Error",
          description: "Failed to load wards and zones",
          variant: "destructive",
        });
      }
    };

    if (user) {
      loadWardsAndZones();
    }
  }, [user, isSuperAdmin, isWardAdmin, isZonalAdmin]);

  // Load pending users from Firebase with real-time updates and role-based filtering
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    let usersQuery;

    // Apply role-based filtering for users
    if (isSuperAdmin) {
      // Super admin can see all users
      usersQuery = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    } else if (isWardAdmin && user?.wardId) {
      // Ward admin can see users in zones under their ward
      usersQuery = query(
        collection(db, 'users'),
        where('wardId', '==', user.wardId),
        orderBy('createdAt', 'desc')
      );
    } else if (isZonalAdmin && user?.zoneId) {
      // Zonal admin can only see users in their specific zone
      usersQuery = query(
        collection(db, 'users'),
        where('zoneId', '==', user.zoneId),
        orderBy('createdAt', 'desc')
      );
    } else {
      // Fallback - no access
      setLoading(false);
      return;
    }

    console.log('Setting up users query for role:', user.role);

    const unsubscribe = onSnapshot(usersQuery, (snapshot) => {
      const usersData = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          userData: {
            name: data.name || '',
            email: data.email || '',
            phone: data.phone || '',
            idNumber: data.idNumber || '',
            address: data.address || '',
            dob: data.dob || '',
            idType: data.idType || '',
            localGovt: data.localGovt || '',
            occupation: data.occupation || '',
            qualification: data.qualification || '',
          },
          zoneId: data.zoneId || '',
          wardId: data.wardId || '',
          role: data.role || 'member',
          verified: data.verified || false,
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(),
          updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : new Date(),
          rejectionReason: data.rejectionReason || '',
        };
      }) as PendingUserWithLocation[];

      // Enrich with zone and ward names
      const enrichedUsers = usersData.map(user => {
        const zone = zones.find(z => z.id === user.zoneId);
        const ward = wards.find(w => w.id === user.wardId);
        return {
          ...user,
          zoneName: zone?.name,
          wardName: ward?.name,
        };
      });

      console.log('Loaded users:', enrichedUsers.length);
      setPendingUsers(enrichedUsers);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching pending users:', error);
      toast({
        title: "Error",
        description: "Failed to load pending users",
        variant: "destructive",
      });
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, zones, wards, isSuperAdmin, isWardAdmin, isZonalAdmin]);

  // Filter users based on search and filters
  useEffect(() => {
    let filtered = pendingUsers;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(user => {
        const matchesName = user.userData?.name?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesEmail = user.userData?.email?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesId = user.userData?.idNumber?.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesName || matchesEmail || matchesId;
      });
    }

    // Zone filter
    if (selectedZone !== 'all') {
      filtered = filtered.filter(user => user.zoneId === selectedZone);
    }

    // Ward filter
    if (selectedWard !== 'all') {
      filtered = filtered.filter(user => user.wardId === selectedWard);
    }

    // Status filter
    if (selectedStatus !== 'all') {
      if (selectedStatus === 'approved') filtered = filtered.filter(user => user.verified === true);
      if (selectedStatus === 'pending') filtered = filtered.filter(user => user.verified === false && !user.rejectionReason);
      if (selectedStatus === 'rejected') filtered = filtered.filter(user => user.verified === false && user.rejectionReason);
    }

    setFilteredUsers(filtered);
  }, [pendingUsers, searchTerm, selectedZone, selectedWard, selectedStatus]);

  const handleApproveUser = async (userId: string) => {
    const targetUser = pendingUsers.find(u => u.id === userId);
    if (!targetUser || !canPerformAction(targetUser, 'approve')) {
      toast({
        title: "Error",
        description: "You don't have permission to approve this user",
        variant: "destructive",
      });
      return;
    }

    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        verified: true,
        verifiedAt: serverTimestamp(),
        approvedBy: user?.id || 'system',
        updatedAt: serverTimestamp()
      });

      // Log approval activity
      await addDoc(collection(db, 'activities'), {
        type: 'user_approved',
        description: `Approved registration for ${targetUser.userData.name}`,
        userId: user?.id,
        targetUserId: userId,
        metadata: {
          userName: targetUser.userData.name,
          userEmail: targetUser.userData.email,
        },
        createdAt: serverTimestamp(),
      });

      toast({
        title: "Success",
        description: `User ${targetUser.userData.name} approved successfully`,
      });
      setSelectedUser(null);
    } catch (error) {
      console.error('Error approving user:', error);
      toast({
        title: "Error",
        description: "Failed to approve user",
        variant: "destructive",
      });
    }
  };

  const handleRejectUser = async (userId: string, reason: string) => {
    const targetUser = pendingUsers.find(u => u.id === userId);
    if (!targetUser || !canPerformAction(targetUser, 'reject')) {
      toast({
        title: "Error",
        description: "You don't have permission to reject this user",
        variant: "destructive",
      });
      return;
    }

    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        verified: false,
        rejectionReason: reason,
        updatedAt: serverTimestamp(),
        rejectedBy: user?.id,
        rejectedAt: serverTimestamp(),
      });

      // Log rejection activity
      await addDoc(collection(db, 'activities'), {
        type: 'user_rejected',
        description: `Rejected registration for ${targetUser.userData.name}`,
        userId: user?.id,
        targetUserId: userId,
        metadata: {
          userName: targetUser.userData.name,
          userEmail: targetUser.userData.email,
          rejectionReason: reason,
        },
        createdAt: serverTimestamp(),
      });

      toast({
        title: "Success",
        description: "User rejected successfully",
      });
      setRejectionReason('');
    } catch (error) {
      console.error('Error rejecting user:', error);
      toast({
        title: "Error",
        description: "Failed to reject user",
        variant: "destructive",
      });
    }
  };

  const handleReassignUser = async (userId: string, newZoneId: string, newWardId: string) => {
    const targetUser = pendingUsers.find(u => u.id === userId);
    if (!targetUser || !canPerformAction(targetUser, 'reassign')) {
      toast({
        title: "Error",
        description: "You don't have permission to reassign this user",
        variant: "destructive",
      });
      return;
    }

    try {
      const selectedZoneData = zones.find(z => z.id === newZoneId);
      const selectedWardData = wards.find(w => w.id === newWardId);
      
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        zoneId: newZoneId,
        wardId: newWardId,
        updatedAt: serverTimestamp(),
        reassignedBy: user?.id,
        reassignedAt: serverTimestamp(),
      });

      // Log reassignment activity
      await addDoc(collection(db, 'activities'), {
        type: 'user_reassigned',
        description: `Reassigned ${targetUser.userData.name} to ${selectedZoneData?.name} - ${selectedWardData?.name}`,
        userId: user?.id,
        targetUserId: userId,
        metadata: {
          userName: targetUser.userData.name,
          oldZone: targetUser.zoneName,
          oldWard: targetUser.wardName,
          newZone: selectedZoneData?.name,
          newWard: selectedWardData?.name,
        },
        createdAt: serverTimestamp(),
      });

      toast({
        title: "Success",
        description: "User reassigned successfully",
      });
      setReassignmentData({ zoneId: '', wardId: '' });
    } catch (error) {
      console.error('Error reassigning user:', error);
      toast({
        title: "Error",
        description: "Failed to reassign user",
        variant: "destructive",
      });
    }
  };

  const handleDeleteUser = async (userId: string) => {
    const targetUser = pendingUsers.find(u => u.id === userId);
    if (!targetUser || !canPerformAction(targetUser, 'delete')) {
      toast({
        title: "Error",
        description: "You don't have permission to delete this user",
        variant: "destructive",
      });
      return;
    }

    try {
      await deleteDoc(doc(db, 'users', userId));
      
      toast({
        title: "Success",
        description: "User deleted successfully",
      });
    } catch (error) {
      console.error('Error deleting user:', error);
      toast({
        title: "Error",
        description: "Failed to delete user",
        variant: "destructive",
      });
    }
  };

  // Export users data
  const handleExportUsers = () => {
    const csvData = filteredUsers.map(user => ({
      Name: user.userData.name,
      Email: user.userData.email,
      Phone: user.userData.phone,
      'ID Number': user.userData.idNumber,
      Role: user.role,
      Ward: user.wardName,
      Zone: user.zoneName,
      Status: user.verified ? 'Approved' : (user.rejectionReason ? 'Rejected' : 'Pending'),
      'Application Date': user.createdAt?.toLocaleDateString(),
      Address: user.userData.address,
    }));

    const csvContent = [
      Object.keys(csvData[0] || {}).join(','),
      ...csvData.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `approvals-export-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    toast({
      title: "Success",
      description: "Approvals data exported successfully",
    });
  };

  const getStatusBadge = (user: PendingUserWithLocation) => {
    if (user.verified) {
      return (
        <Badge className="bg-green-100 text-green-800 border-green-200">
          <CheckCircle className="w-3 h-3 mr-1" />
          Approved
        </Badge>
      );
    } else if (user.rejectionReason) {
      return (
        <Badge className="bg-red-100 text-red-800 border-red-200">
          <XCircle className="w-3 h-3 mr-1" />
          Rejected
        </Badge>
      );
    } else {
      return (
        <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">
          <Clock className="w-3 h-3 mr-1" />
          Pending
        </Badge>
      );
    }
  };

  const getDaysAgo = (date: Date) => {
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays === 1 ? '1 day ago' : `${diffDays} days ago`;
  };

  const accessibleZones = getAccessibleZones();
  const accessibleWards = getAccessibleWards();
  
  // Filter zones based on selected ward
  const availableZones = selectedWard === 'all' 
    ? accessibleZones 
    : accessibleZones.filter(zone => zone.wardId === selectedWard);

  // For reassignment, filter zones based on selected ward
  const reassignmentAvailableZones = reassignmentData.wardId
    ? zones.filter(zone => zone.wardId === reassignmentData.wardId)
    : [];

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/4 animate-pulse"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                  <div className="h-8 bg-gray-200 rounded w-1/3"></div>
                </CardContent>
              </Card>
            ))}
          </div>
          <Card className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-64 bg-gray-200 rounded"></div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  const stats = {
    pending: pendingUsers.filter(u => u.verified === false && !u.rejectionReason).length,
    approved: pendingUsers.filter(u => u.verified === true).length,
    rejected: pendingUsers.filter(u => u.verified === false && u.rejectionReason).length,
  };

  // Role-based title and description
  const getRoleBasedTitle = () => {
    switch (user?.role) {
      case 'superAdmin':
        return 'User Approvals - All Requests';
      case 'wardAdmin':
        return `User Approvals - ${wards.find(w => w.id === user.wardId)?.name || 'Ward'} Requests`;
      case 'zonalAdmin':
        return `User Approvals - ${zones.find(z => z.id === user.zoneId)?.name || 'Zone'} Requests`;
      default:
        return 'User Approvals';
    }
  };

  const getRoleBasedDescription = () => {
    switch (user?.role) {
      case 'superAdmin':
        return 'Review and manage user registration requests across all wards and zones';
      case 'wardAdmin':
        return 'Review and manage user registration requests within zones under your ward';
      case 'zonalAdmin':
        return 'Review and manage user registration requests within your zone';
      default:
        return 'Review and manage user registration requests';
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Role-based access notification */}
        {user?.role !== 'superAdmin' && (
          <Alert className="border-blue-200 bg-blue-50">
            <Shield className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800">
              You have {user?.role === 'wardAdmin' ? 'ward' : 'zonal'} admin access. 
              You can only manage user approvals within your assigned {user?.role === 'wardAdmin' ? 'ward and its zones' : 'zone'}.
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
          <div className="flex items-center space-x-2">
            <Button onClick={handleExportUsers} variant="outline" className="bg-white">
              <Download className="w-4 h-4 mr-2" />
              Export Data
            </Button>
            <Badge variant="secondary" className="text-sm bg-blue-100 text-blue-800">
              {stats.pending} pending reviews
            </Badge>
          </div>
        </motion.div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              title: 'Pending Requests',
              value: stats.pending,
              icon: Clock,
              color: 'yellow',
              description: 'Awaiting review',
            },
            {
              title: 'Approved Users',
              value: stats.approved,
              icon: CheckCircle,
              color: 'green',
              description: 'Successfully approved',
            },
            {
              title: 'Rejected Requests',
              value: stats.rejected,
              icon: XCircle,
              color: 'red',
              description: 'Declined applications',
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

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5 text-blue-600" />
                Filters & Search
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="md:col-span-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search by name, email, or ID..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                </div>
                
                {/* Ward filter - only show if user has access to multiple wards */}
                {accessibleWards.length > 1 && (
                  <Select value={selectedWard} onValueChange={setSelectedWard}>
                    <SelectTrigger className="border-gray-200 focus:border-blue-500 focus:ring-blue-500">
                      <SelectValue placeholder="All Wards" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Wards</SelectItem>
                      {accessibleWards.map((ward) => (
                        <SelectItem key={ward.id} value={ward.id}>
                          {ward.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {/* Zone filter - only show if user has access to multiple zones */}
                {accessibleZones.length > 1 && (
                  <Select value={selectedZone} onValueChange={setSelectedZone}>
                    <SelectTrigger className="border-gray-200 focus:border-blue-500 focus:ring-blue-500">
                      <SelectValue placeholder="All Zones" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Zones</SelectItem>
                      {availableZones.map((zone) => (
                        <SelectItem key={zone.id} value={zone.id}>
                          {zone.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger className="border-gray-200 focus:border-blue-500 focus:ring-blue-500">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Pending Users Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-blue-600" />
                Registration Requests ({filteredUsers.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredUsers.length === 0 ? (
                <div className="text-center py-12">
                  <User className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No registration requests</h3>
                  <p className="text-gray-500">
                    {searchTerm || selectedZone !== 'all' || selectedWard !== 'all' || selectedStatus !== 'all'
                      ? 'No requests match your current filters.'
                      : 'There are no pending registration requests at this time.'}
                  </p>
                </div>
              ) : (
                <div className="rounded-md border border-gray-200">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="font-semibold">Applicant</TableHead>
                        <TableHead className="font-semibold">Contact</TableHead>
                        <TableHead className="font-semibold">Location</TableHead>
                        <TableHead className="font-semibold">Status</TableHead>
                        <TableHead className="font-semibold">Submitted</TableHead>
                        <TableHead className="text-right font-semibold">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.map((pendingUser) => (
                        <TableRow key={pendingUser.id} className="hover:bg-gray-50 transition-colors">
                          <TableCell>
                            <div className="flex items-center space-x-3">
                              <Avatar className="h-10 w-10 border-2 border-gray-200">
                                <AvatarFallback className="bg-blue-100 text-blue-700 font-semibold">
                                  {pendingUser.userData?.name.charAt(0).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="font-medium text-gray-900">{pendingUser.userData?.name}</div>
                                <div className="text-sm text-gray-500 flex items-center gap-1">
                                  <IdCard className="w-3 h-3" />
                                  ID: {pendingUser.userData?.idNumber}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="flex items-center text-sm text-gray-700">
                                <Mail className="w-3 h-3 mr-1 text-gray-400" />
                                {pendingUser.userData?.email}
                              </div>
                              <div className="flex items-center text-sm text-gray-500">
                                <Phone className="w-3 h-3 mr-1 text-gray-400" />
                                {pendingUser.userData?.phone}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              {pendingUser.wardName && (
                                <div className="flex items-center text-sm text-gray-700">
                                  <Building2 className="w-3 h-3 mr-1 text-gray-400" />
                                  {pendingUser.wardName}
                                </div>
                              )}
                              {pendingUser.zoneName && (
                                <div className="flex items-center text-sm text-gray-500">
                                  <MapPin className="w-3 h-3 mr-1 text-gray-400" />
                                  {pendingUser.zoneName}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(pendingUser)}
                            {pendingUser.rejectionReason && (
                              <div className="text-xs text-red-600 mt-1 max-w-xs truncate">
                                {pendingUser.rejectionReason}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-gray-500">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {pendingUser.createdAt.toLocaleDateString()}
                            </div>
                            <div className="text-xs text-gray-400">{getDaysAgo(pendingUser.createdAt)}</div>
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                
                                {/* View Details */}
                                {canPerformAction(pendingUser, 'view') && (
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
                                          <User className="h-5 w-5 text-blue-600" />
                                          Registration Details - {pendingUser.userData?.name}
                                        </DialogTitle>
                                        <DialogDescription>
                                          Complete application information
                                        </DialogDescription>
                                      </DialogHeader>
                                      <div className="grid grid-cols-2 gap-6 py-4">
                                        <div className="space-y-4">
                                          <div>
                                            <label className="text-sm font-medium text-gray-600">Full Name</label>
                                            <p className="text-gray-900">{pendingUser.userData?.name}</p>
                                          </div>
                                          <div>
                                            <label className="text-sm font-medium text-gray-600">Email</label>
                                            <p className="text-gray-900">{pendingUser.userData?.email}</p>
                                          </div>
                                          <div>
                                            <label className="text-sm font-medium text-gray-600">Phone</label>
                                            <p className="text-gray-900">{pendingUser.userData?.phone}</p>
                                          </div>
                                          <div>
                                            <label className="text-sm font-medium text-gray-600">ID Number</label>
                                            <p className="text-gray-900">{pendingUser.userData?.idNumber}</p>
                                          </div>
                                          <div>
                                            <label className="text-sm font-medium text-gray-600">Date of Birth</label>
                                            <p className="text-gray-900">{pendingUser.userData?.dob || 'Not provided'}</p>
                                          </div>
                                        </div>
                                        <div className="space-y-4">
                                          <div>
                                            <label className="text-sm font-medium text-gray-600">Address</label>
                                            <p className="text-gray-900">{pendingUser.userData?.address}</p>
                                          </div>
                                          <div>
                                            <label className="text-sm font-medium text-gray-600">Ward</label>
                                            <p className="text-gray-900">{pendingUser.wardName}</p>
                                          </div>
                                          <div>
                                            <label className="text-sm font-medium text-gray-600">Zone</label>
                                            <p className="text-gray-900">{pendingUser.zoneName}</p>
                                          </div>
                                          <div>
                                            <label className="text-sm font-medium text-gray-600">Occupation</label>
                                            <p className="text-gray-900">{pendingUser.userData?.occupation || 'Not provided'}</p>
                                          </div>
                                          <div>
                                            <label className="text-sm font-medium text-gray-600">Application Date</label>
                                            <p className="text-gray-900">
                                              {pendingUser.createdAt.toLocaleDateString()}
                                            </p>
                                          </div>
                                        </div>
                                      </div>
                                    </DialogContent>
                                  </Dialog>
                                )}

                                {/* Quick Approve */}
                                {canPerformAction(pendingUser, 'approve') && !pendingUser.verified && !pendingUser.rejectionReason && (
                                  <DropdownMenuItem 
                                    onClick={() => handleApproveUser(pendingUser.id)}
                                    className="text-green-600"
                                  >
                                    <UserCheck className="mr-2 h-4 w-4" />
                                    Quick Approve
                                  </DropdownMenuItem>
                                )}

                                {/* Reject with Reason */}
                                {canPerformAction(pendingUser, 'reject') && !pendingUser.verified && !pendingUser.rejectionReason && (
                                  <Dialog>
                                    <DialogTrigger asChild>
                                      <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                        <UserX className="mr-2 h-4 w-4" />
                                        Reject Application
                                      </DropdownMenuItem>
                                    </DialogTrigger>
                                    <DialogContent>
                                      <DialogHeader>
                                        <DialogTitle className="flex items-center gap-2">
                                          <AlertTriangle className="h-5 w-5 text-red-600" />
                                          Reject Application
                                        </DialogTitle>
                                        <DialogDescription>
                                          Please provide a reason for rejecting {pendingUser.userData?.name}&apos;s application.
                                        </DialogDescription>
                                      </DialogHeader>
                                      <div className="space-y-4 py-4">
                                        <div className="space-y-2">
                                          <Label htmlFor="rejectionReason">Rejection Reason</Label>
                                          <Textarea
                                            id="rejectionReason"
                                            placeholder="Please explain why this application is being rejected..."
                                            value={rejectionReason}
                                            onChange={(e) => setRejectionReason(e.target.value)}
                                            className="border-gray-200 focus:border-blue-500 focus:ring-blue-500 resize-none"
                                            rows={3}
                                          />
                                        </div>
                                      </div>
                                      <DialogFooter>
                                        <Button variant="outline" onClick={() => setRejectionReason('')}>
                                          Cancel
                                        </Button>
                                        <Button 
                                          variant="destructive"
                                          onClick={() => {
                                            handleRejectUser(pendingUser.id, rejectionReason);
                                            setRejectionReason('');
                                          }}
                                          disabled={!rejectionReason.trim()}
                                        >
                                          Reject Application
                                        </Button>
                                      </DialogFooter>
                                    </DialogContent>
                                  </Dialog>
                                )}

                                {/* Reassign Location */}
                                {canPerformAction(pendingUser, 'reassign') && (
                                  <Dialog>
                                    <DialogTrigger asChild>
                                      <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                        <MapPin className="mr-2 h-4 w-4" />
                                        Reassign Location
                                      </DropdownMenuItem>
                                    </DialogTrigger>
                                    <DialogContent>
                                      <DialogHeader>
                                        <DialogTitle className="flex items-center gap-2">
                                          <MapPin className="h-5 w-5 text-blue-600" />
                                          Reassign Location
                                        </DialogTitle>
                                        <DialogDescription>
                                          Please select a new ward and zone for {pendingUser.userData?.name}.
                                        </DialogDescription>
                                      </DialogHeader>
                                      <div className="space-y-4 py-4">
                                        <div className="space-y-2">
                                          <Label htmlFor="wardId">Select Ward</Label>
                                          <Select onValueChange={(wardId) => setReassignmentData({ ...reassignmentData, wardId, zoneId: '' })}>
                                            <SelectTrigger className="border-gray-200 focus:border-blue-500 focus:ring-blue-500">
                                              <SelectValue placeholder="Select Ward" />
                                            </SelectTrigger>
                                            <SelectContent>
                                              {accessibleWards.map((ward) => (
                                                <SelectItem key={ward.id} value={ward.id}>
                                                  {ward.name}
                                                </SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                        </div>
                                        <div className="space-y-2">
                                          <Label htmlFor="zoneId">Select Zone</Label>
                                          <Select 
                                            onValueChange={(zoneId) => setReassignmentData({ ...reassignmentData, zoneId })}
                                            disabled={!reassignmentData.wardId}
                                          >
                                            <SelectTrigger className="border-gray-200 focus:border-blue-500 focus:ring-blue-500">
                                              <SelectValue placeholder="Select Zone" />
                                            </SelectTrigger>
                                            <SelectContent>
                                              {reassignmentAvailableZones.map((zone) => (
                                                <SelectItem key={zone.id} value={zone.id}>
                                                  {zone.name}
                                                </SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                        </div>
                                      </div>
                                      <DialogFooter>
                                        <Button variant="outline" onClick={() => setReassignmentData({ zoneId: '', wardId: '' })}>
                                          Cancel
                                        </Button>
                                        <Button 
                                          onClick={() => {
                                            handleReassignUser(pendingUser.id, reassignmentData.zoneId, reassignmentData.wardId);
                                            setReassignmentData({ zoneId: '', wardId: '' });
                                          }}
                                          disabled={!reassignmentData.zoneId || !reassignmentData.wardId}
                                          className="bg-blue-600 hover:bg-blue-700"
                                        >
                                          Reassign Location
                                        </Button>
                                      </DialogFooter>
                                    </DialogContent>
                                  </Dialog>
                                )}

                                {/* Delete User */}
                                {canPerformAction(pendingUser, 'delete') && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <DropdownMenuItem 
                                          className="text-red-600"
                                          onSelect={(e) => e.preventDefault()}
                                        >
                                          <XCircle className="mr-2 h-4 w-4" />
                                          Delete User
                                        </DropdownMenuItem>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle className="flex items-center gap-2">
                                            <AlertTriangle className="h-5 w-5 text-red-600" />
                                            Delete User
                                          </AlertDialogTitle>
                                          <AlertDialogDescription>
                                            Are you sure you want to permanently delete {pendingUser.userData?.name}? 
                                            This action cannot be undone and will remove all user data.
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                                          <AlertDialogAction
                                            onClick={() => handleDeleteUser(pendingUser.id)}
                                            className="bg-red-600 hover:bg-red-700"
                                          >
                                            Delete User
                                          </AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  </>
                                )}

                                {!canPerformAction(pendingUser, 'view') && (
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
      </div>
    </DashboardLayout>
  );
}