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
  Eye
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
  writeBatch
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import { useToast } from '@/hooks/use-toast';
import { Zone } from '@/types';

interface ZoneWithStats extends Zone {
  userCount: number;
  wardCount: number;
  verifiedUsers: number;
  pendingUsers: number;
}

export default function ZonesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [zones, setZones] = useState<ZoneWithStats[]>([]);
  const [filteredZones, setFilteredZones] = useState<ZoneWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedZone, setSelectedZone] = useState<ZoneWithStats | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch zones with user and ward statistics
  useEffect(() => {
    if (!user) return;

    setLoading(true);
    
    // Set up real-time listener for zones
    const zonesQuery = query(
      collection(db, 'zones'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(zonesQuery, async (snapshot) => {
      try {
        const zonesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate() || new Date(),
          updatedAt: doc.data().updatedAt?.toDate() || new Date(),
        })) as Zone[];

        // Fetch statistics for each zone
        const zonesWithStats = await Promise.all(
          zonesData.map(async (zone) => {
            try {
              // Get user count for this zone
              const usersQuery = query(
                collection(db, 'users'),
                where('zoneId', '==', zone.id)
              );
              const usersSnapshot = await getDocs(usersQuery);
              const users = usersSnapshot.docs.map(doc => doc.data());
              
              const userCount = users.length;
              const verifiedUsers = users.filter(user => user.isVerified).length;
              const pendingUsers = users.filter(user => !user.isVerified).length;

              // Get ward count for this zone
              const wardsQuery = query(
                collection(db, 'wards'),
                where('zoneId', '==', zone.id)
              );
              const wardsSnapshot = await getDocs(wardsQuery);
              const wardCount = wardsSnapshot.docs.length;

              return {
                ...zone,
                userCount,
                wardCount,
                verifiedUsers,
                pendingUsers,
              } as ZoneWithStats;
            } catch (error) {
              console.error(`Error fetching stats for zone ${zone.id}:`, error);
              return {
                ...zone,
                userCount: 0,
                wardCount: 0,
                verifiedUsers: 0,
                pendingUsers: 0,
              } as ZoneWithStats;
            }
          })
        );

        setZones(zonesWithStats);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching zones:', error);
        toast({
          title: "Error",
          description: "Failed to load zones. Please try again.",
          variant: "destructive",
        });
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [user, toast]);

  // Filter zones based on search term
  useEffect(() => {
    let filtered = zones;

    if (searchTerm) {
      filtered = filtered.filter(zone =>
        zone.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        zone.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredZones(filtered);
  }, [zones, searchTerm]);

  const handleCreateZone = async () => {
    if (!formData.name.trim() || !user) return;

    setIsSubmitting(true);
    try {
      const zoneData = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        adminId: null, // Will be assigned later
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        createdBy: user.id,
      };

      await addDoc(collection(db, 'zones'), zoneData);

      toast({
        title: "Success",
        description: "Zone created successfully.",
      });

      setFormData({ name: '', description: '' });
      setIsCreateDialogOpen(false);
    } catch (error) {
      console.error('Error creating zone:', error);
      toast({
        title: "Error",
        description: "Failed to create zone. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditZone = async () => {
    if (!selectedZone || !formData.name.trim()) return;

    setIsSubmitting(true);
    try {
      const zoneRef = doc(db, 'zones', selectedZone.id);
      await updateDoc(zoneRef, {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        updatedAt: Timestamp.now(),
      });

      toast({
        title: "Success",
        description: "Zone updated successfully.",
      });

      setFormData({ name: '', description: '' });
      setSelectedZone(null);
      setIsEditDialogOpen(false);
    } catch (error) {
      console.error('Error updating zone:', error);
      toast({
        title: "Error",
        description: "Failed to update zone. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteZone = async (zoneId: string) => {
    setIsSubmitting(true);
    try {
      const batch = writeBatch(db);

      // Delete the zone
      const zoneRef = doc(db, 'zones', zoneId);
      batch.delete(zoneRef);

      // You might also want to handle related data:
      // - Update users to remove zoneId
      // - Delete or reassign wards
      // - Handle any other related documents

      // Get users in this zone and update them
      const usersQuery = query(
        collection(db, 'users'),
        where('zoneId', '==', zoneId)
      );
      const usersSnapshot = await getDocs(usersQuery);
      
      usersSnapshot.docs.forEach(userDoc => {
        batch.update(userDoc.ref, {
          zoneId: null,
          updatedAt: Timestamp.now(),
        });
      });

      // Get wards in this zone and delete them or reassign
      const wardsQuery = query(
        collection(db, 'wards'),
        where('zoneId', '==', zoneId)
      );
      const wardsSnapshot = await getDocs(wardsQuery);
      
      wardsSnapshot.docs.forEach(wardDoc => {
        batch.delete(wardDoc.ref);
      });

      await batch.commit();

      toast({
        title: "Success",
        description: "Zone and related data deleted successfully.",
      });
    } catch (error) {
      console.error('Error deleting zone:', error);
      toast({
        title: "Error",
        description: "Failed to delete zone. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditDialog = (zone: ZoneWithStats) => {
    setSelectedZone(zone);
    setFormData({
      name: zone.name,
      description: zone.description || '',
    });
    setIsEditDialogOpen(true);
  };

  const openCreateDialog = () => {
    setFormData({ name: '', description: '' });
    setIsCreateDialogOpen(true);
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
    totalWards: zones.reduce((sum, zone) => sum + zone.wardCount, 0),
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
              Manage zonal regions and view statistics
            </p>
          </div>
          <Button onClick={openCreateDialog} disabled={isSubmitting}>
            <Plus className="w-4 h-4 mr-2" />
            Create Zone
          </Button>
        </motion.div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              title: 'Total Zones',
              value: totalStats.totalZones,
              icon: MapPin,
              color: 'blue',
            },
            {
              title: 'Total Users',
              value: totalStats.totalUsers,
              icon: Users,
              color: 'green',
            },
            {
              title: 'Total Wards',
              value: totalStats.totalWards,
              icon: Building2,
              color: 'purple',
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

        {/* Search */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card>
            <CardContent className="p-6">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search zones..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
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
              <CardTitle>Zones ({filteredZones.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {filteredZones.length === 0 ? (
                <div className="text-center py-8">
                  <MapPin className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-semibold text-gray-900">No zones found</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {searchTerm ? 'Try adjusting your search terms.' : 'Get started by creating your first zone.'}
                  </p>
                  {!searchTerm && (
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
                        <TableHead>Description</TableHead>
                        <TableHead>Users</TableHead>
                        <TableHead>Wards</TableHead>
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
                                {zone.adminId && (
                                  <div className="text-sm text-gray-500">
                                    Admin assigned
                                  </div>
                                )}
                              </div>
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
                            <Badge variant="secondary">
                              {zone.wardCount} wards
                            </Badge>
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
                                        <div>
                                          <label className="text-sm font-medium">Last Updated</label>
                                          <p className="text-sm text-gray-600">
                                            {zone.updatedAt.toLocaleDateString()}
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
                                          <label className="text-sm font-medium">Total Wards</label>
                                          <p className="text-lg font-semibold text-purple-600">
                                            {zone.wardCount}
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                  </DialogContent>
                                </Dialog>
                                <DropdownMenuItem onClick={() => openEditDialog(zone)}>
                                  <Edit className="mr-2 h-4 w-4" />
                                  Edit Zone
                                </DropdownMenuItem>
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
                                            Warning: This zone contains {zone.userCount} users and {zone.wardCount} wards. 
                                            All associated data will be affected.
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
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Zone</DialogTitle>
              <DialogDescription>
                Add a new zonal region to organize your party structure.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="zoneName">Zone Name</Label>
                <Input
                  id="zoneName"
                  placeholder="e.g., Zone A - Central District"
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
                disabled={!formData.name.trim() || isSubmitting}
              >
                {isSubmitting ? 'Creating...' : 'Create Zone'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Zone Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Zone</DialogTitle>
              <DialogDescription>
                Update the zone information.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="editZoneName">Zone Name</Label>
                <Input
                  id="editZoneName"
                  placeholder="e.g., Zone A - Central District"
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
                disabled={!formData.name.trim() || isSubmitting}
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