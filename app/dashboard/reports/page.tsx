'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  FileText,
  Download,
  Filter,
  TrendingUp,
  Users,
  MapPin,
  Building2,
  Calendar,
  BarChart3,
  PieChart,
  Activity,
  CheckCircle,
  Clock,
  XCircle,
  Search,
  FileSpreadsheet,
  Eye,
  RefreshCw,
  Shield,
  AlertTriangle,
} from 'lucide-react';
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  Timestamp,
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
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Alert,
  AlertDescription,
} from '@/components/ui/alert';
import { toast } from '@/hooks/use-toast';

interface ReportData {
  totalUsers: number;
  verifiedUsers: number;
  pendingUsers: number;
  totalZones: number;
  totalWards: number;
  growthRate: number;
  approvalRate: number;
}

interface ZonePerformance {
  id: string;
  name: string;
  totalUsers: number;
  verifiedUsers: number;
  pendingUsers: number;
  wardCount: number;
  growthRate: number;
  verificationRate: number;
}

interface WardPerformance {
  id: string;
  name: string;
  zoneId: string;
  zoneName: string;
  totalUsers: number;
  verifiedUsers: number;
  pendingUsers: number;
  verificationRate: number;
}

interface ApprovalTrend {
  date: string;
  approved: number;
  pending: number;
  rejected: number;
}

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  zoneId?: string;
  wardId?: string;
  verified: boolean;
  createdAt: Timestamp;
  verifiedAt?: Timestamp;
  phone?: string;
  idNumber?: string;
  address?: string;
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

