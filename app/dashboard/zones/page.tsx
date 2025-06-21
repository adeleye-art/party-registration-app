'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  MapPin, 
  Plus, 
  Edit, 
  Trash2, 
  Users, 
  Building2, 
  MoreHorizontal,
  AlertTriangle,
  Search,
  Eye,
  Filter,
  Shield,
  Lock
} from 'lucide-react';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDocs, 
  query, 
  orderBy, 
  onSnapshot,
  where,
  Timestamp,
  writeBatch,
  increment,
  getDoc
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
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

// Updated interfaces to reflect new hierarchy
interface Ward {
  id: string;
  name: string;
  description?: string;
  adminId?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

interface Zone {
  id: string;
  name: string;
  description?: string;
  wardId: string; // Zone belongs to a ward
  adminId?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

interface ZoneWithStats extends Zone {
  userCount: number;
  verifiedUsers: number;
  pendingUsers: number;
  wardName: string;
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

export default  function  ZonesPage() {
  const { user } =  useAuth();
  const [zones, setZones] = useState<ZoneWithStats[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);
  const [allUsers, setAllUsers] = useState<UserData[]>([]);
  const [filteredZones, setFilteredZones] = useState<ZoneWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWardFilter, setSelectedWardFilter] = useState<string>('all');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedZone, setSelectedZone] = useState<ZoneWithStats | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    wardId: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check user permissions
  const canCreateZones = user?.role === 'superAdmin' || user?.role === 'wardAdmin';
  const canEditAllZones = user?.role === 'superAdmin' || user?.role === 'wardAdmin';
  const isZonalAdmin = user?.role === 'zonalAdmin';
  const isWardAdmin = user?.role === 'wardAdmin';

  console.log('User role:', zones);

  useEffect(() => {
    loadData();     
  }, [user]);

  useEffect(() => {
    let filtered = zones;

    // Role-based filtering
    if (isZonalAdmin && user?.zoneId) {
      // Zonal admin can only see their assigned zone
      filtered = filtered.filter(zone => zone.id === user.zoneId);
    } else if (isWardAdmin && user?.wardId) {
      // Ward admin can only see zones under their ward
      filtered = filtered.filter(zone => zone.wardId === user.wardId);
    }

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(zone =>
        zone.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        zone.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        zone.wardName.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Ward filter (only for super admin and ward admin)
    if (selectedWardFilter !== 'all' && !isZonalAdmin) {
      filtered = filtered.filter(zone => zone.wardId === selectedWardFilter);
    }

    setFilteredZones(filtered);
  }, [zones, searchTerm, selectedWardFilter, user, isZonalAdmin, isWardAdmin]);

  const calculateUserStats = (zoneId: string) => {
    const usersInZone = allUsers.filter(user => user.zoneId === zoneId);
    const totalUsers = usersInZone.length;
    const verifiedUsers = usersInZone.filter(user => user.verified === true).length;
    const pendingUsers = usersInZone.filter(user => user.verified === false).length;

    return { totalUsers, verifiedUsers, pendingUsers };
  };

const loadData = async () => {

  // Guard: Don't load data if user is not authenticated or roles are not determined
  if (!user) {
    console.log('User not loaded yet, skipping loadData');
    return;
  }

  setLoading(true);
  try {
    console.log('Starting loadData...');
    console.log('User role:', { isZonalAdmin, isWardAdmin, user: user });

    // Load users based on user role
    let usersData = [];
    try {
      console.log('Loading users...');
      let usersQuery;
      
      if (isZonalAdmin && user?.zoneId) {
        console.log('Zonal admin query for users in zone:', user.zoneId);
        usersQuery = query(
          collection(db, 'users'),
          where('zoneId', '==', user.zoneId)
        );
      } else if (isWardAdmin && user?.wardId) {
        console.log('Ward admin query for users in ward:', user.wardId);
        usersQuery = query(
          collection(db, 'users'),
          where('wardId', '==', user.wardId)
        );
      } else {
        console.log('Super admin query for all users');
        usersQuery = query(collection(db, 'users'));
      }
      
      const usersSnapshot = await getDocs(usersQuery);
      console.log('Users snapshot:', usersSnapshot);
      console.log('Users loaded successfully:', usersSnapshot.docs.length);
      
      usersData = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      })) as UserData[];
      
      setAllUsers(usersData);
    } catch (error) {
      console.error('Error loading users:', error);
      throw error; // Re-throw to stop execution
    }

