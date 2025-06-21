'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Building2, 
  Plus, 
  Edit, 
  Trash2, 
  Users, 
  MapPin, 
  MoreHorizontal,
  AlertTriangle,
  Search,
  Eye,
  Filter,
  Shield,
  Lock,
  RefreshCw
} from 'lucide-react';
import { 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  where, 
  orderBy,
  writeBatch,
  serverTimestamp,
  onSnapshot
} from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { db } from '@/lib/firebase';
import { toast } from '@/hooks/use-toast';

interface LocalGovt {
  id: string;
  name: string;
  state?: string;
  createdAt?: Date;
}

interface Ward {
  id: string;
  name: string;
  description?: string;
  localGovtId: string;
  localGovtName?: string;
  adminId?: string;
  adminName?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

interface WardWithStats extends Ward {
  userCount: number;
  verifiedUsers: number;
  pendingUsers: number;
  zoneCount: number;
}

interface UserData {
  id: string;
  wardId?: string;
  zoneId?: string;
  verified: boolean;
  role: string;
  name: string;
  email: string;
  phone?: string;
  dob?: string;
  idNumber?: string;
  idType?: string;
  localGovt?: string;
  occupation?: string;
  qualification?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export default function WardsPage() {
  const { user } = useAuth();
  const [wards, setWards] = useState<WardWithStats[]>([]);
  const [localGovts, setLocalGovts] = useState<LocalGovt[]>([]);
  const [allUsers, setAllUsers] = useState<UserData[]>([]);
  const [filteredWards, setFilteredWards] = useState<WardWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLocalGovt, setSelectedLocalGovt] = useState<string>('all');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedWard, setSelectedWard] = useState<WardWithStats | null>(null);
  const [wardFormData, setWardFormData] = useState({
    name: '',
    description: '',
    localGovtId: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Role-based permissions
  const isSuperAdmin = user?.role === 'superAdmin';
  const isWardAdmin = user?.role === 'wardAdmin';
  const isZonalAdmin = user?.role === 'zonalAdmin';

  // Check permissions
  const canCreateWards = isSuperAdmin;
  const canEditAllWards = isSuperAdmin;
  const canDeleteWards = isSuperAdmin;

  const canEditWard = (ward: WardWithStats) => {
    if (isSuperAdmin) return true;
    if (isWardAdmin && ward.id === user?.wardId) return true;
    return false;
  };

  const canViewWard = (ward: WardWithStats) => {
    if (isSuperAdmin) return true;
    if (isWardAdmin && ward.id === user?.wardId) return true;
    if (isZonalAdmin) {
      // Zonal admin can view their ward
      return ward.id === user?.wardId;
    }
    return false;
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    let filtered = wards;

    // Role-based filtering
    if (isWardAdmin && user?.wardId) {
      // Ward admin can only see their ward
      filtered = filtered.filter(ward => ward.id === user.wardId);
    } else if (isZonalAdmin && user?.wardId) {
      // Zonal admin can only see their ward
      filtered = filtered.filter(ward => ward.id === user.wardId);
    }

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(ward =>
        ward.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ward.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ward.localGovtName?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Local Government filter
    if (selectedLocalGovt !== 'all') {
      filtered = filtered.filter(ward => ward.localGovtId === selectedLocalGovt);
    }

    setFilteredWards(filtered);
  }, [wards, searchTerm, selectedLocalGovt, user, isWardAdmin, isZonalAdmin]);

  const calculateUserStats = (wardId: string) => {
    const usersInWard = allUsers.filter(user => user.wardId === wardId);
    const totalUsers = usersInWard.length;
    const verifiedUsers = usersInWard.filter(user => user.verified === true).length;
    const pendingUsers = usersInWard.filter(user => user.verified === false).length;

    return { totalUsers, verifiedUsers, pendingUsers };
  };

  const calculateZoneCount = async (wardId: string) => {
    try {
      const zonesSnapshot = await getDocs(
        query(collection(db, 'zones'), where('wardId', '==', wardId))
      );
      return zonesSnapshot.docs.length;
    } catch (error) {
      console.error('Error counting zones:', error);
      return 0;
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      // Load local governments
      console.log('Loading local governments...');
      const localGovtsSnapshot = await getDocs(
        query(collection(db, 'localGovt'), orderBy('name'))
      );
      const localGovtsData = localGovtsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
      })) as LocalGovt[];
      
      console.log('Loaded local governments:', localGovtsData.length);
      setLocalGovts(localGovtsData);

      // Load all users first
      console.log('Loading users...');
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const usersData = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      })) as UserData[];
      
      console.log('Loaded users:', usersData.length);
      setAllUsers(usersData);

      // Load wards based on user role
      let wardsQuery;
      if (isWardAdmin && user?.wardId) {
        // Ward admin can only see their ward
        wardsQuery = query(
          collection(db, 'wards'),
          where('__name__', '==', user.wardId)
        );
      } else if (isZonalAdmin && user?.wardId) {
        // Zonal admin can only see their ward
        wardsQuery = query(
          collection(db, 'wards'),
          where('__name__', '==', user.wardId)
        );
      } else {
        // Super admin can see all wards
        wardsQuery = query(collection(db, 'wards'), orderBy('createdAt', 'desc'));
      }
      
      const wardsSnapshot = await getDocs(wardsQuery);
      const wardsData = await Promise.all(
        wardsSnapshot.docs.map(async (wardDoc) => {
          const wardData = {
            id: wardDoc.id,
            ...wardDoc.data(),
            createdAt: wardDoc.data().createdAt?.toDate() || new Date(),
            updatedAt: wardDoc.data().updatedAt?.toDate() || new Date(),
          } as Ward;

          // Get local government name
          const localGovt = localGovtsData.find(lg => lg.id === wardData.localGovtId);
          
          // Calculate user stats for this ward
          const wardStats = calculateUserStats(wardDoc.id);
          
          // Calculate zone count for this ward
          const zoneCount = await calculateZoneCount(wardDoc.id);

          // Get admin name if assigned
          let adminName = '';
          if (wardData.adminId) {
            const adminUser = usersData.find(u => u.id === wardData.adminId);
            adminName = adminUser?.name || 'Unknown Admin';
          }

          return {
            ...wardData,
            localGovtName: localGovt?.name || 'Unknown Local Government',
            adminName,
            userCount: wardStats.totalUsers,
            verifiedUsers: wardStats.verifiedUsers,
            pendingUsers: wardStats.pendingUsers,
            zoneCount,
          } as WardWithStats;
        })
      );

      console.log('Loaded wards with stats:', wardsData);
      setWards(wardsData);
      setFilteredWards(wardsData);

    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Error",
        description: "Failed to load ward data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateWard = async () => {
    if (!wardFormData.name.trim() || !wardFormData.localGovtId) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const wardData = {
        name: wardFormData.name.trim(),
        description: wardFormData.description.trim() || null,
        localGovtId: wardFormData.localGovtId,
        adminId: null, // Will be assigned later
        createdBy: user?.id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await addDoc(collection(db, 'wards'), wardData);

      toast({
        title: "Success",
        description: "Ward created successfully.",
      });

      setWardFormData({ name: '', description: '', localGovtId: '' });
      setIsCreateDialogOpen(false);
      await loadData();
    } catch (error) {
      console.error('Error creating ward:', error);
      toast({
        title: "Error",
        description: "Failed to create ward. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditWard = async () => {
    if (!selectedWard || !wardFormData.name.trim() || !wardFormData.localGovtId) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await updateDoc(doc(db, 'wards', selectedWard.id), {
        name: wardFormData.name.trim(),
        description: wardFormData.description.trim() || null,
        localGovtId: wardFormData.localGovtId,
        updatedAt: serverTimestamp(),
      });

      toast({
        title: "Success",
        description: "Ward updated successfully.",
      });

      setWardFormData({ name: '', description: '', localGovtId: '' });
      setSelectedWard(null);
      setIsEditDialogOpen(false);
      await loadData();
    } catch (error) {
      console.error('Error updating ward:', error);
      toast({
        title: "Error",
        description: "Failed to update ward. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteWard = async (wardId: string) => {
    const ward = wards.find(w => w.id === wardId);
    if (!ward) return;

    setIsSubmitting(true);
    try {
      const batch = writeBatch(db);

      // Delete all zones in this ward
      const zonesSnapshot = await getDocs(
        query(collection(db, 'zones'), where('wardId', '==', wardId))
      );
      
      zonesSnapshot.docs.forEach((zoneDoc) => {
        batch.delete(doc(db, 'zones', zoneDoc.id));
      });

      // Update users in this ward to remove wardId
      const usersInWard = allUsers.filter(user => user.wardId === wardId);
      usersInWard.forEach(user => {
        const userRef = doc(db, 'users', user.id);
        batch.update(userRef, {
          wardId: null,
          zoneId: null, // Also remove zone assignment
          updatedAt: serverTimestamp(),
        });
      });

      // Delete the ward
      batch.delete(doc(db, 'wards', wardId));

      await batch.commit();

      toast({
        title: "Success",
        description: "Ward and related data deleted successfully.",
      });

      await loadData();
    } catch (error) {
      console.error('Error deleting ward:', error);
      toast({
        title: "Error",
        description: "Failed to delete ward. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditDialog = (ward: WardWithStats) => {
    if (!canEditWard(ward)) {
      toast({
        title: "Error",
        description: "You don't have permission to edit this ward.",
        variant: "destructive",
      });
      return;
    }

    setSelectedWard(ward);
    setWardFormData({
      name: ward.name,
      description: ward.description || '',
      localGovtId: ward.localGovtId,
    });
    setIsEditDialogOpen(true);
  };

  const openCreateDialog = () => {
    if (!canCreateWards) {
      toast({
        title: "Error",
        description: "You don't have permission to create wards.",
        variant: "destructive",
      });
      return;
    }

    setWardFormData({ name: '', description: '', localGovtId: '' });
    setIsCreateDialogOpen(true);
  };

  // Get available local governments for filtering (based on user's access)
  const getAvailableLocalGovts = () => {
    if (isSuperAdmin) {
      return localGovts; // Super admin can see all
    }
    
    // For ward/zonal admins, filter based on their ward's local government
    const userWards = wards.filter(ward => 
      (isWardAdmin && ward.id === user?.wardId) ||
      (isZonalAdmin && ward.id === user?.wardId)
    );
    
    const userLocalGovtIds = userWards.map(ward => ward.localGovtId);
    return localGovts.filter(lg => userLocalGovtIds.includes(lg.id));
  };

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

  const totalStats = {
    totalWards: wards.length,
    totalUsers: wards.reduce((sum, ward) => sum + ward.userCount, 0),
    verifiedUsers: wards.reduce((sum, ward) => sum + ward.verifiedUsers, 0),
    totalZones: wards.reduce((sum, ward) => sum + ward.zoneCount, 0),
  };

  // Role-based title and description
  const getRoleBasedTitle = () => {
    if (isSuperAdmin) {
      return 'Ward Management - System Wide';
    }
    if (isWardAdmin) {
      const wardName = wards.find(w => w.id === user?.wardId)?.name || 'Ward';
      return `Ward Management - ${wardName}`;
    }
    if (isZonalAdmin) {
      const wardName = wards.find(w => w.id === user?.wardId)?.name || 'Ward';
      return `Ward Information - ${wardName}`;
    }
    return 'Ward Management';
  };

  const getRoleBasedDescription = () => {
    if (isSuperAdmin) {
      return 'Manage wards across all local governments with real-time user statistics';
    }
    if (isWardAdmin) {
      return 'Manage your ward and view user statistics within your jurisdiction';
    }
    if (isZonalAdmin) {
      return 'View information about your ward and its statistics';
    }
    return 'Manage wards and view statistics';
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Role-based access notice */}
        {!isSuperAdmin && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Alert className="border-blue-200 bg-blue-50">
              <Shield className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                {isWardAdmin && 'As a Ward Administrator, you can view and manage your assigned ward.'}
                {isZonalAdmin && 'As a Zonal Administrator, you can view information about your ward but cannot make changes.'}
              </AlertDescription>
            </Alert>
          </motion.div>
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
              onClick={loadData}
              disabled={loading}
              className="border-gray-200 hover:bg-gray-50"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            {canCreateWards && (
              <Button onClick={openCreateDialog} disabled={isSubmitting}>
                <Plus className="w-4 h-4 mr-2" />
                Create Ward
              </Button>
            )}
          </div>
        </motion.div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[
            {
              title: isSuperAdmin ? 'Total Wards' : isWardAdmin ? 'Your Ward' : 'Ward',
              value: totalStats.totalWards,
              icon: Building2,
              color: 'blue',
              description: isSuperAdmin ? 'Primary divisions' : 'Administrative division',
            },
            {
              title: 'Total Users',
              value: totalStats.totalUsers,
              icon: Users,
              color: 'green',
              description: isSuperAdmin ? 'All registered' : 'In your ward',
            },
            {
              title: 'Verified Users',
              value: totalStats.verifiedUsers,
              icon: Users,
              color: 'emerald',
              description: 'Approved members',
            },
            {
              title: 'Total Zones',
              value: totalStats.totalZones,
              icon: MapPin,
              color: 'purple',
              description: 'Under wards',
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
                      <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                      <p className="text-xs text-gray-500 mt-1">{stat.description}</p>
                    </div>
                    <div className={`p-3 bg-${stat.color}-50 rounded-full`}>
                      <stat.icon className={`h-5 w-5 text-${stat.color}-600`} />
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search wards..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                
                {/* Local Government filter - only show if user has access to multiple local governments */}
                {getAvailableLocalGovts().length > 1 && (
                  <Select value={selectedLocalGovt} onValueChange={setSelectedLocalGovt}>
                    <SelectTrigger className="border-gray-200 focus:border-blue-500 focus:ring-blue-500">
                      <SelectValue placeholder="Filter by Local Government" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Local Governments</SelectItem>
                      {getAvailableLocalGovts().map((localGovt) => (
                        <SelectItem key={localGovt.id} value={localGovt.id}>
                          {localGovt.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Wards Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-blue-600" />
                {isSuperAdmin ? `Wards (${filteredWards.length})` : isWardAdmin ? 'Your Ward' : 'Ward Information'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredWards.length === 0 ? (
                <div className="text-center py-12">
                  <Building2 className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    {isWardAdmin || isZonalAdmin ? 'No ward assigned' : 'No wards found'}
                  </h3>
                  <p className="text-gray-500 mb-4">
                    {isWardAdmin || isZonalAdmin
                      ? 'You have not been assigned to any ward yet.'
                      : searchTerm || selectedLocalGovt !== 'all'
                      ? 'Try adjusting your search or filter criteria.'
                      : 'No wards have been created yet.'}
                  </p>
                  {!searchTerm && selectedLocalGovt === 'all' && canCreateWards && (
                    <Button onClick={openCreateDialog} className="bg-blue-600 hover:bg-blue-700">
                      <Plus className="w-4 h-4 mr-2" />
                      Create Ward
                    </Button>
                  )}
                </div>
              ) : (
                <div className="rounded-md border border-gray-200">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="font-semibold">Ward Name</TableHead>
                        <TableHead className="font-semibold">Local Government</TableHead>
                        <TableHead className="font-semibold">Description</TableHead>
                        <TableHead className="font-semibold">Users</TableHead>
                        <TableHead className="font-semibold">Zones</TableHead>
                        <TableHead className="font-semibold">Status</TableHead>
                        <TableHead className="font-semibold">Created</TableHead>
                        <TableHead className="text-right font-semibold">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredWards.map((ward) => (
                        <TableRow key={ward.id} className="hover:bg-gray-50 transition-colors">
                          <TableCell>
                            <div className="flex items-center space-x-3">
                              <div className="p-2 bg-blue-50 rounded-lg">
                                <Building2 className="h-4 w-4 text-blue-600" />
                              </div>
                              <div>
                                <div className="font-medium text-gray-900">{ward.name}</div>
                                {ward.adminId === user?.id && (
                                  <div className="text-sm text-green-600 flex items-center">
                                    <Shield className="w-3 h-3 mr-1" />
                                    Your ward
                                  </div>
                                )}
                                {ward.adminName && ward.adminId !== user?.id && (
                                  <div className="text-sm text-gray-500">
                                    Admin: {ward.adminName}
                                  </div>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm font-medium text-gray-700">
                              {ward.localGovtName}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="max-w-xs">
                              <p className="text-sm text-gray-600 truncate">
                                {ward.description || 'No description'}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="font-medium text-gray-900">{ward.userCount} total</div>
                              <div className="text-sm text-gray-500">
                                {ward.verifiedUsers} verified, {ward.pendingUsers} pending
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                              {ward.zoneCount} zones
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {ward.adminId ? (
                              <Badge className="bg-green-100 text-green-800 border-green-200">
                                Active
                              </Badge>
                            ) : (
                              <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">
                                No Admin
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-gray-500">
                            {ward.createdAt?.toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" disabled={isSubmitting}>
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                
                                {/* View Details */}
                                {canViewWard(ward) && (
                                  <Dialog>
                                    <DialogTrigger asChild>
                                      <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                        <Eye className="mr-2 h-4 w-4" />
                                        View Details
                                      </DropdownMenuItem>
                                    </DialogTrigger>
                                    <DialogContent className="max-w-4xl">
                                      <DialogHeader>
                                        <DialogTitle className="flex items-center gap-2">
                                          <Building2 className="h-5 w-5 text-blue-600" />
                                          Ward Details: {ward.name}
                                        </DialogTitle>
                                        <DialogDescription>
                                          Complete information for this ward
                                        </DialogDescription>
                                      </DialogHeader>
                                      <div className="grid grid-cols-2 gap-6 py-4">
                                        <div className="space-y-4">
                                          <div>
                                            <label className="text-sm font-medium text-gray-600">Ward Name</label>
                                            <p className="text-gray-900">{ward.name}</p>
                                          </div>
                                          <div>
                                            <label className="text-sm font-medium text-gray-600">Local Government</label>
                                            <p className="text-gray-900">{ward.localGovtName}</p>
                                          </div>
                                          <div>
                                            <label className="text-sm font-medium text-gray-600">Description</label>
                                            <p className="text-gray-900">
                                              {ward.description || 'No description provided'}
                                            </p>
                                          </div>
                                          <div>
                                            <label className="text-sm font-medium text-gray-600">Created</label>
                                            <p className="text-gray-900">
                                              {ward.createdAt?.toLocaleDateString()}
                                            </p>
                                          </div>
                                        </div>
                                        <div className="space-y-4">
                                          <div>
                                            <label className="text-sm font-medium text-gray-600">Total Users</label>
                                            <p className="text-2xl font-bold text-blue-600">
                                              {ward.userCount}
                                            </p>
                                          </div>
                                          <div>
                                            <label className="text-sm font-medium text-gray-600">Verified Users</label>
                                            <p className="text-lg font-semibold text-green-600">
                                              {ward.verifiedUsers}
                                            </p>
                                          </div>
                                          <div>
                                            <label className="text-sm font-medium text-gray-600">Pending Users</label>
                                            <p className="text-lg font-semibold text-yellow-600">
                                              {ward.pendingUsers}
                                            </p>
                                          </div>
                                          <div>
                                            <label className="text-sm font-medium text-gray-600">Total Zones</label>
                                            <p className="text-lg font-semibold text-purple-600">
                                              {ward.zoneCount}
                                            </p>
                                          </div>
                                        </div>
                                      </div>
                                    </DialogContent>
                                  </Dialog>
                                )}
                                
                                {canEditWard(ward) && (
                                  <DropdownMenuItem onClick={() => openEditDialog(ward)}>
                                    <Edit className="mr-2 h-4 w-4" />
                                    Edit Ward
                                  </DropdownMenuItem>
                                )}

                                {!canEditWard(ward) && !canViewWard(ward) && (
                                  <DropdownMenuItem disabled>
                                    <Lock className="mr-2 h-4 w-4" />
                                    No Permission
                                  </DropdownMenuItem>
                                )}
                                
                                {canDeleteWards && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <DropdownMenuItem 
                                          className="text-red-600"
                                          onSelect={(e) => e.preventDefault()}
                                        >
                                          <Trash2 className="mr-2 h-4 w-4" />
                                          Delete Ward
                                        </DropdownMenuItem>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle className="flex items-center gap-2">
                                            <AlertTriangle className="h-5 w-5 text-red-600" />
                                            Delete Ward
                                          </AlertDialogTitle>
                                          <AlertDialogDescription>
                                            Are you sure you want to delete &quot;{ward.name}&quot;? 
                                            {ward.userCount > 0 && (
                                              <span className="block mt-2 text-red-600 font-medium">
                                                Warning: This ward contains {ward.userCount} users and {ward.zoneCount} zones. 
                                                All associated data will be affected.
                                              </span>
                                            )}
                                            This action cannot be undone.
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                                          <AlertDialogAction
                                            onClick={() => handleDeleteWard(ward.id)}
                                            className="bg-red-600 hover:bg-red-700"
                                            disabled={isSubmitting}
                                          >
                                            {isSubmitting ? 'Deleting...' : 'Delete Ward'}
                                          </AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  </>
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

        {/* Create Ward Dialog */}
        {canCreateWards && (
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-blue-600" />
                  Create New Ward
                </DialogTitle>
                <DialogDescription>
                  Add a new ward as a primary administrative division under a local government.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="localGovt">Local Government *</Label>
                  <Select 
                    value={wardFormData.localGovtId} 
                    onValueChange={(value) => setWardFormData(prev => ({ ...prev, localGovtId: value }))}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger className="border-gray-200 focus:border-blue-500 focus:ring-blue-500">
                      <SelectValue placeholder="Select a local government" />
                    </SelectTrigger>
                    <SelectContent>
                      {localGovts.map((localGovt) => (
                        <SelectItem key={localGovt.id} value={localGovt.id}>
                          {localGovt.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {localGovts.length === 0 && (
                    <p className="text-xs text-red-500">
                      No local governments available. Please create local governments first.
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wardName">Ward Name *</Label>
                  <Input
                    id="wardName"
                    placeholder="e.g., Ward 1 - Central District"
                    value={wardFormData.name}
                    onChange={(e) => setWardFormData(prev => ({ ...prev, name: e.target.value }))}
                    disabled={isSubmitting}
                    className="border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wardDescription">Description (Optional)</Label>
                  <Textarea
                    id="wardDescription"
                    placeholder="Brief description of the ward..."
                    value={wardFormData.description}
                    onChange={(e) => setWardFormData(prev => ({ ...prev, description: e.target.value }))}
                    disabled={isSubmitting}
                    className="border-gray-200 focus:border-blue-500 focus:ring-blue-500 resize-none"
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button 
                  variant="outline" 
                  onClick={() => setIsCreateDialogOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleCreateWard} 
                  disabled={!wardFormData.name.trim() || !wardFormData.localGovtId || isSubmitting}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Ward'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* Edit Ward Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Edit className="h-5 w-5 text-blue-600" />
                Edit Ward
              </DialogTitle>
              <DialogDescription>
                Update the ward information and local government assignment.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="editLocalGovt">Local Government *</Label>
                <Select 
                  value={wardFormData.localGovtId} 
                  onValueChange={(value) => setWardFormData(prev => ({ ...prev, localGovtId: value }))}
                  disabled={isSubmitting}
                >
                  <SelectTrigger className="border-gray-200 focus:border-blue-500 focus:ring-blue-500">
                    <SelectValue placeholder="Select a local government" />
                  </SelectTrigger>
                  <SelectContent>
                    {localGovts.map((localGovt) => (
                      <SelectItem key={localGovt.id} value={localGovt.id}>
                        {localGovt.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="editWardName">Ward Name *</Label>
                <Input
                  id="editWardName"
                  placeholder="e.g., Ward 1 - Central District"
                  value={wardFormData.name}
                  onChange={(e) => setWardFormData(prev => ({ ...prev, name: e.target.value }))}
                  disabled={isSubmitting}
                  className="border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editWardDescription">Description (Optional)</Label>
                <Textarea
                  id="editWardDescription"
                  placeholder="Brief description of the ward..."
                  value={wardFormData.description}
                  onChange={(e) => setWardFormData(prev => ({ ...prev, description: e.target.value }))}
                  disabled={isSubmitting}
                  className="border-gray-200 focus:border-blue-500 focus:ring-blue-500 resize-none"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setIsEditDialogOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleEditWard} 
                disabled={!wardFormData.name.trim() || !wardFormData.localGovtId || isSubmitting}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isSubmitting ? (
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