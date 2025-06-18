'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { 
  Users, 
  UserCheck, 
  MapPin, 
  Building2, 
  Clock,
  TrendingUp,
  Wifi,
  WifiOff
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatCard } from '@/components/dashboard/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { DashboardStats, User } from '@/types';

// Firebase imports for real-time data
import { 
  collection, 
  query, 
  onSnapshot, 
  where, 
  getDocs,
  orderBy,
  limit
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface RealtimeActivity {
  id: string;
  action: string;
  time: Date;
  zone: string;
  userId?: string;
  userName?: string;
}


export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    verifiedUsers: 0,
    pendingUsers: 0,
    totalZones: 0,
    totalWards: 0,
  });
  const [activities, setActivities] = useState<RealtimeActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  
  // Refs to store unsubscribe functions
  const unsubscribeRefs = useRef<(() => void)[]>([]);

  // Real-time stats fetching
  const setupRealtimeStats = useCallback(() => {
    const unsubscribeFunctions: (() => void)[] = [];

    try {
      // Role-based data access
      if (user?.role === 'superAdmin') {
        // SuperAdmin can access all users
        const usersQuery = collection(db, 'users');
        const unsubscribeUsers = onSnapshot(usersQuery, (snapshot) => {
          const users : User[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as User);
          
          const totalUsers = users.length;
          const verifiedUsers = users.filter(user => user.verified === true).length;
          const pendingUsers = users.filter(user => user.verified === false || user.verified === null || user.verified === undefined).length;
          
          setStats(prevStats => ({
            ...prevStats,
            totalUsers,
            verifiedUsers,
            pendingUsers
          }));
          
          setLastUpdated(new Date());
          setIsConnected(true);
        }, (error) => {
          console.error('Error listening to users:', error);
          setIsConnected(false);
        });
        
        unsubscribeFunctions.push(unsubscribeUsers);

        // Listen to zones collection
        const zonesQuery = collection(db, 'zones');
        const unsubscribeZones = onSnapshot(zonesQuery, (snapshot) => {
          const totalZones = snapshot.size;
          
          setStats(prevStats => ({
            ...prevStats,
            totalZones
          }));
        }, (error) => {
          console.error('Error listening to zones:', error);
        });
        
        unsubscribeFunctions.push(unsubscribeZones);

        // Listen to wards collection
        const wardsQuery = collection(db, 'wards');
        const unsubscribeWards = onSnapshot(wardsQuery, (snapshot) => {
          const totalWards = snapshot.size;
          
          setStats(prevStats => ({
            ...prevStats,
            totalWards
          }));
        }, (error) => {
          console.error('Error listening to wards:', error);
        });
        
        unsubscribeFunctions.push(unsubscribeWards);

      } else if (user?.role === 'zonalAdmin' && user?.zoneId) {
        // Zonal Admin can only access users in their zone
        const usersQuery = query(
          collection(db, 'users'),
          where('zoneId', '==', user.zoneId)
        );
        
        const unsubscribeUsers = onSnapshot(usersQuery, (snapshot) => {
          const users : User[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as User);
          
          const totalUsers = users.length;
          const verifiedUsers = users.filter(user => user.verified === true).length;
          const pendingUsers = users.filter(user => user.verified === false || user.verified === null || user.verified === undefined).length;
          
          setStats(prevStats => ({
            ...prevStats,
            totalUsers,
            verifiedUsers,
            pendingUsers
          }));
          
          setLastUpdated(new Date());
          setIsConnected(true);
        }, (error) => {
          console.error('Error listening to zonal users:', error);
          setIsConnected(false);
        });
        
        unsubscribeFunctions.push(unsubscribeUsers);

        // Listen to wards in their zone
        const wardsQuery = query(
          collection(db, 'wards'),
          where('zoneId', '==', user.zoneId)
        );
        
        const unsubscribeWards = onSnapshot(wardsQuery, (snapshot) => {
          const totalWards = snapshot.size;
          
          setStats(prevStats => ({
            ...prevStats,
            totalWards
          }));
        }, (error) => {
          console.error('Error listening to zone wards:', error);
        });
        
        unsubscribeFunctions.push(unsubscribeWards);

      } else if (user?.role === 'wardAdmin' && user?.wardId) {
        // Ward Admin can only access users in their ward
        const usersQuery = query(
          collection(db, 'users'),
          where('wardId', '==', user.wardId)
        );
        
        const unsubscribeUsers = onSnapshot(usersQuery, (snapshot) => {
          const users : User[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as User);
          
          const totalUsers = users.length;
          const verifiedUsers = users.filter(user => user.verified === true).length;
          const pendingUsers = users.filter(user => user.verified === false || user.verified === null || user.verified === undefined).length;
          
          setStats(prevStats => ({
            ...prevStats,
            totalUsers,
            verifiedUsers,
            pendingUsers
          }));
          
          setLastUpdated(new Date());
          setIsConnected(true);
        }, (error) => {
          console.error('Error listening to ward users:', error);
          setIsConnected(false);
        });
        
        unsubscribeFunctions.push(unsubscribeUsers);
      }

    } catch (error) {
      console.error('Error setting up real-time listeners:', error);
      setIsConnected(false);
    }

    return unsubscribeFunctions;
  }, [user?.role, user?.zoneId, user?.wardId]);

  // Real-time activity feed
  const setupRealtimeActivities = useCallback(() => {
    try {
      let activitiesQuery;
      
      // Role-based activity access
      if (user?.role === 'superAdmin') {
        // SuperAdmin sees all activities
        activitiesQuery = query(
          collection(db, 'activities'),
          orderBy('timestamp', 'desc'),
          limit(10)
        );
      } else if (user?.role === 'zonalAdmin' && user?.zoneId) {
        // Zonal Admin sees activities in their zone
        activitiesQuery = query(
          collection(db, 'activities'),
          where('zoneId', '==', user.zoneId),
          orderBy('timestamp', 'desc'),
          limit(10)
        );
      } else if (user?.role === 'wardAdmin' && user?.wardId) {
        // Ward Admin sees activities in their ward
        activitiesQuery = query(
          collection(db, 'activities'),
          where('wardId', '==', user.wardId),
          orderBy('timestamp', 'desc'),
          limit(10)
        );
      } else {
        // No activities for other roles
        return () => {};
      }
      
      const unsubscribe = onSnapshot(activitiesQuery, (snapshot) => {
        const newActivities = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            action: data.action,
            time: data.timestamp?.toDate() || new Date(),
            zone: data.zone || 'Unknown Zone',
            userId: data.userId,
            userName: data.userName
          };
        });
        
        setActivities(newActivities);
        setLastUpdated(new Date());
      }, (error) => {
        console.error('Error listening to activities:', error);
        // Don't show activities if permission denied
        setActivities([]);
      });
      
      return unsubscribe;
    } catch (error) {
      console.error('Error setting up activities listener:', error);
      return () => {};
    }
  }, [user?.role, user?.zoneId, user?.wardId]);

  // Initialize real-time listeners
  useEffect(() => {
    const statsUnsubscribers = setupRealtimeStats();
    const activitiesUnsubscriber = setupRealtimeActivities();
    
    // Store all unsubscribe functions
    unsubscribeRefs.current = [
      ...statsUnsubscribers,
      activitiesUnsubscriber
    ];
    
    setLoading(false);

    // Cleanup function
    return () => {
      unsubscribeRefs.current.forEach(unsubscribe => {
        if (typeof unsubscribe === 'function') {
          unsubscribe();
        }
      });
    };
  }, [setupRealtimeStats, setupRealtimeActivities]);

  // Connection status monitoring
  useEffect(() => {
    const checkConnection = () => {
      setIsConnected(navigator.onLine);
    };

    window.addEventListener('online', checkConnection);
    window.addEventListener('offline', checkConnection);

    return () => {
      window.removeEventListener('online', checkConnection);
      window.removeEventListener('offline', checkConnection);
    };
  }, []);

  // Auto-refresh fallback for offline/error scenarios
  useEffect(() => {
    if (!isConnected) {
      const fallbackInterval = setInterval(async () => {
        try {
          // Role-based fallback data fetching
          if (user?.role === 'superAdmin') {
            const usersSnapshot = await getDocs(collection(db, 'users'));
            const users : User[] = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as User); ;
            
            const totalUsers = users.length;
            const verifiedUsers = users.filter(user => user.verified === true).length;
            const pendingUsers = users.filter(user => user.verified === false || user.verified === null || user.verified === undefined).length;
            
            setStats(prevStats => ({
              ...prevStats,
              totalUsers,
              verifiedUsers,
              pendingUsers
            }));
            
          } else if (user?.role === 'zonalAdmin' && user?.zoneId) {
            const usersQuery = query(
              collection(db, 'users'),
              where('zoneId', '==', user.zoneId)
            );
            const usersSnapshot = await getDocs(usersQuery);
            const users : User[] = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as User);
            
            const totalUsers = users.length;
            const verifiedUsers = users.filter(user => user.verified === true).length;
            const pendingUsers = users.filter(user => user.verified === false || user.verified === null || user.verified === undefined).length;
            
            setStats(prevStats => ({
              ...prevStats,
              totalUsers,
              verifiedUsers,
              pendingUsers
            }));
            
          } else if (user?.role === 'wardAdmin' && user?.wardId) {
            const usersQuery = query(
              collection(db, 'users'),
              where('wardId', '==', user.wardId)
            );
            const usersSnapshot = await getDocs(usersQuery);
            const users : User[] = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as User);
            
            const totalUsers = users.length;
            const verifiedUsers = users.filter(user => user.verified === true).length;
            const pendingUsers = users.filter(user => user.verified === false || user.verified === null || user.verified === undefined).length;
            
            setStats(prevStats => ({
              ...prevStats,
              totalUsers,
              verifiedUsers,
              pendingUsers
            }));
          }
          
          setLastUpdated(new Date());
          setIsConnected(true);
        } catch (error) {
          console.error('Fallback data fetch failed:', error);
        }
      }, 30000); // Retry every 30 seconds

      return () => clearInterval(fallbackInterval);
    }
  }, [isConnected, user?.role, user?.zoneId, user?.wardId]);

  const getVerificationRate = () => {
    if (stats.totalUsers === 0) return 0;
    return Math.round((stats.verifiedUsers / stats.totalUsers) * 100);
  };

  const getRoleBasedStats = () => {
    // Base stats for all admin roles
    const baseStats = [
      {
        title: user?.role === 'zonalAdmin' ? 'Zone Members' : user?.role === 'wardAdmin' ? 'Ward Members' : 'Total Members',
        value: stats.totalUsers.toLocaleString(),
        change: '+12.5% from last month',
        changeType: 'positive' as const,
        icon: Users,
      },
      {
        title: 'Verified Members',
        value: stats.verifiedUsers.toLocaleString(),
        change: `${getVerificationRate()}% verification rate`,
        changeType: 'positive' as const,
        icon: UserCheck,
      },
      {
        title: 'Pending Approvals',
        value: stats.pendingUsers.toLocaleString(),
        change: '-5.2% from last week',
        changeType: 'positive' as const,
        icon: Clock,
      },
    ];

    // Add role-specific stats
    if (user?.role === 'superAdmin') {
      return [
        ...baseStats,
        {
          title: 'Total Zones',
          value: stats.totalZones.toString(),
          change: '+2 new zones',
          changeType: 'positive' as const,
          icon: MapPin,
        },
        {
          title: 'Total Wards',
          value: stats.totalWards.toString(),
          change: '+8 new wards',
          changeType: 'positive' as const,
          icon: Building2,
        },
      ];
    } else if (user?.role === 'zonalAdmin') {
      return [
        ...baseStats,
        {
          title: 'Zone Wards',
          value: stats.totalWards.toString(),
          change: '+1 new ward',
          changeType: 'positive' as const,
          icon: Building2,
        },
      ];
    }

    // Ward Admin and other roles just get base stats
    return baseStats;
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return `${diffInSeconds} seconds ago`;
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    return `${Math.floor(diffInSeconds / 86400)} days ago`;
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(5)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-1/3 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-2/3"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </DashboardLayout>
    );
  }

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
            <h1 className="text-3xl font-bold text-gray-900">
              Welcome back, {user?.name}
            </h1>
            <p className="text-gray-600 mt-1">
              Here&apos;s what&apos;s happening with your party registration system.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge 
              variant={isConnected ? "default" : "destructive"} 
              className="hidden sm:inline-flex"
            >
              {isConnected ? (
                <>
                  <Wifi className="w-4 h-4 mr-1" />
                  Live Data
                </>
              ) : (
                <>
                  <WifiOff className="w-4 h-4 mr-1" />
                  Offline
                </>
              )}
            </Badge>
            <span className="text-xs text-gray-500 hidden md:block">
              Updated {formatTimeAgo(lastUpdated)}
            </span>
          </div>
        </motion.div>

        {/* Connection Warning */}
        {!isConnected && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-yellow-50 border border-yellow-200 rounded-lg p-4"
          >
            <div className="flex items-center">
              <WifiOff className="h-5 w-5 text-yellow-600 mr-2" />
              <span className="text-yellow-800">
                Connection lost. Data may not be up to date. Retrying automatically...
              </span>
            </div>
          </motion.div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {getRoleBasedStats().map((stat, index) => (
            <StatCard key={stat.title} {...stat} index={index} />
          ))}
        </div>

        {/* Charts and Additional Info */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Verification Progress */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5 text-blue-600" />
                  Verification Progress
                  <Badge variant="outline" className="ml-auto text-xs">
                    Live
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Verified Members</span>
                    <span>{getVerificationRate()}%</span>
                  </div>
                  <Progress value={getVerificationRate()} className="h-2" />
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-700">
                      {stats.verifiedUsers}
                    </div>
                    <div className="text-green-600">Verified</div>
                  </div>
                  <div className="text-center p-3 bg-yellow-50 rounded-lg">
                    <div className="text-2xl font-bold text-yellow-700">
                      {stats.pendingUsers}
                    </div>
                    <div className="text-yellow-600">Pending</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Real-time Activity Feed */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-blue-600" />
                  Recent Activity
                  <Badge variant="outline" className="ml-auto text-xs">
                    Live
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 max-h-80 overflow-y-auto">
                  {activities.length > 0 ? (
                    activities.map((activity) => (
                      <motion.div 
                        key={activity.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center justify-between py-2 border-b last:border-b-0"
                      >
                        <div>
                          <p className="text-sm font-medium">{activity.action}</p>
                          <p className="text-xs text-gray-500">{activity.zone}</p>
                          {activity.userName && (
                            <p className="text-xs text-gray-400">by {activity.userName}</p>
                          )}
                        </div>
                        <span className="text-xs text-gray-400">
                          {formatTimeAgo(activity.time)}
                        </span>
                      </motion.div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No recent activity</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </DashboardLayout>
  );
}