'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Users, 
  Search, 
  Filter, 
  UserCheck, 
  UserX, 
  Shield, 
  MapPin, 
  Building2,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  Download,
  AlertTriangle,
  Phone,
  Mail,
  Calendar,
  IdCard
} from 'lucide-react';
import { 
  collection, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy,
  onSnapshot,
  Timestamp,
  where 
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Alert,
  AlertDescription,
} from '@/components/ui/alert';
import { User } from '@/types';
import { toast } from '@/hooks/use-toast';

interface UserWithLocation extends User {
  zoneId?: string;
  wardId?: string;
  zoneName?: string;
  wardName?: string;
}

interface Zone {
  id: string;
  name: string;
}

interface Ward {
  id: string;
  name: string;
  zoneId: string;
}

export default function UsersPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserWithLocation[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserWithLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedZone, setSelectedZone] = useState<string>('all');
  const [selectedWard, setSelectedWard] = useState<string>('all');
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<UserWithLocation | null>(null);

  // Role-based permissions
  const canManageAllUsers = user?.role === 'superAdmin';
  const canManageZoneUsers = user?.role === 'zonalAdmin' || canManageAllUsers;
  const canManageWardUsers = user?.role === 'wardAdmin' || canManageZoneUsers;

  // Get accessible zones based on user role
  const getAccessibleZones = () => {
    if (canManageAllUsers) return zones;
    if (user?.role === 'zonalAdmin') {
      return zones.filter(zone => zone.id === user.zoneId);
    }
    if (user?.role === 'wardAdmin') {
      const userWard = wards.find(w => w.id === user.wardId);
      return zones.filter(zone => zone.id === userWard?.zoneId);
    }
    return [];
  };

  // Get accessible wards based on user role
  const getAccessibleWards = () => {
    if (canManageAllUsers) return wards;
    if (user?.role === 'zonalAdmin') {
      return wards.filter(ward => ward.zoneId === user.zoneId);
    }
    if (user?.role === 'wardAdmin') {
      return wards.filter(ward => ward.id === user.wardId);
    }
    return [];
  };

  // Check if user can perform action on target user
  const canPerformAction = (targetUser: UserWithLocation, action: string) => {
    if (!user) return false;

    // Super admin can do everything
    if (user.role === 'superAdmin') return true;

    // Users cannot manage themselves for certain actions
    if (targetUser.id === user.id && ['approve', 'remove'].includes(action)) {
      return false;
    }

    // Zonal admin can manage users in their zone (except other admins of equal/higher level)
    if (user.role === 'zonalAdmin') {
      const canManageUser = targetUser.zoneId === user.zoneId;
      const canManageRole = !['superAdmin', 'zonalAdmin'].includes(targetUser.role) || 
                           (targetUser.role === 'zonalAdmin' && targetUser.id === user.id && action === 'view');
      return canManageUser && canManageRole;
    }

    // Ward admin can only manage members in their ward
    if (user.role === 'wardAdmin') {
      const canManageUser = targetUser.wardId === user.wardId;
      const canManageRole = targetUser.role === 'member';
      return canManageUser && canManageRole;
    }

    return false;
  };

  // Fetch zones from Firebase
  const fetchZones = async () => {
    try {
      console.log('🏢 Fetching zones...');
      const zonesSnapshot = await getDocs(collection(db, 'zones'));
      console.log(`📋 Found ${zonesSnapshot.docs.length} zones`);
      
      const zonesData = zonesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Zone[];
      
      setZones(zonesData);
      console.log('✅ Zones set:', zonesData);
    } catch (error : any) {	
      console.error('❌ Error fetching zones:', error);
      toast({
        title: "Error",
        description: `Failed to fetch zones: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  // Fetch wards from Firebase
  const fetchWards = async () => {
    try {
      console.log('🏘️ Fetching wards...');
      let wardsQuery = collection(db, 'wards');
      
      // Filter wards based on user role
      if (user?.role === 'zonalAdmin') {
       let wardsQuery = query(collection(db, 'wards'), where('zoneId', '==', user.zoneId));
      } else if (user?.role === 'wardAdmin') {
       let wardsQuery = query(collection(db, 'wards'), where('id', '==', user.wardId));
      }

      const wardsSnapshot = await getDocs(wardsQuery);
      console.log(`📋 Found ${wardsSnapshot.docs.length} wards`);
      
      const wardsData = wardsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Ward[];
      
      setWards(wardsData);
      console.log('✅ Wards set:', wardsData);
    } catch (error: any) {
      console.error('❌ Error fetching wards:', error);
      toast({
        title: "Error",
        description: `Failed to fetch wards: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  // Fetch users from Firebase with role-based filtering
  const fetchUsers = () => {
    try {
      console.log('👥 Setting up users listener...');
      
      let usersQuery = query(
        collection(db, 'users'),
        orderBy('createdAt', 'desc')
      );

      // Apply role-based filtering
      if (user?.role === 'zonalAdmin') {
        usersQuery = query(
          collection(db, 'users'),
          where('zoneId', '==', user.zoneId),
          orderBy('createdAt', 'desc')
        );
      } else if (user?.role === 'wardAdmin') {
        usersQuery = query(
          collection(db, 'users'),
          where('wardId', '==', user.wardId),
          orderBy('createdAt', 'desc')
        );
      }

      const unsubscribe = onSnapshot(usersQuery, (snapshot) => {
        console.log(`📊 Users snapshot received: ${snapshot.docs.length} documents`);
        
        if (snapshot.empty) {
          console.log('📭 No users found in database');
          setUsers([]);
          setFilteredUsers([]);
          setLoading(false);
          return;
        }

        const usersData = snapshot.docs.map(doc => {
          const data = doc.data();
          console.log('User doc:', doc.id, data);
          
          return {
            id: doc.id,
            ...data,
            // Convert Firestore Timestamp to Date
            createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(data.createdAt || Date.now()),
            updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : new Date(data.updatedAt || Date.now()),
          };
        }) as UserWithLocation[];

        console.log('🔄 Processing users data...', usersData);

        // Enrich users with zone and ward names
        const enrichedUsers = usersData.map(userData => {
          const zone = zones.find(z => z.id === userData.zoneId);
          const ward = wards.find(w => w.id === userData.wardId);
          
          return {
            ...userData,
            zoneName: zone?.name,
            wardName: ward?.name,
          } as UserWithLocation;
        });

        console.log('✅ Users processed and enriched:', enrichedUsers);
        setUsers(enrichedUsers);
        setFilteredUsers(enrichedUsers);
        setLoading(false);
      }, (error) => {
        console.error('❌ Error in users listener:', error);
        toast({
          title: "Error",
          description: `Failed to fetch users: ${error.message}`,
          variant: "destructive",
        });
        setLoading(false);
      });

      console.log('✅ Users listener set up successfully');
      return unsubscribe;
    } catch (error: any) {
      console.error('❌ Error setting up users listener:', error);
      toast({
        title: "Error",
        description: `Failed to setup users listener: ${error.message}`,
        variant: "destructive",
      });
      setLoading(false);
      return () => {}; // Return empty cleanup function
    }
  };

  // Initialize data with better error handling and debugging
  useEffect(() => {
    const initializeData = async () => {
      console.log('🔄 Starting data initialization...');
      setLoading(true);
      
      try {
        console.log('📡 Fetching zones and wards...');
        await Promise.all([fetchZones(), fetchWards()]);
        console.log('✅ Zones and wards fetched successfully');
      } catch (error) {
        console.error('❌ Error during initialization:', error);
        setLoading(false);
      }
    };
    
    if (user) {
      initializeData();
    }
  }, [user]);

  // Setup users listener
  useEffect(() => {
    if (user && zones.length > 0) {
      console.log(`📊 User role: ${user.role}, Zones: ${zones.length}, Wards: ${wards.length}`);
      const unsubscribe = fetchUsers();
      return unsubscribe;
    }
  }, [user, zones, wards]);

  // Filter users based on search and filters
  useEffect(() => {
    let filtered = users;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(userData =>
        userData.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        userData.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        userData.idNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        userData.phone?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Zone filter
    if (selectedZone !== 'all') {
      filtered = filtered.filter(userData => userData.zoneId === selectedZone);
    }

    // Ward filter
    if (selectedWard !== 'all') {
      filtered = filtered.filter(userData => userData.wardId === selectedWard);
    }

    // Role filter
    if (selectedRole !== 'all') {
      filtered = filtered.filter(userData => userData.role === selectedRole);
    }

    // Status filter
    if (selectedStatus !== 'all') {
      if (selectedStatus === 'verified') {
        filtered = filtered.filter(userData => userData.verified);
      } else if (selectedStatus === 'unverified') {
        filtered = filtered.filter(userData => !userData.verified);
      }
    }

    setFilteredUsers(filtered);
  }, [users, searchTerm, selectedZone, selectedWard, selectedRole, selectedStatus]);

  // Approve user
  const handleApproveUser = async (userId: string) => {
    const targetUser = users.find(u => u.id === userId);
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
        updatedAt: new Date(),
      });
      
      toast({
        title: "Success",
        description: "User has been approved successfully",
      });
    } catch (error) {
      console.error('Error approving user:', error);
      toast({
        title: "Error",
        description: "Failed to approve user",
        variant: "destructive",
      });
    }
  };

  // Reject/Remove user
  const handleRemoveUser = async (userId: string) => {
    const targetUser = users.find(u => u.id === userId);
    if (!targetUser || !canPerformAction(targetUser, 'remove')) {
      toast({
        title: "Error",
        description: "You don't have permission to remove this user",
        variant: "destructive",
      });
      return;
    }

    if (!confirm('Are you sure you want to remove this user? This action cannot be undone.')) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'users', userId));
      
      toast({
        title: "Success",
        description: "User has been removed successfully",
      });
    } catch (error) {
      console.error('Error removing user:', error);
      toast({
        title: "Error",
        description: "Failed to remove user",
        variant: "destructive",
      });
    }
  };

  // Export users data
  const handleExportUsers = () => {
    const csvData = filteredUsers.map(userData => ({
      Name: userData.name,
      Email: userData.email,
      Phone: userData.phone,
      'ID Number': userData.idNumber,
      Role: userData.role,
      Zone: userData.zoneName,
      Ward: userData.wardName,
      Status: userData.verified ? 'Verified' : 'Pending',
      'Joined Date': userData.createdAt?.toLocaleDateString(),
      Address: userData.address,
    }));

    const csvContent = [
      Object.keys(csvData[0] || {}).join(','),
      ...csvData.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `users-export-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    toast({
      title: "Success",
      description: "Users data exported successfully",
    });
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

  const getStatusBadge = (verified: boolean) => {
    return verified ? (
      <Badge className="bg-green-100 text-green-800 border-green-200">
        <CheckCircle className="w-3 h-3 mr-1" />
        Verified
      </Badge>
    ) : (
      <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">
        <XCircle className="w-3 h-3 mr-1" />
        Pending
      </Badge>
    );
  };

  const accessibleZones = getAccessibleZones();
  const accessibleWards = getAccessibleWards();
  const availableWards = selectedZone === 'all' 
    ? accessibleWards 
    : accessibleWards.filter(ward => ward.zoneId === selectedZone);

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
    total: users.length,
    verified: users.filter(u => u.verified).length,
    pending: users.filter(u => !u.verified).length,
    admins: users.filter(u => u.role !== 'member').length,
  };

  // Role-based title and description
  const getRoleBasedTitle = () => {
    switch (user?.role) {
      case 'superAdmin':
        return 'User Management - All Users';
      case 'zonalAdmin':
        return `User Management - ${zones.find(z => z.id === user.zoneId)?.name || 'Zone'} Users`;
      case 'wardAdmin':
        return `User Management - ${wards.find(w => w.id === user.wardId)?.name || 'Ward'} Users`;
      default:
        return 'User Management';
    }
  };

  const getRoleBasedDescription = () => {
    switch (user?.role) {
      case 'superAdmin':
        return 'Manage all registered users across all zones and wards';
      case 'zonalAdmin':
        return 'Manage users within your zone';
      case 'wardAdmin':
        return 'Manage members within your ward';
      default:
        return 'Manage users';
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Role-based access notification */}
        {user?.role !== 'superAdmin' && (
          <Alert className="border-blue-200 bg-blue-50">
            <AlertTriangle className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800">
              You have {user?.role === 'zonalAdmin' ? 'zonal' : 'ward'} admin access. 
              You can only manage users within your assigned {user?.role === 'zonalAdmin' ? 'zone' : 'ward'}.
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
          <Button onClick={handleExportUsers} className="bg-blue-600 hover:bg-blue-700">
            <Download className="w-4 h-4 mr-2" />
            Export Users
          </Button>
        </motion.div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[
            {
              title: 'Total Users',
              value: stats.total,
              icon: Users,
              color: 'blue',
            },
            {
              title: 'Verified Users',
              value: stats.verified,
              icon: UserCheck,
              color: 'green',
            },
            {
              title: 'Pending Approval',
              value: stats.pending,
              icon: UserX,
              color: 'yellow',
            },
            {
              title: 'Administrators',
              value: stats.admins,
              icon: Shield,
              color: 'purple',
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
              <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                <div className="md:col-span-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search users..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
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

                {/* Ward filter - only show if user has access to multiple wards */}
                {accessibleWards.length > 1 && (
                  <Select value={selectedWard} onValueChange={setSelectedWard}>
                    <SelectTrigger className="border-gray-200 focus:border-blue-500 focus:ring-blue-500">
                      <SelectValue placeholder="All Wards" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Wards</SelectItem>
                      {availableWards.map((ward) => (
                        <SelectItem key={ward.id} value={ward.id}>
                          {ward.name}
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
                    <SelectItem value="member">Members</SelectItem>
                    {canManageAllUsers && (
                      <>
                        <SelectItem value="wardAdmin">Ward Admins</SelectItem>
                        <SelectItem value="zonalAdmin">Zonal Admins</SelectItem>
                        <SelectItem value="superAdmin">Super Admins</SelectItem>
                      </>
                    )}
                    {user?.role === 'zonalAdmin' && (
                      <SelectItem value="wardAdmin">Ward Admins</SelectItem>
                    )}
                  </SelectContent>
                </Select>

                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger className="border-gray-200 focus:border-blue-500 focus:ring-blue-500">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="verified">Verified</SelectItem>
                    <SelectItem value="unverified">Unverified</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Users Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-600" />
                Users ({filteredUsers.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border border-gray-200">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="font-semibold">User</TableHead>
                      <TableHead className="font-semibold">Role</TableHead>
                      <TableHead className="font-semibold">Location</TableHead>
                      <TableHead className="font-semibold">Status</TableHead>
                      <TableHead className="font-semibold">Joined</TableHead>
                      <TableHead className="text-right font-semibold">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-12">
                          <div className="text-gray-500">
                            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p className="text-lg font-medium mb-2">No users found</p>
                            <p className="text-sm">No users match your current search criteria</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredUsers.map((userData) => (
                        <TableRow key={userData.id} className="hover:bg-gray-50 transition-colors">
                          <TableCell>
                            <div className="flex items-center space-x-3">
                              <Avatar className="h-10 w-10 border-2 border-gray-200">
                                <AvatarFallback className="bg-blue-100 text-blue-700 font-semibold">
                                  {userData.name?.charAt(0).toUpperCase() || 'U'}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="font-medium text-gray-900">{userData.name || 'No Name'}</div>
                                <div className="text-sm text-gray-500 flex items-center gap-1">
                                  <Mail className="w-3 h-3" />
                                  {userData.email}
                                </div>
                                {userData.phone && (
                                  <div className="text-sm text-gray-500 flex items-center gap-1">
                                    <Phone className="w-3 h-3" />
                                    {userData.phone}
                                  </div>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={getRoleBadgeColor(userData.role)}>
                              {userData.role === 'superAdmin' && (
                                <>
                                  <Shield className="w-3 h-3 mr-1" />
                                  Super Admin
                                </>
                              )}
                              {userData.role === 'zonalAdmin' && (
                                <>
                                  <MapPin className="w-3 h-3 mr-1" />
                                  Zonal Admin
                                </>
                              )}
                              {userData.role === 'wardAdmin' && (
                                <>
                                  <Building2 className="w-3 h-3 mr-1" />
                                  Ward Admin
                                </>
                              )}
                              {userData.role === 'member' && (
                                <>
                                  <Users className="w-3 h-3 mr-1" />
                                  Member
                                </>
                              )}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              {userData.zoneName && (
                                <div className="flex items-center text-sm text-gray-700">
                                  <MapPin className="w-3 h-3 mr-1 text-gray-400" />
                                  {userData.zoneName}
                                </div>
                              )}
                              {userData.wardName && (
                                <div className="flex items-center text-sm text-gray-500">
                                  <Building2 className="w-3 h-3 mr-1 text-gray-400" />
                                  {userData.wardName}
                                </div>
                              )}
                              {userData.idNumber && (
                                <div className="flex items-center text-xs text-gray-400">
                                  <IdCard className="w-3 h-3 mr-1" />
                                  {userData.idNumber}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(userData.verified)}
                          </TableCell>
                          <TableCell className="text-sm text-gray-500">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {userData.createdAt?.toLocaleDateString() || 'Unknown'}
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
                                
                                {canPerformAction(userData, 'view') && (
                                  <DropdownMenuItem onClick={() => setSelectedUser(userData)}>
                                    <Eye className="mr-2 h-4 w-4" />
                                    View Details
                                  </DropdownMenuItem>
                                )}
                                
                                {canPerformAction(userData, 'approve') && !userData.verified && (
                                  <DropdownMenuItem 
                                    onClick={() => handleApproveUser(userData.id)}
                                    className="text-green-600"
                                  >
                                    <CheckCircle className="mr-2 h-4 w-4" />
                                    Approve User
                                  </DropdownMenuItem>
                                )}
                                
                                {canPerformAction(userData, 'remove') && (
                                  <DropdownMenuItem 
                                    onClick={() => handleRemoveUser(userData.id)}
                                    className="text-red-600"
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Remove User
                                  </DropdownMenuItem>
                                )}
                                
                                {!canPerformAction(userData, 'view') && (
                                  <DropdownMenuItem disabled>
                                    <AlertTriangle className="mr-2 h-4 w-4" />
                                    No permissions
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* User Details Dialog */}
        <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-blue-100 text-blue-700">
                    {selectedUser?.name?.charAt(0).toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                User Details - {selectedUser?.name}
              </DialogTitle>
              <DialogDescription>
                Complete information about this user
              </DialogDescription>
            </DialogHeader>
            
            {selectedUser && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600">Full Name</label>
                    <p className="text-gray-900">{selectedUser.name || 'Not provided'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Email</label>
                    <p className="text-gray-900">{selectedUser.email || 'Not provided'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Phone</label>
                    <p className="text-gray-900">{selectedUser.phone || 'Not provided'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">ID Number</label>
                    <p className="text-gray-900">{selectedUser.idNumber || 'Not provided'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Role</label>
                    <Badge className={getRoleBadgeColor(selectedUser.role)}>
                      {selectedUser.role}
                    </Badge>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Status</label>
                    <div>{getStatusBadge(selectedUser.verified)}</div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Zone</label>
                    <p className="text-gray-900">{selectedUser.zoneName || 'Not assigned'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Ward</label>
                    <p className="text-gray-900">{selectedUser.wardName || 'Not assigned'}</p>
                  </div>
                  <div className="col-span-2">
                    <label className="text-sm font-medium text-gray-600">Address</label>
                    <p className="text-gray-900">{selectedUser.address || 'Not provided'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Joined Date</label>
                    <p className="text-gray-900">
                      {selectedUser.createdAt?.toLocaleDateString() || 'Unknown'}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Last Updated</label>
                    <p className="text-gray-900">
                      {selectedUser.updatedAt?.toLocaleDateString() || 'Unknown'}
                    </p>
                  </div>
                </div>
                
                {/* Action buttons */}
                <div className="flex gap-2 pt-4 border-t">
                  {canPerformAction(selectedUser, 'approve') && !selectedUser.verified && (
                    <Button 
                      onClick={() => {
                        handleApproveUser(selectedUser.id);
                        setSelectedUser(null);
                      }}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Approve User
                    </Button>
                  )}
                  
                  {canPerformAction(selectedUser, 'remove') && (
                    <Button 
                      variant="destructive"
                      onClick={() => {
                        handleRemoveUser(selectedUser.id);
                        setSelectedUser(null);
                      }}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Remove User
                    </Button>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}