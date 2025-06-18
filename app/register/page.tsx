'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Shield, User, Mail, Lock, Phone, MapPin, FileText } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase'; // Adjust path to your Firebase config

interface Zone {
  id: string;
  name: string;
  description?: string;
  adminId?: string;
  createdAt?: any;
  updatedAt?: any;
}

interface Ward {
  id: string;
  name: string;
  description?: string;
  zoneId: string;
  adminId?: string;
  createdAt?: any;
  updatedAt?: any;
}

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    address: '',
    idNumber: '',
    zoneId: '',
    wardId: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [zones, setZones] = useState<Zone[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  
  const { signUp } = useAuth();
  const router = useRouter();

  // Fetch zones from Firestore
  const fetchZones = async () => {
    try {
      const zonesRef = collection(db, 'zones');
      const zonesQuery = query(zonesRef, orderBy('name', 'asc'));
      const zonesSnapshot = await getDocs(zonesQuery);
      
      const zonesData: Zone[] = [];
      zonesSnapshot.forEach((doc) => {
        zonesData.push({
          id: doc.id,
          ...doc.data()
        } as Zone);
      });
      
      setZones(zonesData);
    } catch (error) {
      console.error('Error fetching zones:', error);
      setError('Failed to load zones. Please refresh the page.');
    }
  };

  // Fetch wards from Firestore
  const fetchWards = async () => {
    try {
      const wardsRef = collection(db, 'wards');
      const wardsQuery = query(wardsRef, orderBy('name', 'asc'));
      const wardsSnapshot = await getDocs(wardsQuery);
      
      const wardsData: Ward[] = [];
      wardsSnapshot.forEach((doc) => {
        wardsData.push({
          id: doc.id,
          ...doc.data()
        } as Ward);
      });
      
      setWards(wardsData);
    } catch (error) {
      console.error('Error fetching wards:', error);
      setError('Failed to load wards. Please refresh the page.');
    }
  };

  // Load zones and wards on component mount
  useEffect(() => {
    const loadData = async () => {
      setLoadingData(true);
      await Promise.all([fetchZones(), fetchWards()]);
      setLoadingData(false);
    };
    
    loadData();
  }, []);

  // Filter wards based on selected zone
  const availableWards = wards.filter(ward => ward.zoneId === formData.zoneId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Validation
    if (!formData.zoneId) {
      setError('Please select a zone');
      setLoading(false);
      return;
    }

    if (!formData.wardId) {
      setError('Please select a ward');
      setLoading(false);
      return;
    }

    try {
      await signUp(formData.email, formData.password, {
        name: formData.name,
        phone: formData.phone,
        address: formData.address,
        idNumber: formData.idNumber,
        zoneId: formData.zoneId,
        wardId: formData.wardId,
        role: 'member',
      });

      setSuccess(true);
      setTimeout(() => {
        router.push('/login');
      }, 2000);
    } catch (error: any) {
      setError(error.message || 'Failed to register');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Reset ward selection when zone changes
    if (field === 'zoneId') {
      setFormData(prev => ({ ...prev, wardId: '' }));
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-green-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <Card className="border-0 shadow-xl">
            <CardContent className="p-8">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: 'spring' }}
                className="mx-auto w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mb-4"
              >
                <Shield className="w-8 h-8 text-white" />
              </motion.div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Registration Successful!</h2>
              <p className="text-gray-600 mb-4">
                Your application has been submitted for review. You&apos;ll be notified once approved.
              </p>
              <p className="text-sm text-gray-500">Redirecting to login...</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-2xl"
      >
        <Card className="border-0 shadow-xl">
          <CardHeader className="text-center space-y-4">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring' }}
              className="mx-auto w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center"
            >
              <Shield className="w-8 h-8 text-white" />
            </motion.div>
            <div>
              <CardTitle className="text-2xl font-bold text-gray-900">
                Join Our Party
              </CardTitle>
              <CardDescription className="text-gray-600">
                Register as a member to participate in party activities
              </CardDescription>
            </div>
          </CardHeader>
          
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                >
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                </motion.div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      className="pl-10"
                      placeholder="John Doe"
                      required
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      className="pl-10"
                      placeholder="john@example.com"
                      required
                    />
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="password"
                      type="password"
                      value={formData.password}
                      onChange={(e) => handleInputChange('password', e.target.value)}
                      className="pl-10"
                      placeholder="Enter password"
                      required
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                      className="pl-10"
                      placeholder="+1 (555) 123-4567"
                      required
                    />
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Textarea
                    id="address"
                    value={formData.address}
                    onChange={(e) => handleInputChange('address', e.target.value)}
                    className="pl-10"
                    placeholder="123 Main St, City, State, ZIP"
                    required
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="idNumber">ID Number</Label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="idNumber"
                      value={formData.idNumber}
                      onChange={(e) => handleInputChange('idNumber', e.target.value)}
                      className="pl-10"
                      placeholder="ID123456789"
                      required
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="zone">Zone</Label>
                  <Select 
                    value={formData.zoneId} 
                    onValueChange={(value) => handleInputChange('zoneId', value)}
                    disabled={loadingData}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={loadingData ? "Loading zones..." : "Select Zone"} />
                    </SelectTrigger>
                    <SelectContent>
                      {zones.map((zone) => (
                        <SelectItem key={zone.id} value={zone.id}>
                          {zone.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="ward">Ward</Label>
                  <Select 
                    value={formData.wardId} 
                    onValueChange={(value) => handleInputChange('wardId', value)}
                    disabled={!formData.zoneId || loadingData}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={
                        loadingData 
                          ? "Loading wards..." 
                          : !formData.zoneId 
                            ? "Select zone first" 
                            : "Select Ward"
                      } />
                    </SelectTrigger>
                    <SelectContent>
                      {availableWards.map((ward) => (
                        <SelectItem key={ward.id} value={ward.id}>
                          {ward.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <Button
                type="submit"
                className="w-full"
                disabled={loading || loadingData}
              >
                {loading ? 'Registering...' : loadingData ? 'Loading...' : 'Register'}
              </Button>
            </form>
            
            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                Already have an account?{' '}
                <Link 
                  href="/login" 
                  className="font-medium text-blue-600 hover:text-blue-500"
                >
                  Sign in
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}