    // Load wards based on user role
    let wardsData: Ward[] = [];
    try {
      console.log('Loading wards...');
      let wardsQuery;
      
      if (isWardAdmin && user?.wardId) {
        console.log('Ward admin query for ward:', user.wardId);
        wardsQuery = query(
          collection(db, 'wards'),
          where('__name__', '==', user.wardId)
        );
      } else if (isZonalAdmin && user?.zoneId) {
        console.log('Zonal admin - first getting zone to find ward...');
        // First, get the zone to find which ward it belongs to
        const zoneDocSnap = await getDoc(doc(db, 'zones', user.zoneId));
        if (zoneDocSnap.exists() && zoneDocSnap.data().wardId) {
          console.log('Zone found, ward ID:', zoneDocSnap.data().wardId);
          wardsQuery = query(
            collection(db, 'wards'),
            where('__name__', '==', zoneDocSnap.data().wardId)
          );
        } else {
          console.log('Zone not found or has no wardId');
          setWards([]);
          wardsQuery = null;
        }
      } else {
        console.log('Super admin query for all wards');
        wardsQuery = query(collection(db, 'wards'), orderBy('createdAt', 'desc'));
      }
      
      if (wardsQuery) {
        const wardsSnapshot = await getDocs(wardsQuery);
        console.log('Wards loaded successfully:', wardsSnapshot.docs.length);
        
        wardsData = wardsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate() || new Date(),
          updatedAt: doc.data().updatedAt?.toDate() || new Date(),
        })) as Ward[];
      }

      setWards(wardsData);
    } catch (error) {
      console.error('Error loading wards:', error);
      throw error; // Re-throw to stop execution
    }

    // Load zones based on user role
    try {
      console.log('Loading zones...');
      let zonesQuery;
      
      if (isZonalAdmin && user?.zoneId) {
        console.log('Zonal admin query for zone:', user.zoneId);
        zonesQuery = query(
          collection(db, 'zones'),
          where('__name__', '==', user.zoneId)
        );
      } else if (isWardAdmin && user?.wardId) {
        console.log('Ward admin query for zones in ward:', user.wardId);
        zonesQuery = query(
          collection(db, 'zones'),
          where('wardId', '==', user.wardId),
          orderBy('createdAt', 'desc')
        );
      } else {
        console.log('Super admin query for all zones');
        zonesQuery = query(collection(db, 'zones'), orderBy('createdAt', 'desc'));
      }
      
      const zonesSnapshot = await getDocs(zonesQuery);
      console.log('Zones loaded successfully:', zonesSnapshot.docs);
      
      const zonesData = zonesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
      })) as Zone[];

      // Calculate statistics for each zone
      const zonesWithStats = zonesData.map(zone => {
        const parentWard = wardsData.find(ward => ward.id === zone.wardId);
        const stats = calculateUserStats(zone.id);
        
        return {
          ...zone,
          wardName: parentWard?.name || 'Unknown Ward',
          userCount: stats.totalUsers,
          verifiedUsers: stats.verifiedUsers,
          pendingUsers: stats.pendingUsers,
        } as ZoneWithStats;
      });

      setZones(zonesWithStats);
      setFilteredZones(zonesWithStats);
      console.log('All data loaded successfully');
    } catch (error) {
      console.error('Error loading zones:', error);
      throw error; // Re-throw to stop execution
    }
    
  } catch (error) {
    console.error('Error loading data:', error);
  } finally {
    setLoading(false);
  }
};

  const handleCreateZone = async () => {
    if (!formData.name.trim() || !formData.wardId || !user) return;

    setIsSubmitting(true);
    try {
      const zoneData = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        wardId: formData.wardId,
        adminId: null, // Will be assigned later
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        createdBy: user.id,
      };

      const zoneRef = await addDoc(collection(db, 'zones'), zoneData);

      // Update ward's zone count
      const wardRef = doc(db, 'wards', formData.wardId);
      await updateDoc(wardRef, {
        zoneCount: increment(1),
        updatedAt: Timestamp.now(),
      });

      // Reload data to get updated statistics
      await loadData();

      setFormData({ name: '', description: '', wardId: '' });
      setIsCreateDialogOpen(false);
    } catch (error) {
      console.error('Error creating zone:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditZone = async () => {
    if (!selectedZone || !formData.name.trim() || !formData.wardId) return;

    setIsSubmitting(true);
    try {
      const batch = writeBatch(db);
      
      const zoneRef = doc(db, 'zones', selectedZone.id);
      batch.update(zoneRef, {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        wardId: formData.wardId,
        updatedAt: Timestamp.now(),
      });

      // If ward changed, update zone counts
      if (selectedZone.wardId !== formData.wardId) {
        // Decrease old ward's zone count
        const oldWardRef = doc(db, 'wards', selectedZone.wardId);
        batch.update(oldWardRef, {
          zoneCount: increment(-1),
          updatedAt: Timestamp.now(),
        });

        // Increase new ward's zone count
        const newWardRef = doc(db, 'wards', formData.wardId);
        batch.update(newWardRef, {
          zoneCount: increment(1),
          updatedAt: Timestamp.now(),
        });
      }

      await batch.commit();

      // Reload data to get updated statistics
      await loadData();

      setFormData({ name: '', description: '', wardId: '' });
      setSelectedZone(null);
      setIsEditDialogOpen(false);
    } catch (error) {
      console.error('Error updating zone:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteZone = async (zoneId: string) => {
    const zone = zones.find(z => z.id === zoneId);
    if (!zone) return;

    setIsSubmitting(true);
    try {
      const batch = writeBatch(db);

      // Delete the zone
      const zoneRef = doc(db, 'zones', zoneId);
      batch.delete(zoneRef);

      // Update ward's zone count
      const wardRef = doc(db, 'wards', zone.wardId);
      batch.update(wardRef, {
        zoneCount: increment(-1),
        updatedAt: Timestamp.now(),
      });

      // Update users in this zone to remove zoneId
      const usersInZone = allUsers.filter(user => user.zoneId === zoneId);
      usersInZone.forEach(user => {
        const userRef = doc(db, 'users', user.id);
        batch.update(userRef, {
          zoneId: null,
          updatedAt: Timestamp.now(),
        });
      });

      await batch.commit();

      // Reload data to get updated statistics
      await loadData();
    } catch (error) {
      console.error('Error deleting zone:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const canEditZone = (zone: ZoneWithStats) => {
    if (user?.role === 'superAdmin') return true;
    if (user?.role === 'wardAdmin' && zone.wardId === user.wardId) return true;
    if (user?.role === 'zonalAdmin' && zone.id === user.zoneId) return true;
    return false;
  };

  const canDeleteZone = (zone: ZoneWithStats) => {
    if (user?.role === 'superAdmin') return true;
    if (user?.role === 'wardAdmin' && zone.wardId === user.wardId) return true;
    return false; // Zonal admins cannot delete zones
  };

  const openEditDialog = (zone: ZoneWithStats) => {
    setSelectedZone(zone);
    setFormData({
      name: zone.name,
      description: zone.description || '',
      wardId: zone.wardId,
    });
    setIsEditDialogOpen(true);
  };

  const openCreateDialog = () => {
    // Pre-select ward for ward admin
    const defaultWardId = isWardAdmin && user?.wardId ? user.wardId : '';
    setFormData({ name: '', description: '', wardId: defaultWardId });
    setIsCreateDialogOpen(true);
  };

  // Get available wards for selection based on user role
  const getAvailableWards = () => {
    if (isWardAdmin && user?.wardId) {
      return wards.filter(ward => ward.id === user.wardId);
    }
    return wards;
  };

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

  const totalStats = {
    totalZones: zones.length,
    totalUsers: zones.reduce((sum, zone) => sum + zone.userCount, 0),
    totalWards: wards.length,
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Zone Management</h1>
            <p className="text-gray-600 mt-1">
              {isZonalAdmin 
                ? 'Manage your assigned zone and view user statistics'
                : isWardAdmin
                ? 'Manage zones under your ward with real-time user statistics'
                : 'Manage zones under wards with real-time user statistics'
              }
            </p>
          </div>
          {canCreateZones && (
            <Button onClick={openCreateDialog} disabled={isSubmitting}>
              <Plus className="w-4 h-4 mr-2" />
              Create Zone
            </Button>
          )}
        </motion.div>

        {/* Role-based access notice */}
        {isZonalAdmin && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Alert>
              <Shield className="h-4 w-4" />
              <AlertDescription>
                As a Zonal Administrator, you can view and manage only your assigned zone. 
                You cannot create new zones.
              </AlertDescription>
            </Alert>
          </motion.div>
        )}

        {isWardAdmin && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Alert>
              <Building2 className="h-4 w-4" />
              <AlertDescription>
                As a Ward Administrator, you can view and manage all zones under your ward, 
                and create new zones within your ward.
              </AlertDescription>
            </Alert>
          </motion.div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              title: isZonalAdmin ? 'Your Zone' : 'Total Zones',
              value: totalStats.totalZones,
              icon: MapPin,
              color: 'blue',
              description: isZonalAdmin ? 'Zone assigned to you' : 'Zones under wards',
            },
            {
              title: 'Total Users',
              value: totalStats.totalUsers,
              icon: Users,
              color: 'green',
              description: isZonalAdmin ? 'In your zone' : 'Across all zones',
            },
            {
              title: isZonalAdmin ? 'Parent Ward' : 'Parent Wards',
              value: totalStats.totalWards,
              icon: Building2,
              color: 'purple',
              description: isZonalAdmin ? 'Your zone\'s ward' : 'Available wards',
            },
          ].map((stat, index) => (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card>
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
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Search & Filter
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search zones..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                
                {!isZonalAdmin && (
                  <Select value={selectedWardFilter} onValueChange={setSelectedWardFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Filter by Ward" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Wards</SelectItem>
                      {getAvailableWards().map((ward) => (
                        <SelectItem key={ward.id} value={ward.id}>
                          {ward.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Zones Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>
                {isZonalAdmin ? 'Your Zone' : `Zones (${filteredZones.length})`}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredZones.length === 0 ? (
                <div className="text-center py-8">
                  <MapPin className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-semibold text-gray-900">
                    {isZonalAdmin ? 'No zone assigned' : 'No zones found'}
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {isZonalAdmin 
                      ? 'You have not been assigned to any zone yet.'
                      : searchTerm || selectedWardFilter !== 'all' 
                      ? 'Try adjusting your search or filter criteria.' 
                      : 'Get started by creating your first zone under a ward.'}
                  </p>
                  {!searchTerm && selectedWardFilter === 'all' && canCreateZones && (
                    <div className="mt-6">
                      <Button onClick={openCreateDialog}>
                        <Plus className="w-4 h-4 mr-2" />
                        Create Zone
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Zone Name</TableHead>
                        <TableHead>Parent Ward</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Users</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredZones.map((zone) => (
                        <TableRow key={zone.id}>
                          <TableCell>
                            <div className="flex items-center space-x-3">
                              <div className="p-2 bg-blue-50 rounded-lg">
                                <MapPin className="h-4 w-4 text-blue-600" />
                              </div>
                              <div>
                                <div className="font-medium">{zone.name}</div>
                                {zone.adminId === user?.id && (
                                  <div className="text-sm text-green-600 flex items-center">
                                    <Shield className="w-3 h-3 mr-1" />
                                    Your zone
                                  </div>
                                )}
                                {zone.adminId && zone.adminId !== user?.id && (
                                  <div className="text-sm text-gray-500">
                                    Admin assigned
                                  </div>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <Building2 className="h-4 w-4 text-gray-400" />
                              <span className="text-sm font-medium">{zone.wardName}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="max-w-xs">
                              <p className="text-sm text-gray-600 truncate">
                                {zone.description || 'No description'}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="font-medium">{zone.userCount} total</div>
                              <div className="text-sm text-gray-500">
                                {zone.verifiedUsers} verified, {zone.pendingUsers} pending
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {zone.adminId ? (
                              <Badge className="bg-green-100 text-green-800">
                                Active
                              </Badge>
                            ) : (
                              <Badge className="bg-yellow-100 text-yellow-800">
                                No Admin
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-gray-500">
                            {zone.createdAt.toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" disabled={isSubmitting}>
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                
                                {/* View Details */}
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                      <Eye className="mr-2 h-4 w-4" />
                                      View Details
                                    </DropdownMenuItem>
                                  </DialogTrigger>
                                  <DialogContent className="max-w-2xl">
                                    <DialogHeader>
                                      <DialogTitle>Zone Details</DialogTitle>
                                      <DialogDescription>
                                        Complete information for {zone.name}
                                      </DialogDescription>
                                    </DialogHeader>
                                    <div className="grid grid-cols-2 gap-6 py-4">
                                      <div className="space-y-4">
                                        <div>
                                          <label className="text-sm font-medium">Zone Name</label>
                                          <p className="text-sm text-gray-600">{zone.name}</p>
                                        </div>
                                        <div>
                                          <label className="text-sm font-medium">Parent Ward</label>
                                          <p className="text-sm text-gray-600">{zone.wardName}</p>
                                        </div>
                                        <div>
                                          <label className="text-sm font-medium">Description</label>
                                          <p className="text-sm text-gray-600">
                                            {zone.description || 'No description provided'}
                                          </p>
                                        </div>
                                        <div>
                                          <label className="text-sm font-medium">Created</label>
                                          <p className="text-sm text-gray-600">
                                            {zone.createdAt.toLocaleDateString()}
                                          </p>
                                        </div>
                                      </div>
                                      <div className="space-y-4">
                                        <div>
                                          <label className="text-sm font-medium">Total Users</label>
                                          <p className="text-2xl font-bold text-blue-600">
                                            {zone.userCount}
                                          </p>
                                        </div>
                                        <div>
                                          <label className="text-sm font-medium">Verified Users</label>
                                          <p className="text-lg font-semibold text-green-600">
                                            {zone.verifiedUsers}
                                          </p>
                                        </div>
                                        <div>
                                          <label className="text-sm font-medium">Pending Users</label>
                                          <p className="text-lg font-semibold text-yellow-600">
                                            {zone.pendingUsers}
                                          </p>
                                        </div>
                                        <div>
                                          <label className="text-sm font-medium">Admin Status</label>
                                          <p className="text-sm text-gray-600">
                                            {zone.adminId === user?.id 
                                              ? 'You are the admin' 
                                              : zone.adminId 
                                              ? 'Admin assigned' 
                                              : 'No admin assigned'}
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                  </DialogContent>
                                </Dialog>

                                {canEditZone(zone) && (
                                  <DropdownMenuItem onClick={() => openEditDialog(zone)}>
                                    <Edit className="mr-2 h-4 w-4" />
                                    Edit Zone
                                  </DropdownMenuItem>
                                )}

                                {!canEditZone(zone) && (
                                  <DropdownMenuItem disabled>
                                    <Lock className="mr-2 h-4 w-4" />
                                    Edit Zone (No Permission)
                                  </DropdownMenuItem>
                                )}
                                
                                {canDeleteZone(zone) && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <DropdownMenuItem 
                                          className="text-red-600"
                                          onSelect={(e) => e.preventDefault()}
                                        >
                                          <Trash2 className="mr-2 h-4 w-4" />
                                          Delete Zone
                                        </DropdownMenuItem>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle className="flex items-center gap-2">
                                            <AlertTriangle className="h-5 w-5 text-red-600" />
                                            Delete Zone
                                          </AlertDialogTitle>
                                          <AlertDialogDescription>
                                            Are you sure you want to delete &quot;{zone.name}&quot;? 
                                            {zone.userCount > 0 && (
                                              <span className="block mt-2 text-red-600 font-medium">
                                                Warning: This zone contains {zone.userCount} users. 
                                                All users will have their zone assignment removed.
                                              </span>
                                            )}
                                            This action cannot be undone.
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                                          <AlertDialogAction
                                            onClick={() => handleDeleteZone(zone.id)}
                                            className="bg-red-600 hover:bg-red-700"
                                            disabled={isSubmitting}
                                          >
                                            {isSubmitting ? 'Deleting...' : 'Delete Zone'}
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

        {/* Create Zone Dialog */}
        {canCreateZones && (
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Zone</DialogTitle>
                <DialogDescription>
                  Add a new zone under a ward. Zones help organize users within wards.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="parentWard">Parent Ward *</Label>
                  <Select 
                    value={formData.wardId} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, wardId: value }))}
                    disabled={isSubmitting || (isWardAdmin && Boolean(user?.wardId))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a ward" />
                    </SelectTrigger>
                    <SelectContent>
                      {getAvailableWards().map((ward) => (
                        <SelectItem key={ward.id} value={ward.id}>
                          {ward.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {isWardAdmin && user?.wardId && (
                    <p className="text-xs text-gray-500">
                      As a ward admin, you can only create zones under your ward.
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="zoneName">Zone Name *</Label>
                  <Input
                    id="zoneName"
                    placeholder="e.g., Central Business District"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="zoneDescription">Description (Optional)</Label>
                  <Textarea
                    id="zoneDescription"
                    placeholder="Brief description of the zone..."
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    disabled={isSubmitting}
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
                  onClick={handleCreateZone} 
                  disabled={!formData.name.trim() || !formData.wardId || isSubmitting}
                >
                  {isSubmitting ? 'Creating...' : 'Create Zone'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* Edit Zone Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Zone</DialogTitle>
              <DialogDescription>
                Update the zone information and ward assignment.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="editParentWard">Parent Ward *</Label>
                <Select 
                  value={formData.wardId} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, wardId: value }))}
                  disabled={isSubmitting || (isWardAdmin && !!user?.wardId)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a ward" />
                  </SelectTrigger>
                  <SelectContent>
                    {getAvailableWards().map((ward) => (
                      <SelectItem key={ward.id} value={ward.id}>
                        {ward.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isWardAdmin && user?.wardId && (
                  <p className="text-xs text-gray-500">
                    As a ward admin, you can only assign zones to your ward.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="editZoneName">Zone Name *</Label>
                <Input
                  id="editZoneName"
                  placeholder="e.g., Central Business District"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editZoneDescription">Description (Optional)</Label>
                <Textarea
                  id="editZoneDescription"
                  placeholder="Brief description of the zone..."
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  disabled={isSubmitting}
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
                onClick={handleEditZone} 
                disabled={!formData.name.trim() || !formData.wardId || isSubmitting}
              >
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}