export default function ReportsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState<ReportData>({
    totalUsers: 0,
    verifiedUsers: 0,
    pendingUsers: 0,
    totalZones: 0,
    totalWards: 0,
    growthRate: 0,
    approvalRate: 0,
  });
  const [zonePerformance, setZonePerformance] = useState<ZonePerformance[]>([]);
  const [wardPerformance, setWardPerformance] = useState<WardPerformance[]>([]);
  const [approvalTrends, setApprovalTrends] = useState<ApprovalTrend[]>([]);
  const [selectedExportType, setSelectedExportType] = useState('all-users');
  const [exporting, setExporting] = useState(false);
  const [zones, setZones] = useState<Zone[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedZoneFilter, setSelectedZoneFilter] = useState<string>('all');
  const [selectedWardFilter, setSelectedWardFilter] = useState<string>('all');

  // Role-based permissions
  const isSuperAdmin = user?.role === 'superAdmin';
  const isZonalAdmin = user?.role === 'zonalAdmin';
  const isWardAdmin = user?.role === 'wardAdmin';

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

  // Load all data with role-based filtering
  const loadReportData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      console.log(`Loading report data for ${user.role}...`);
      await Promise.all([fetchZones(), fetchWards(), fetchUsers()]);
    } catch (error) {
      console.error('Error loading report data:', error);
      toast({
        title: "Error",
        description: "Failed to load report data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [user]);

  const fetchZones = async () => {
    try {
      const zonesRef = collection(db, 'zones');
      let zonesQuery = query(zonesRef, orderBy('createdAt', 'desc'));

      // Apply role-based filtering
      if (isZonalAdmin && user?.zoneId) {
        zonesQuery = query(zonesRef, where('__name__', '==', user.zoneId));
      } else if (isWardAdmin && user?.wardId) {
        // For ward admin, we need to get their ward first to find the zone
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
    } catch (error) {
      console.error('Error fetching zones:', error);
    }
  };

  const fetchWards = async () => {
    try {
      const wardsRef = collection(db, 'wards');
      let wardsQuery = query(wardsRef, orderBy('createdAt', 'desc'));

      // Apply role-based filtering
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
    } catch (error) {
      console.error('Error fetching wards:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      const usersRef = collection(db, 'users');
      let usersQuery = query(usersRef, orderBy('createdAt', 'desc'));

      // Apply role-based filtering
      if (isZonalAdmin && user?.zoneId) {
        usersQuery = query(usersRef, where('zoneId', '==', user.zoneId), orderBy('createdAt', 'desc'));
      } else if (isWardAdmin && user?.wardId) {
        usersQuery = query(usersRef, where('wardId', '==', user.wardId), orderBy('createdAt', 'desc'));
      }

      const usersSnapshot = await getDocs(usersQuery);
      const usersData: User[] = usersSnapshot.docs.map(doc => {
        const userData = doc.data();
        return {
          id: doc.id,
          email: userData.email || '',
          name: userData.name || userData.displayName || '',
          role: userData.role || 'member',
          zoneId: userData.zoneId,
          wardId: userData.wardId,
          verified: userData.verified || false,
          createdAt: userData.createdAt || Timestamp.now(),
          verifiedAt: userData.verifiedAt,
          phone: userData.phone,
          idNumber: userData.idNumber,
          address: userData.address,
        };
      });

      console.log(`Users loaded: ${usersData.length}`);
      setUsers(usersData);
      
      // Calculate derived data
      calculateReportData(usersData);
      calculateApprovalTrends(usersData);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const calculateReportData = (usersData: User[]) => {
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());

    const totalUsers = usersData.length;
    const verifiedUsers = usersData.filter(user => user.verified).length;
    const pendingUsers = usersData.filter(user => !user.verified).length;

    // Calculate growth rate (users created in the last month)
    const recentUsers = usersData.filter(user => user.createdAt.toDate() >= lastMonth).length;
    const growthRate = totalUsers > 0 ? (recentUsers / totalUsers) * 100 : 0;

    const approvalRate = totalUsers > 0 ? (verifiedUsers / totalUsers) * 100 : 0;

    const accessibleZones = getAccessibleZones();
    const accessibleWards = getAccessibleWards();

    setReportData({
      totalUsers,
      verifiedUsers,
      pendingUsers,
      totalZones: accessibleZones.length,
      totalWards: accessibleWards.length,
      growthRate,
      approvalRate,
    });

    // Calculate zone and ward performance
    calculateZonePerformance(usersData);
    calculateWardPerformance(usersData);
  };

  const calculateZonePerformance = (usersData: User[]) => {
    const accessibleZones = getAccessibleZones();
    const accessibleWards = getAccessibleWards();
    const zonePerformanceData: ZonePerformance[] = [];

    accessibleZones.forEach(zone => {
      const zoneUsers = usersData.filter(user => user.zoneId === zone.id);
      const zoneWards = accessibleWards.filter(ward => ward.zoneId === zone.id);
      const verifiedZoneUsers = zoneUsers.filter(user => user.verified);
      const pendingZoneUsers = zoneUsers.filter(user => !user.verified);

      // Calculate growth rate for this zone (last month)
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      const recentZoneUsers = zoneUsers.filter(user => user.createdAt.toDate() >= lastMonth);
      const zoneGrowthRate = zoneUsers.length > 0 ? (recentZoneUsers.length / zoneUsers.length) * 100 : 0;

      const verificationRate = zoneUsers.length > 0 ? (verifiedZoneUsers.length / zoneUsers.length) * 100 : 0;

      zonePerformanceData.push({
        id: zone.id,
        name: zone.name,
        totalUsers: zoneUsers.length,
        verifiedUsers: verifiedZoneUsers.length,
        pendingUsers: pendingZoneUsers.length,
        wardCount: zoneWards.length,
        growthRate: zoneGrowthRate,
        verificationRate,
      });
    });

    setZonePerformance(zonePerformanceData);
  };

  const calculateWardPerformance = (usersData: User[]) => {
    const accessibleWards = getAccessibleWards();
    const accessibleZones = getAccessibleZones();
    const wardPerformanceData: WardPerformance[] = [];

    accessibleWards.forEach(ward => {
      const wardUsers = usersData.filter(user => user.wardId === ward.id);
      const verifiedWardUsers = wardUsers.filter(user => user.verified);
      const pendingWardUsers = wardUsers.filter(user => !user.verified);
      const zone = accessibleZones.find(z => z.id === ward.zoneId);

      const verificationRate = wardUsers.length > 0 ? (verifiedWardUsers.length / wardUsers.length) * 100 : 0;

      wardPerformanceData.push({
        id: ward.id,
        name: ward.name,
        zoneId: ward.zoneId,
        zoneName: zone?.name || 'Unknown Zone',
        totalUsers: wardUsers.length,
        verifiedUsers: verifiedWardUsers.length,
        pendingUsers: pendingWardUsers.length,
        verificationRate,
      });
    });

    setWardPerformance(wardPerformanceData);
  };

  const calculateApprovalTrends = (usersData: User[]) => {
    const trends: ApprovalTrend[] = [];
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      return date;
    }).reverse();

    last7Days.forEach(date => {
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);

      const dayUsers = usersData.filter(user => {
        const userDate = user.verifiedAt?.toDate() || user.createdAt.toDate();
        return userDate >= dayStart && userDate <= dayEnd;
      });

      const approved = dayUsers.filter(user => user.verified).length;
      const pending = dayUsers.filter(user => !user.verified).length;

      trends.push({
        date: date.toISOString().split('T')[0],
        approved,
        pending,
        rejected: 0, // We don't track rejected users separately in this implementation
      });
    });

    setApprovalTrends(trends);
  };

  const handleExport = async (type: string) => {
    setExporting(true);

    try {
      let exportData: any[] = [];
      let filename = '';

      switch (type) {
        case 'all-users':
          exportData = users.map(user => ({
            Name: user.name,
            Email: user.email,
            Role: user.role,
            Zone: zones.find(z => z.id === user.zoneId)?.name || 'N/A',
            Ward: wards.find(w => w.id === user.wardId)?.name || 'N/A',
            Verified: user.verified ? 'Yes' : 'No',
            'Created Date': user.createdAt.toDate().toLocaleDateString(),
            Phone: user.phone || 'N/A',
            'ID Number': user.idNumber || 'N/A',
            Address: user.address || 'N/A',
          }));
          filename = 'all-users';
          break;

        case 'verified-users':
          exportData = users
            .filter(user => user.verified)
            .map(user => ({
              Name: user.name,
              Email: user.email,
              Role: user.role,
              Zone: zones.find(z => z.id === user.zoneId)?.name || 'N/A',
              Ward: wards.find(w => w.id === user.wardId)?.name || 'N/A',
              'Verification Date': user.verifiedAt?.toDate().toLocaleDateString() || 'N/A',
              Phone: user.phone || 'N/A',
              'ID Number': user.idNumber || 'N/A',
            }));
          filename = 'verified-users';
          break;

        case 'pending-users':
          exportData = users
            .filter(user => !user.verified)
            .map(user => ({
              Name: user.name,
              Email: user.email,
              Zone: zones.find(z => z.id === user.zoneId)?.name || 'N/A',
              Ward: wards.find(w => w.id === user.wardId)?.name || 'N/A',
              'Application Date': user.createdAt.toDate().toLocaleDateString(),
              'Days Pending': Math.floor((Date.now() - user.createdAt.toDate().getTime()) / (1000 * 60 * 60 * 24)),
              Phone: user.phone || 'N/A',
              'ID Number': user.idNumber || 'N/A',
            }));
          filename = 'pending-users';
          break;

        case 'admin-users':
          exportData = users
            .filter(user => ['wardAdmin', 'zonalAdmin', 'superAdmin'].includes(user.role))
            .map(user => ({
              Name: user.name,
              Email: user.email,
              Role: user.role,
              Zone: zones.find(z => z.id === user.zoneId)?.name || 'N/A',
              Ward: wards.find(w => w.id === user.wardId)?.name || 'N/A',
              Verified: user.verified ? 'Yes' : 'No',
              'Created Date': user.createdAt.toDate().toLocaleDateString(),
            }));
          filename = 'admin-users';
          break;

        case 'zone-performance':
          exportData = zonePerformance.map(zone => ({
            'Zone Name': zone.name,
            'Total Users': zone.totalUsers,
            'Verified Users': zone.verifiedUsers,
            'Pending Users': zone.pendingUsers,
            'Ward Count': zone.wardCount,
            'Verification Rate (%)': zone.verificationRate.toFixed(1),
            'Growth Rate (%)': zone.growthRate.toFixed(1),
          }));
          filename = 'zone-performance';
          break;

        case 'ward-performance':
          exportData = wardPerformance.map(ward => ({
            'Ward Name': ward.name,
            'Zone': ward.zoneName,
            'Total Users': ward.totalUsers,
            'Verified Users': ward.verifiedUsers,
            'Pending Users': ward.pendingUsers,
            'Verification Rate (%)': ward.verificationRate.toFixed(1),
          }));
          filename = 'ward-performance';
          break;

        default:
          throw new Error('Invalid export type');
      }

      // Convert to CSV
      const csvContent = convertToCSV(exportData);
      const fullFilename = `${filename}-${new Date().toISOString().split('T')[0]}.csv`;

      // Download CSV
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fullFilename;
      link.click();
      window.URL.revokeObjectURL(url);

      toast({
        title: "Success",
        description: `${exportData.length} records exported successfully.`,
      });
    } catch (error) {
      console.error('Error exporting data:', error);
      toast({
        title: "Error",
        description: "Failed to export data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  const convertToCSV = (data: any[]) => {
    if (data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const csvRows = [
      headers.join(','),
      ...data.map(row =>
        headers
          .map(header => {
            const value = row[header];
            // Escape commas and quotes in values
            if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
          })
          .join(',')
      ),
    ];

    return csvRows.join('\n');
  };

  const getPerformanceColor = (rate: number) => {
    if (rate >= 90) return 'text-green-600';
    if (rate >= 80) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getGrowthColor = (rate: number) => {
    if (rate > 0) return 'text-green-600';
    if (rate === 0) return 'text-gray-600';
    return 'text-red-600';
  };

  // Role-based title and description
  const getRoleBasedTitle = () => {
    if (isSuperAdmin) {
      return 'Reports & Analytics - System Overview';
    }
    if (isZonalAdmin) {
      const zoneName = zones.find(z => z.id === user?.zoneId)?.name || 'Zone';
      return `Reports & Analytics - ${zoneName}`;
    }
    if (isWardAdmin) {
      const wardName = wards.find(w => w.id === user?.wardId)?.name || 'Ward';
      return `Reports & Analytics - ${wardName}`;
    }
    return 'Reports & Analytics';
  };

  const getRoleBasedDescription = () => {
    if (isSuperAdmin) {
      return 'Generate comprehensive insights and export data across the entire organization';
    }
    if (isZonalAdmin) {
      return 'Generate insights and export data for your zone';
    }
    if (isWardAdmin) {
      return 'Generate insights and export data for your ward';
    }
    return 'Generate insights and export data';
  };

  // Filter performance data based on selected filters
  const filteredZonePerformance = zonePerformance.filter(zone => 
    selectedZoneFilter === 'all' || zone.id === selectedZoneFilter
  );

  const filteredWardPerformance = wardPerformance.filter(ward => {
    const zoneMatch = selectedZoneFilter === 'all' || ward.zoneId === selectedZoneFilter;
    const wardMatch = selectedWardFilter === 'all' || ward.id === selectedWardFilter;
    return zoneMatch && wardMatch;
  });

  const accessibleZones = getAccessibleZones();
  const accessibleWards = getAccessibleWards();
  const availableWards = selectedZoneFilter === 'all' 
    ? accessibleWards 
    : accessibleWards.filter(ward => ward.zoneId === selectedZoneFilter);

  useEffect(() => {
    if (user) {
      loadReportData();
    }
  }, [user, loadReportData]);

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

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Role-based access notification */}
        {!isSuperAdmin && (
          <Alert className="border-blue-200 bg-blue-50">
            <Shield className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800">
              You have {isZonalAdmin ? 'zonal' : 'ward'} admin access. 
              Reports and data exports are limited to your assigned {isZonalAdmin ? 'zone' : 'ward'}.
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
            <h1 className="text-3xl font-bold text-gray-900">
              {getRoleBasedTitle()}
            </h1>
            <p className="text-gray-600 mt-1">
              {getRoleBasedDescription()}
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <Button
              variant="outline"
              onClick={loadReportData}
              disabled={loading}
              className="border-gray-200 hover:bg-gray-50"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh Data
            </Button>
            <Badge variant="secondary" className="text-sm bg-blue-50 text-blue-700 border-blue-200">
              Last updated: {new Date().toLocaleTimeString()}
            </Badge>
          </div>
        </motion.div>

        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[
            {
              title: 'Total Users',
              value: reportData.totalUsers.toLocaleString(),
              change: `+${reportData.growthRate.toFixed(1)}% this month`,
              icon: Users,
              color: 'blue',
            },
            {
              title: 'Verification Rate',
              value: `${reportData.approvalRate.toFixed(1)}%`,
              change: `${reportData.verifiedUsers} verified`,
              icon: CheckCircle,
              color: 'green',
            },
            {
              title: 'Pending Reviews',
              value: reportData.pendingUsers.toString(),
              change: 'Awaiting approval',
              icon: Clock,
              color: 'yellow',
            },
            {
              title: 'Geographic Coverage',
              value: `${reportData.totalZones} ${reportData.totalZones === 1 ? 'zone' : 'zones'}`,
              change: `${reportData.totalWards} ${reportData.totalWards === 1 ? 'ward' : 'wards'}`,
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
                      <p className="text-xs text-gray-500 mt-1">{stat.change}</p>
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

        {/* Main Content Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Tabs defaultValue="analytics" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3 bg-white border shadow-sm">
              <TabsTrigger value="analytics" className="flex items-center gap-2 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">
                <BarChart3 className="w-4 h-4" />
                Analytics
              </TabsTrigger>
              <TabsTrigger value="exports" className="flex items-center gap-2 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">
                <Download className="w-4 h-4" />
                Data Exports
              </TabsTrigger>
              <TabsTrigger value="performance" className="flex items-center gap-2 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">
                <TrendingUp className="w-4 h-4" />
                Performance
              </TabsTrigger>
            </TabsList>

            {/* Analytics Tab */}
            <TabsContent value="analytics" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Approval Trends Chart */}
                <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Activity className="h-5 w-5 text-blue-600" />
                      Approval Trends (Last 7 Days)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {approvalTrends.map((trend, index) => (
                        <div key={trend.date} className="flex items-center justify-between">
                          <div className="text-sm font-medium text-gray-700">
                            {new Date(trend.date).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </div>
                          <div className="flex items-center space-x-4 text-sm">
                            <div className="flex items-center space-x-1">
                              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                              <span className="text-gray-600">{trend.approved} approved</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                              <span className="text-gray-600">{trend.pending} pending</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* User Status Distribution */}
                <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <PieChart className="h-5 w-5 text-blue-600" />
                      User Status Distribution
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-700">Verified Users</span>
                          <span className="text-sm text-gray-600">
                            {reportData.verifiedUsers} ({Math.round((reportData.verifiedUsers / reportData.totalUsers) * 100)}%)
                          </span>
                        </div>
                        <Progress
                          value={(reportData.verifiedUsers / reportData.totalUsers) * 100}
                          className="h-2"
                        />
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-700">Pending Users</span>
                          <span className="text-sm text-gray-600">
                            {reportData.pendingUsers} ({Math.round((reportData.pendingUsers / reportData.totalUsers) * 100)}%)
                          </span>
                        </div>
                        <Progress
                          value={(reportData.pendingUsers / reportData.totalUsers) * 100}
                          className="h-2"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Data Exports Tab */}
            <TabsContent value="exports" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Quick Exports */}
                <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileSpreadsheet className="h-5 w-5 text-blue-600" />
                      Quick Exports
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {[
                      {
                        title: 'All Users',
                        description: 'Complete user database with all details',
                        type: 'all-users',
                        count: reportData.totalUsers,
                      },
                      {
                        title: 'Verified Users Only',
                        description: 'Users with verified status',
                        type: 'verified-users',
                        count: reportData.verifiedUsers,
                      },
                      {
                        title: 'Pending Approvals',
                        description: 'Users awaiting verification',
                        type: 'pending-users',
                        count: reportData.pendingUsers,
                      },
                      {
                        title: 'Admin Users',
                        description: 'Zonal and ward administrators',
                        type: 'admin-users',
                        count: users.filter(u => ['wardAdmin', 'zonalAdmin', 'superAdmin'].includes(u.role)).length,
                      },
                    ].map(exportType => (
                      <div
                        key={exportType.type}
                        className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <div>
                          <h4 className="font-medium text-gray-900">{exportType.title}</h4>
                          <p className="text-sm text-gray-600">{exportType.description}</p>
                          <p className="text-xs text-gray-500 mt-1">{exportType.count} records</p>
                        </div>
                        <Button
                          onClick={() => handleExport(exportType.type)}
                          disabled={exporting}
                          size="sm"
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          {exporting ? (
                            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <Download className="w-4 h-4 mr-2" />
                          )}
                          Export CSV
                        </Button>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* Performance Reports */}
                <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-blue-600" />
                      Performance Reports
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {[
                      {
                        title: 'Zone Performance',
                        description: 'Performance metrics by zone',
                        type: 'zone-performance',
                        count: zonePerformance.length,
                        available: isSuperAdmin || isZonalAdmin,
                      },
                      {
                        title: 'Ward Performance',
                        description: 'Performance metrics by ward',
                        type: 'ward-performance',
                        count: wardPerformance.length,
                        available: true,
                      },
                    ]
                      .filter(report => report.available)
                      .map(reportType => (
                        <div
                          key={reportType.type}
                          className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          <div>
                            <h4 className="font-medium text-gray-900">{reportType.title}</h4>
                            <p className="text-sm text-gray-600">{reportType.description}</p>
                            <p className="text-xs text-gray-500 mt-1">{reportType.count} records</p>
                          </div>
                          <Button
                            onClick={() => handleExport(reportType.type)}
                            disabled={exporting}
                            size="sm"
                            className="bg-blue-600 hover:bg-blue-700"
                          >
                            {exporting ? (
                              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                              <Download className="w-4 h-4 mr-2" />
                            )}
                            Export CSV
                          </Button>
                        </div>
                      ))}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Performance Tab */}
            <TabsContent value="performance" className="space-y-6">
              {/* Filters */}
              <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Filter className="h-5 w-5 text-blue-600" />
                    Performance Filters
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Zone filter - only show if user has access to multiple zones */}
                    {accessibleZones.length > 1 && (
                      <Select value={selectedZoneFilter} onValueChange={setSelectedZoneFilter}>
                        <SelectTrigger className="border-gray-200 focus:border-blue-500 focus:ring-blue-500">
                          <SelectValue placeholder="All Zones" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Zones</SelectItem>
                          {accessibleZones.map(zone => (
                            <SelectItem key={zone.id} value={zone.id}>
                              {zone.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}

                    {/* Ward filter - only show if user has access to multiple wards */}
                    {availableWards.length > 1 && (
                      <Select value={selectedWardFilter} onValueChange={setSelectedWardFilter}>
                        <SelectTrigger className="border-gray-200 focus:border-blue-500 focus:ring-blue-500">
                          <SelectValue placeholder="All Wards" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Wards</SelectItem>
                          {availableWards.map(ward => (
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

              {/* Zone Performance - only show for super admin and zonal admin */}
              {(isSuperAdmin || isZonalAdmin) && (
                <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MapPin className="h-5 w-5 text-blue-600" />
                      Zone Performance ({filteredZonePerformance.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-md border border-gray-200">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gray-50">
                            <TableHead className="font-semibold">Zone</TableHead>
                            <TableHead className="font-semibold">Users</TableHead>
                            <TableHead className="font-semibold">Wards</TableHead>
                            <TableHead className="font-semibold">Verification Rate</TableHead>
                            <TableHead className="font-semibold">Growth Rate</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredZonePerformance.map(zone => (
                            <TableRow key={zone.id} className="hover:bg-gray-50 transition-colors">
                              <TableCell>
                                <div className="flex items-center space-x-2">
                                  <MapPin className="h-4 w-4 text-gray-400" />
                                  <span className="font-medium text-gray-900">{zone.name}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="space-y-1">
                                  <div className="font-medium text-gray-900">{zone.totalUsers} total</div>
                                  <div className="text-sm text-gray-500">
                                    <span className="text-green-600">{zone.verifiedUsers} verified</span>, <span className="text-yellow-600">{zone.pendingUsers} pending</span>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <span className="font-medium text-gray-900">{zone.wardCount}</span>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center space-x-2">
                                  <span className={`font-medium ${getPerformanceColor(zone.verificationRate)}`}>
                                    {zone.verificationRate.toFixed(1)}%
                                  </span>
                                  <Progress value={zone.verificationRate} className="w-16 h-2" />
                                </div>
                              </TableCell>
                              <TableCell>
                                <span className={`font-medium ${getGrowthColor(zone.growthRate)}`}>
                                  {zone.growthRate > 0 ? '+' : ''}{zone.growthRate.toFixed(1)}%
                                </span>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Ward Performance */}
              <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-blue-600" />
                    Ward Performance ({filteredWardPerformance.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border border-gray-200">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50">
                          <TableHead className="font-semibold">Ward</TableHead>
                          {(isSuperAdmin || isZonalAdmin) && <TableHead className="font-semibold">Zone</TableHead>}
                          <TableHead className="font-semibold">Users</TableHead>
                          <TableHead className="font-semibold">Verification Rate</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredWardPerformance.map(ward => (
                          <TableRow key={ward.id} className="hover:bg-gray-50 transition-colors">
                            <TableCell>
                              <div className="flex items-center space-x-2">
                                <Building2 className="h-4 w-4 text-gray-400" />
                                <span className="font-medium text-gray-900">{ward.name}</span>
                              </div>
                            </TableCell>
                            {(isSuperAdmin || isZonalAdmin) && (
                              <TableCell>
                                <span className="text-sm text-gray-600">{ward.zoneName}</span>
                              </TableCell>
                            )}
                            <TableCell>
                              <div className="space-y-1">
                                <div className="font-medium text-gray-900">{ward.totalUsers} total</div>
                                <div className="text-sm text-gray-500">
                                  <span className="text-green-600">{ward.verifiedUsers} verified</span>, <span className="text-yellow-600">{ward.pendingUsers} pending</span>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center space-x-2">
                                <span className={`font-medium ${getPerformanceColor(ward.verificationRate)}`}>
                                  {ward.verificationRate.toFixed(1)}%
                                </span>
                                <Progress value={ward.verificationRate} className="w-16 h-2" />
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}