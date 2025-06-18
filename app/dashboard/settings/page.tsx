"use client";
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { 
  Settings, 
  User, 
  Shield, 
  LogOut, 
  Save, 
  Camera, 
  Mail, 
  Phone, 
  MapPin,
  Bell,
  Lock,
  Eye,
  EyeOff,
  CheckCircle,
  AlertTriangle,
  Loader2
} from 'lucide-react';

// Firebase imports
import { auth, db } from '@/lib/firebase';
import { 
  updatePassword, 
  reauthenticateWithCredential, 
  EmailAuthProvider,
  signOut, 
  onAuthStateChanged
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  updateDoc, 
  collection, 
  addDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { 
  getStorage, 
  ref, 
  uploadBytes, 
  getDownloadURL 
} from 'firebase/storage';
import { DashboardLayout } from '@/components/layout/DashboardLayout';

export default function FirebaseSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const [profileData, setProfileData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    role: '',
    status: '',
    profilePicture: '',
    idNumber: '',
    zoneId: '',
    wardId: '',
    verified: false,
    appointedAt: null,
    appointedBy: '',
    createdAt: null,
    updatedAt: null
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  // Load user data from Firebase
  useEffect(() => {
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    try {
      setLoading(true);
    
  // Wait for auth to initialize
  await new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
  
  const user = auth.currentUser;
 
      
      if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setProfileData({
            name: userData.name || '',
            email: userData.email || user.email || '',
            phone: userData.phone || '',
            address: userData.address || '',
            role: userData.role || '',
            status: userData.status || '',
            profilePicture: userData.profilePicture || '',
            idNumber: userData.idNumber || '',
            zoneId: userData.zoneId || '',
            wardId: userData.wardId || '',
            verified: userData.verified || false,
            appointedAt: userData.appointedAt,
            appointedBy: userData.appointedBy || '',
            createdAt: userData.createdAt,
            updatedAt: userData.updatedAt
          });
        }
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      setMessage({ type: 'error', text: 'Failed to load profile data' });
    } finally {
      setLoading(false);
    }
  };

  

  const handleProfileUpdate = async () => {
    try {
      setSaving(true);
      const user = auth.currentUser;
      
      if (user) {
        await updateDoc(doc(db, 'users', user.uid), {
          name: profileData.name,
          phone: profileData.phone,
          address: profileData.address,
          updatedAt: serverTimestamp()
        });
        
        // Log the profile update
        await addDoc(collection(db, 'audit_logs'), {
          userId: user.uid,
          action: 'profile_updated',
          timestamp: serverTimestamp(),
          details: {
            fieldsUpdated: ['name', 'phone', 'address']
          }
        });
        
        setMessage({ type: 'success', text: 'Profile updated successfully!' });
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      setMessage({ type: 'error', text: 'Failed to update profile' });
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessage({ type: 'error', text: 'New passwords do not match' });
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters' });
      return;
    }

    try {
      setSaving(true);
      const user = auth.currentUser;
      
      if (user && user.email) {
        // Re-authenticate user before changing password
        const credential = EmailAuthProvider.credential(
          user.email,
          passwordData.currentPassword
        );
        
        await reauthenticateWithCredential(user, credential);
        await updatePassword(user, passwordData.newPassword);
        
        // Log password change
        await addDoc(collection(db, 'audit_logs'), {
          userId: user.uid,
          action: 'password_changed',
          timestamp: serverTimestamp(),
          details: {
            userAgent: navigator.userAgent
          }
        });
        
        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
        setMessage({ type: 'success', text: 'Password changed successfully!' });
      }
    } catch (error:any) {
      console.error('Error changing password:', error);
      if (error.code === 'auth/wrong-password') {
        setMessage({ type: 'error', text: 'Current password is incorrect' });
      } else {
        setMessage({ type: 'error', text: 'Failed to change password' });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleProfilePictureUpload = async (event: any) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file
    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: 'Please select an image file' });
      return;
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      setMessage({ type: 'error', text: 'Image must be less than 5MB' });
      return;
    }

    try {
      setUploading(true);
      const user = auth.currentUser;
      
      if (user) {
        const storage = getStorage();
        const storageRef = ref(storage, `profile-pictures/${user.uid}/${Date.now()}_${file.name}`);
        
        // Upload file to Firebase Storage
        const snapshot = await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(snapshot.ref);
        
        // Update user document with new profile picture URL
        await updateDoc(doc(db, 'users', user.uid), {
          profilePicture: downloadURL,
          updatedAt: serverTimestamp()
        });
        
        // Log profile picture update
        await addDoc(collection(db, 'audit_logs'), {
          userId: user.uid,
          action: 'profile_picture_updated',
          timestamp: serverTimestamp(),
          details: {
            imageUrl: downloadURL
          }
        });
        
        setProfileData(prev => ({ ...prev, profilePicture: downloadURL }));
        setMessage({ type: 'success', text: 'Profile picture updated successfully!' });
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      setMessage({ type: 'error', text: 'Failed to upload image' });
    } finally {
      setUploading(false);
    }
  };

  const handleLogoutAllSessions = async () => {
    try {
      const user = auth.currentUser;
      
      if (user) {
        // Log the logout action
        await addDoc(collection(db, 'audit_logs'), {
          userId: user.uid,
          action: 'logout_all_sessions',
          timestamp: serverTimestamp(),
          details: {
            userAgent: navigator.userAgent
          }
        });
        
        await signOut(auth);
        setMessage({ type: 'success', text: 'Logged out from all devices' });
      }
    } catch (error) {
      console.error('Error logging out:', error);
      setMessage({ type: 'error', text: 'Failed to logout' });
    }
  };

  // Clear message after 5 seconds
  useEffect(() => {
    if (message.text) {
      const timer = setTimeout(() => {
        setMessage({ type: '', text: '' });
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  // Format date for display
  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Not available';
    if (typeof timestamp === 'object' && 'seconds' in timestamp) {
      return new Date(timestamp.seconds * 1000).toLocaleString();
    }
    return new Date(timestamp).toLocaleString();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Loading your settings...</p>
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout>
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-600 rounded-lg">
              <Settings className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
              <p className="text-gray-600">Manage your account and system preferences</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-blue-100 text-blue-800 border-blue-200">
              <Shield className="h-3 w-3 mr-1" />
              {profileData.role || 'User'}
            </Badge>
            <Badge variant="outline" className={`${
              profileData.status === 'active' 
                ? 'text-green-700 border-green-200 bg-green-50' 
                : 'text-red-700 border-red-200 bg-red-50'
            }`}>
              <CheckCircle className="h-3 w-3 mr-1" />
              {profileData.status || 'Unknown'}
            </Badge>
            {profileData.verified && (
              <Badge variant="outline" className="text-blue-700 border-blue-200 bg-blue-50">
                <CheckCircle className="h-3 w-3 mr-1" />
                Verified
              </Badge>
            )}
          </div>
        </div>

        {/* Message Display */}
        {message.text && (
          <div className={`mb-6 p-4 rounded-lg border ${
            message.type === 'success' 
              ? 'bg-green-50 border-green-200 text-green-800' 
              : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            <div className="flex items-center gap-2">
              {message.type === 'success' ? 
                <CheckCircle className="h-4 w-4" /> : 
                <AlertTriangle className="h-4 w-4" />
              }
              {message.text}
            </div>
          </div>
        )}

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 lg:w-auto lg:grid-cols-2 bg-white border shadow-sm">
            <TabsTrigger value="profile" className="flex items-center gap-2 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">
              <User className="h-4 w-4" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="security" className="flex items-center gap-2 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">
              <Shield className="h-4 w-4" />
              Security
            </TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Profile Picture Card */}
              <Card className="lg:col-span-1 border-0 shadow-lg bg-white/80 backdrop-blur-sm">
                <CardHeader className="text-center pb-4">
                  <CardTitle className="text-lg">Profile Picture</CardTitle>
                </CardHeader>
                <CardContent className="text-center space-y-4">
                  <div className="relative inline-block">
                    <Avatar className="h-32 w-32 border-4 border-white shadow-lg">
                      <AvatarImage src={profileData.profilePicture} />
                      <AvatarFallback className="text-2xl bg-blue-100 text-blue-700">
                        {profileData.name?.split(' ').map(n => n[0]).join('') || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <label htmlFor="profile-upload" className="absolute -bottom-2 -right-2 cursor-pointer">
                      <div className="rounded-full h-10 w-10 bg-blue-600 hover:bg-blue-700 flex items-center justify-center">
                        {uploading ? (
                          <Loader2 className="h-4 w-4 text-white animate-spin" />
                        ) : (
                          <Camera className="h-4 w-4 text-white" />
                        )}
                      </div>
                    </label>
                    <input
                      id="profile-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleProfilePictureUpload}
                      disabled={uploading}
                      className="hidden"
                    />
                  </div>
                  <div className="space-y-2">
                    <p className="font-semibold text-gray-900">{profileData.name}</p>
                    <p className="text-sm text-gray-600">{profileData.email}</p>
                    {profileData.idNumber && (
                      <p className="text-xs text-gray-500">ID: {profileData.idNumber}</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Profile Information */}
              <Card className="lg:col-span-2 border-0 shadow-lg bg-white/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5 text-blue-600" />
                    Personal Information
                  </CardTitle>
                  <CardDescription>Update your personal details and contact information</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-sm font-medium">Full Name</Label>
                    <Input
                      id="name"
                      value={profileData.name}
                      onChange={(e) => setProfileData({...profileData, name: e.target.value})}
                      className="border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm font-medium flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      Email Address
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={profileData.email}
                      disabled
                      className="border-gray-200 bg-gray-50"
                    />
                    <p className="text-xs text-gray-500">Email cannot be changed from this page</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-sm font-medium flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      Phone Number
                    </Label>
                    <Input
                      id="phone"
                      value={profileData.phone}
                      onChange={(e) => setProfileData({...profileData, phone: e.target.value})}
                      className="border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="address" className="text-sm font-medium flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      Address
                    </Label>
                    <Input
                      id="address"
                      value={profileData.address}
                      onChange={(e) => setProfileData({...profileData, address: e.target.value})}
                      className="border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>

                  {/* Read-only fields */}
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-gray-600">Zone ID</Label>
                      <Input
                        value={profileData.zoneId || 'Not assigned'}
                        disabled
                        className="border-gray-200 bg-gray-50 text-gray-600"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-gray-600">Ward ID</Label>
                      <Input
                        value={profileData.wardId || 'Not assigned'}
                        disabled
                        className="border-gray-200 bg-gray-50 text-gray-600"
                      />
                    </div>
                  </div>

                  <Button 
                    onClick={handleProfileUpdate} 
                    disabled={saving}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    {saving ? 'Saving...' : 'Save Changes'}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Change Password */}
              <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lock className="h-5 w-5 text-red-600" />
                    Change Password
                  </CardTitle>
                  <CardDescription>Update your account password</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword" className="text-sm font-medium">Current Password</Label>
                    <div className="relative">
                      <Input
                        id="currentPassword"
                        type={showPassword ? "text" : "password"}
                        value={passwordData.currentPassword}
                        onChange={(e) => setPasswordData({...passwordData, currentPassword: e.target.value})}
                        className="border-gray-200 focus:border-blue-500 focus:ring-blue-500 pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="newPassword" className="text-sm font-medium">New Password</Label>
                    <div className="relative">
                      <Input
                        id="newPassword"
                        type={showNewPassword ? "text" : "password"}
                        value={passwordData.newPassword}
                        onChange={(e) => setPasswordData({...passwordData, newPassword: e.target.value})}
                        className="border-gray-200 focus:border-blue-500 focus:ring-blue-500 pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                      >
                        {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword" className="text-sm font-medium">Confirm New Password</Label>
                    <div className="relative">
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        value={passwordData.confirmPassword}
                        onChange={(e) => setPasswordData({...passwordData, confirmPassword: e.target.value})}
                        className="border-gray-200 focus:border-blue-500 focus:ring-blue-500 pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  <Button 
                    onClick={handlePasswordChange} 
                    disabled={saving}
                    className="w-full bg-red-600 hover:bg-red-700"
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Lock className="h-4 w-4 mr-2" />
                    )}
                    {saving ? 'Changing...' : 'Change Password'}
                  </Button>
                </CardContent>
              </Card>

              {/* Account Security */}
              <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-orange-600" />
                    Account Security
                  </CardTitle>
                  <CardDescription>Your account security information</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-4">
                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-full">
                          <CheckCircle className="h-4 w-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-blue-900">Account Status</p>
                          <p className="text-xs text-blue-700">
                            {profileData.verified ? 'Verified Account' : 'Unverified Account'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {profileData.appointedAt && (
                      <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-green-100 rounded-full">
                            <Bell className="h-4 w-4 text-green-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-green-900">Appointed</p>
                            <p className="text-xs text-green-700">
                              {formatDate(profileData.appointedAt)}
                            </p>
                            {profileData.appointedBy && (
                              <p className="text-xs text-green-600">
                                By: {profileData.appointedBy}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-gray-100 rounded-full">
                          <CheckCircle className="h-4 w-4 text-gray-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">Account Created</p>
                          <p className="text-xs text-gray-700">
                            {formatDate(profileData.createdAt)}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="border-t pt-4">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" className="w-full">
                            <LogOut className="h-4 w-4 mr-2" />
                            Logout from All Devices
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Logout from All Devices</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will log you out from all devices and sessions. You&apos;ll need to log in again on all your devices.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleLogoutAllSessions} className="bg-red-600 hover:bg-red-700">
                              Logout All Sessions
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
    </DashboardLayout>
  );
}