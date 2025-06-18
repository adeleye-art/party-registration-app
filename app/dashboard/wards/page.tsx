'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
  Phone,
  Mail,
  Calendar,
  IdCard
} from 'lucide-react';
import { 
  collection, 
  doc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy,
  serverTimestamp,
  onSnapshot,
  getCountFromServer
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
import {
  Alert,
  AlertDescription,
} from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';

interface Ward {
  id: string;
  name: string;
  description?: string;
  zoneId: string;
  adminId?: string;
  createdAt: any;
  updatedAt: any;
}

interface Zone {
  id: string;
  name: string;
  description?: string;
  adminId?: string;
  createdAt: any;
  updatedAt: any;
}

interface WardWithStats extends Ward {
  userCount: number;
  verifiedUsers: number;
  pendingUsers: number;
  zoneName: string;
}

export default function WardsPage() {
  const { user } = useAuth();
  const [wards, setWards] = useState<WardWithStats[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [filteredWards, setFilteredWards] = useState<WardWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedZone, setSelectedZone] = useState<string>('all');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedWard, setSelectedWard] = useState<WardWithStats | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    zoneId: '',
  });
  const [submitting, setSubmitting] = useState(false);

  // Use refs to track if listeners are already set up
  const listenersSetup = useRef(false);
  const initialLoadComplete = useRef(false);

  // Role-based permissions
  const isSuperAdmin = user?.role === 'superAdmin';
  const isZonalAdmin = user?.role === 'zonalAdmin';
  const canManageAllZones = isSuperAdmin;
  const canCreateWards = isSuperAdmin || isZonalAdmin;

  // Get accessible zones based on user role
  const getAccessibleZones = useCallback(() => {
    if (isSuperAdmin) {
      return zones; // Super admin can see all zones
    }
    if (isZonalAdmin && user?.zoneId) {
      return zones.filter(zone => zone.id === user.zoneId); // Zonal admin can only see their zone
    }
    return [];
  }, [zones, isSuperAdmin, isZonalAdmin, user?.zoneId]);

  // Check if user can perform action on ward
  const canPerformAction = useCallback((ward: WardWithStats, action: string) => {
    if (!user) return false;

    // Super admin can do everything
    if (isSuperAdmin) return true;

    // Zonal admin can only manage wards in their zone
    if (isZonalAdmin) {
      return ward.zoneId === user.zoneId;
    }

    return false;
  }, [user, isSuperAdmin, isZonalAdmin]);

  // Load user counts for a ward
  const loadWardUserCounts = async (wardId: string) => {
    try {
      const usersRef = collection(db, 'users');
      
      const [totalResult, verifiedResult, pendingResult] = await Promise.allSettled([
        getCountFromServer(query(usersRef, where('wardId', '==', wardId))),
        getCountFromServer(query(usersRef, where('wardId', '==', wardId), where('verified', '==', true))),
        getCountFromServer(query(usersRef, where('wardId', '==', wardId), where('verified', '==', false)))
      ]);

      return {
        userCount: totalResult.status === 'fulfilled' ? totalResult.value.data().count : 0,
        verifiedUsers: verifiedResult.status === 'fulfilled' ? verifiedResult.value.data().count : 0,
        pendingUsers: pendingResult.status === 'fulfilled' ? pendingResult.value.data().count : 0,
      };
    } catch (error) {
      console.error('Error loading user counts for ward:', wardId, error);
      return { userCount: 0, verifiedUsers: 0, pendingUsers: 0 };
    }
  };

  // Load all data in a single function
  const loadAllData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      console.log(`Loading all data for ${user.role}...`);
      setLoading(true);

      // Load zones first
      const zonesRef = collection(db, 'zones');
      let zonesQuery = query(zonesRef, orderBy('createdAt', 'desc'));

      // Filter zones based on user role
      if (isZonalAdmin && user?.zoneId) {
        zonesQuery = query(zonesRef, where('__name__', '==', user.zoneId));
      }

      const zonesSnapshot = await getDocs(zonesQuery);
      const zonesData: Zone[] = zonesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Zone));

      console.log(`Zones loaded: ${zonesData.length}`);
      setZones(zonesData);

      // Load wards with zone filtering
      const wardsRef = collection(db, 'wards');
      let wardsQuery = query(wardsRef, orderBy('createdAt', 'desc'));

      if (isZonalAdmin && user?.zoneId) {
        wardsQuery = query(wardsRef, where('zoneId', '==', user.zoneId), orderBy('createdAt', 'desc'));
      }

      const wardsSnapshot = await getDocs(wardsQuery);
      
      if (wardsSnapshot.empty) {
        console.log('No wards found');
        setWards([]);
        setFilteredWards([]);
        setLoading(false);
        initialLoadComplete.current = true;
        return;
      }

      // Process wards with user counts in batches
      const wardsData: WardWithStats[] = [];
      const batchSize = 3; // Smaller batch size to prevent overwhelming Firebase
      
      for (let i = 0; i < wardsSnapshot.docs.length; i += batchSize) {
        const batch = wardsSnapshot.docs.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (wardDoc) => {
          const wardData = { id: wardDoc.id, ...wardDoc.data() } as Ward;
          
          // Get zone name
          const zone = zonesData.find(z => z.id === wardData.zoneId);
          
          // Load user counts
          const userCounts = await loadWardUserCounts(wardDoc.id);
          
          return {
            ...wardData,
            ...userCounts,
            zoneName: zone?.name || 'Unknown Zone',
          };
        });

        const batchResults = await Promise.all(batchPromises);
        wardsData.push(...batchResults);
      }
      
      console.log(`Wards loaded: ${wardsData.length}`);
      setWards(wardsData);
      setFilteredWards(wardsData);
      setLoading(false);
      initialLoadComplete.current = true;
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Error",
        description: "Failed to load data. Please refresh the page.",
        variant: "destructive",
      });
      setLoading(false);
      initialLoadComplete.current = true;
    }
  }, [user, isZonalAdmin]);

  // Initial data load
  useEffect(() => {
    if (user && !initialLoadComplete.current) {
      loadAllData();
    }
  }, [user, loadAllData]);

  // Set up real-time listeners only once after initial load
  useEffect(() => {
    if (!user || !initialLoadComplete.current || listenersSetup.current) return;

    console.log('Setting up real-time listeners...');
    listenersSetup.current = true;

    const unsubscribers: (() => void)[] = [];

    try {
      // Listen to wards changes
      const wardsRef = collection(db, 'wards');
      let wardsQuery = query(wardsRef, orderBy('createdAt', 'desc'));

      if (isZonalAdmin && user?.zoneId) {
        wardsQuery = query(wardsRef, where('zoneId', '==', user.zoneId), orderBy('createdAt', 'desc'));
      }
      
      const unsubscribeWards = onSnapshot(
        wardsQuery, 
        (snapshot) => {
          if (!snapshot.metadata.fromCache && snapshot.docChanges().length > 0) {
            console.log('Wards collection changed, reloading...');
            // Debounce the reload to avoid too many calls
            setTimeout(() => {
              if (initialLoadComplete.current) {
                loadAllData();
              }
            }, 1000);
          }
        },
        (error) => {
          console.error('Error in wards listener:', error);
        }
      );
      unsubscribers.push(unsubscribeWards);

      // Listen to zones changes
      const zonesRef = collection(db, 'zones');
      let zonesQuery = query(zonesRef, orderBy('createdAt', 'desc'));

      if (isZonalAdmin && user?.zoneId) {
        zonesQuery = query(zonesRef, where('__name__', '==', user.zoneId));
      }
      
      const unsubscribeZones = onSnapshot(
        zonesQuery, 
        (snapshot) => {
          if (!snapshot.metadata.fromCache && snapshot.docChanges().length > 0) {
            console.log('Zones collection changed, reloading...');
            setTimeout(() => {
              if (initialLoadComplete.current) {
                loadAllData();
              }
            }, 1000);
          }
        },
        (error) => {
          console.error('Error in zones listener:', error);
        }
      );
      unsubscribers.push(unsubscribeZones);

    } catch (error) {
      console.error('Error setting up listeners:', error);
    }

    return () => {
      console.log('Cleaning up listeners...');
      unsubscribers.forEach(unsubscribe => unsubscribe());
      listenersSetup.current = false;
    };
  }, [user, isZonalAdmin, loadAllData]);

  // Filter wards based on search and zone selection
  useEffect(() => {
    let filtered = wards;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(ward =>
        ward.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ward.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ward.zoneName.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Zone filter
    if (selectedZone !== 'all') {
      filtered = filtered.filter(ward => ward.zoneId === selectedZone);
    }

    setFilteredWards(filtered);
  }, [wards, searchTerm, selectedZone]);

  // Create new ward with role-based zone restriction
  const handleCreateWard = async () => {
    if (!formData.name.trim() || !formData.zoneId) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }
    
    // Validate zone access for zonal admin
    if (isZonalAdmin && formData.zoneId !== user?.zoneId) {
      toast({
        title: "Error",
        description: "You can only create wards in your assigned zone.",
        variant: "destructive",
      });
      return;
    }
    
    setSubmitting(true);
    try {
      const wardData = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        zoneId: formData.zoneId,
        adminId: null, // Will be assigned later
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      
      console.log('Creating ward with data:', wardData);
      const docRef = await addDoc(collection(db, 'wards'), wardData);
      console.log('Ward created with ID:', docRef.id);
      
      setFormData({ name: '', description: '', zoneId: '' });
      setIsCreateDialogOpen(false);
      
      toast({
        title: "Success",
        description: "Ward created successfully.",
      });

      // Reload data after a short delay
      setTimeout(() => loadAllData(), 500);
    } catch (error) {
      console.error('Error creating ward:', error);
      toast({
        title: "Error",
        description: "Failed to create ward. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Update existing ward with permission check
  const handleEditWard = async () => {
    if (!selectedWard || !formData.name.trim() || !formData.zoneId) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }
    
    // Check permissions
    if (!canPerformAction(selectedWard, 'edit')) {
      toast({
        title: "Error",
        description: "You don't have permission to edit this ward.",
        variant: "destructive",
      });
      return;
    }

    // Validate zone access for zonal admin
    if (isZonalAdmin && formData.zoneId !== user?.zoneId) {
      toast({
        title: "Error",
        description: "You can only assign wards to your zone.",
        variant: "destructive",
      });
      return;
    }
    
    setSubmitting(true);
    try {
      const wardRef = doc(db, 'wards', selectedWard.id);
      const updateData = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        zoneId: formData.zoneId,
        updatedAt: serverTimestamp(),
      };
      
      await updateDoc(wardRef, updateData);
      
      setFormData({ name: '', description: '', zoneId: '' });
      setSelectedWard(null);
      setIsEditDialogOpen(false);
      
      toast({
        title: "Success",
        description: "Ward updated successfully.",
      });

      // Reload data after a short delay
      setTimeout(() => loadAllData(), 500);
    } catch (error) {
      console.error('Error updating ward:', error);
      toast({
        title: "Error",
        description: "Failed to update ward. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Delete ward with permission check
  const handleDeleteWard = async (wardId: string) => {
    const ward = wards.find(w => w.id === wardId);
    if (!ward || !canPerformAction(ward, 'delete')) {
      toast({
        title: "Error",
        description: "You don't have permission to delete this ward.",
        variant: "destructive",
      });
      return;
    }

    try {
      await deleteDoc(doc(db, 'wards', wardId));
      
      toast({
        title: "Success",
        description: "Ward deleted successfully.",
      });

      // Reload data after a short delay
      setTimeout(() => loadAllData(), 500);
    } catch (error) {
      console.error('Error deleting ward:', error);
      toast({
        title: "Error",
        description: "Failed to delete ward. Please try again.",
        variant: "destructive",
      });
    }
  };

  const openEditDialog = (ward: WardWithStats) => {
    if (!canPerformAction(ward, 'edit')) {
      toast({
        title: "Error",
        description: "You don't have permission to edit this ward.",
        variant: "destructive",
      });
      return;
    }

    setSelectedWard(ward);
    setFormData({
      name: ward.name,
      description: ward.description || '',
      zoneId: ward.zoneId,
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

    // Pre-select zone for zonal admin
    const initialZoneId = isZonalAdmin ? user?.zoneId || '' : '';
    setFormData({ name: '', description: '', zoneId: initialZoneId });
    setIsCreateDialogOpen(true);
  };

  const accessibleZones = getAccessibleZones();

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
    totalWards: wards.length,
    totalUsers: wards.reduce((sum, ward) => sum + ward.userCount, 0),
    totalZones: accessibleZones.length,
  };

  // Role-based title and description
  const getRoleBasedTitle = () => {
    if (isSuperAdmin) {
      return 'Ward Management - All Zones';
    }
    if (isZonalAdmin) {
      const zoneName = zones.find(z => z.id === user?.zoneId)?.name || 'Zone';
      return `Ward Management - ${zoneName}`;
    }
    return 'Ward Management';
  };

  const getRoleBasedDescription = () => {
    if (isSuperAdmin) {
      return 'Manage wards across all zones and view comprehensive statistics';
    }
    if (isZonalAdmin) {
      return 'Manage wards within your assigned zone';
    }
    return 'Manage wards under zones and view statistics';
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Role-based access notification */}
        {isZonalAdmin && (
          <Alert className="border-blue-200 bg-blue-50">
            <Shield className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800">
              You have zonal admin access. You can only create and manage wards within your assigned zone: <strong>{zones.find(z => z.id === user?.zoneId)?.name || 'Unknown Zone'}</strong>
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
          <Button 
            onClick={openCreateDialog} 
            disabled={accessibleZones.length === 0 || !canCreateWards}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Ward
          </Button>
        </motion.div>

        {accessibleZones.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="border-yellow-200 bg-yellow-50">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-yellow-800">
                  <AlertTriangle className="h-5 w-5" />
                  <p className="font-medium">No zones available</p>
                </div>
                <p className="text-yellow-700 mt-1">
                  {isSuperAdmin 
                    ? 'You need to create zones first before you can create wards.'
                    : 'No zone has been assigned to your account. Contact your administrator.'}
                </p>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              title: 'Total Wards',
              value: totalStats.totalWards,
              icon: Building2,
              color: 'blue',
            },
            {
              title: 'Total Users',
              value: totalStats.totalUsers,
              icon: Users,
              color: 'green',
            },
            {
              title: isSuperAdmin ? 'Total Zones' : 'Assigned Zone',
              value: totalStats.totalZones,
              icon: MapPin,
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
                Wards ({filteredWards.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredWards.length === 0 ? (
                <div className="text-center py-12">
                  <Building2 className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No wards found</h3>
                  <p className="text-gray-500 mb-4">
                    {searchTerm || selectedZone !== 'all' 
                      ? 'Try adjusting your search filters.' 
                      : 'Get started by creating your first ward.'}
                  </p>
                  {accessibleZones.length > 0 && !searchTerm && selectedZone === 'all' && canCreateWards && (
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
                        <TableHead className="font-semibold">Parent Zone</TableHead>
                        <TableHead className="font-semibold">Description</TableHead>
                        <TableHead className="font-semibold">Users</TableHead>
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
                                {ward.adminId && (
                                  <div className="text-sm text-gray-500 flex items-center gap-1">
                                    <Shield className="w-3 h-3" />
                                    Admin assigned
                                  </div>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <MapPin className="h-4 w-4 text-gray-400" />
                              <span className="text-sm font-medium text-gray-700">{ward.zoneName}</span>
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
                                <span className="text-green-600">{ward.verifiedUsers} verified</span>, <span className="text-yellow-600">{ward.pendingUsers} pending</span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {ward.adminId ? (
                              <Badge className="bg-green-100 text-green-800 border-green-200">
                                <Shield className="w-3 h-3 mr-1" />
                                Active
                              </Badge>
                            ) : (
                              <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">
                                <AlertTriangle className="w-3 h-3 mr-1" />
                                No Admin
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-gray-500">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {ward.createdAt?.toDate?.()?.toLocaleDateString() || 'N/A'}
                            </div>
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
                                        <Building2 className="h-5 w-5 text-blue-600" />
                                        Ward Details - {ward.name}
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
                                          <label className="text-sm font-medium text-gray-600">Parent Zone</label>
                                          <p className="text-gray-900">{ward.zoneName}</p>
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
                                            {ward.createdAt?.toDate?.()?.toLocaleDateString() || 'N/A'}
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
                                          <label className="text-sm font-medium text-gray-600">Admin Status</label>
                                          <p className={`text-sm font-medium ${ward.adminId ? 'text-green-600' : 'text-yellow-600'}`}>
                                            {ward.adminId ? 'Admin Assigned' : 'No Admin Assigned'}
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                  </DialogContent>
                                </Dialog>
                                
                                {canPerformAction(ward, 'edit') && (
                                  <DropdownMenuItem onClick={() => openEditDialog(ward)}>
                                    <Edit className="mr-2 h-4 w-4" />
                                    Edit Ward
                                  </DropdownMenuItem>
                                )}
                                
                                {!canPerformAction(ward, 'edit') && (
                                  <DropdownMenuItem disabled>
                                    <AlertTriangle className="mr-2 h-4 w-4" />
                                    No edit permission
                                  </DropdownMenuItem>
                                )}
                                
                                <DropdownMenuSeparator />
                                
                                {canPerformAction(ward, 'delete') && (
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
                                              Warning: This ward contains {ward.userCount} users. 
                                              All associated user data will be affected.
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
                                        >
                                          Delete Ward
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
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
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5 text-blue-600" />
                Create New Ward
              </DialogTitle>
              <DialogDescription>
                Add a new ward under {isZonalAdmin ? 'your zone' : 'a specific zone'}.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="parentZone">Parent Zone</Label>
                <Select 
                  value={formData.zoneId} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, zoneId: value }))}
                  disabled={submitting || isZonalAdmin} // Disable for zonal admin as it's pre-selected
                >
                  <SelectTrigger className="border-gray-200 focus:border-blue-500 focus:ring-blue-500">
                    <SelectValue placeholder="Select a zone" />
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
                    You can only create wards in your assigned zone.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="wardName">Ward Name</Label>
                <Input
                  id="wardName"
                  placeholder="e.g., Ward 1 - Downtown Core"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  disabled={submitting}
                  className="border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wardDescription">Description (Optional)</Label>
                <Textarea
                  id="wardDescription"
                  placeholder="Brief description of the ward..."
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  disabled={submitting}
                  className="border-gray-200 focus:border-blue-500 focus:ring-blue-500 resize-none"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setIsCreateDialogOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleCreateWard} 
                disabled={!formData.name.trim() || !formData.zoneId || submitting}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {submitting ? 'Creating...' : 'Create Ward'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Ward Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Edit className="h-5 w-5 text-blue-600" />
                Edit Ward
              </DialogTitle>
              <DialogDescription>
                Update details for the ward &quot;{selectedWard?.name}&quot;.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="editParentZone">Parent Zone</Label>
                <Select 
                  value={formData.zoneId} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, zoneId: value }))}
                  disabled={submitting || isZonalAdmin} // Disable for zonal admin
                >
                  <SelectTrigger className="border-gray-200 focus:border-blue-500 focus:ring-blue-500">
                    <SelectValue placeholder="Select a zone" />
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
                    You can only assign wards to your zone.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="editWardName">Ward Name</Label>
                <Input
                  id="editWardName"
                  placeholder="e.g., Ward 1 - Downtown Core"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  disabled={submitting}
                  className="border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editWardDescription">Description (Optional)</Label>
                <Textarea
                  id="editWardDescription"
                  placeholder="Brief description of the ward..."
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  disabled={submitting}
                  className="border-gray-200 focus:border-blue-500 focus:ring-blue-500 resize-none"
                  rows={3}
                />
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
                onClick={handleEditWard} 
                disabled={!formData.name.trim() || !formData.zoneId || submitting}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {submitting ? 'Updating...' : 'Update Ward'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}