"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
  Shield,
  User,
  Mail,
  Lock,
  Phone,
  MapPin,
  FileText,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase"; // Adjust path to your Firebase config
import { localGovt } from "@/types";

interface Zone {
  id: string;
  name: string;
  wardId?: string;
  description?: string;
  adminId?: string;
  createdAt?: any;
  updatedAt?: any;
}

interface Ward {
  id: string;
  name: string;
  description?: string;
  localGovt: string;
  adminId?: string;
  createdAt?: any;
  updatedAt?: any;
}

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    name: "",
    dob: "",
    email: "",
    password: "",
    phone: "",
    address: "",
    qualification: "",
    occupation: "",
    idType: "",
    idNumber: "",
    localGovt: "",
    zoneId: "",
    wardId: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [zones, setZones] = useState<Zone[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);
  const [localGovts, setLocalGovts] = useState<localGovt[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [picture, setPicture] = useState<File | null>(null);
  const [picturePreview, setPicturePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);


  const { signUp } = useAuth();
  const router = useRouter()

  //fetch local govt
  const fetchLocalGvt = async () => {
    try {
      const localGovtRef = collection(db, "localGovt");
      const localGovtQuery = query(localGovtRef);
      const localGovtSnapshot = await getDocs(localGovtQuery);
      const localGovtData: localGovt[] = [];
      localGovtSnapshot.forEach((doc) => {
        localGovtData.push({
          id: doc.id,
          ...doc.data(),
        } as localGovt);
      });
   
      setLocalGovts(localGovtData);
    } catch (error) {
      console.error("Error fetching local govts:", error);
      setError("Failed to load local govts. Please refresh the page.");
    }

  };



  // Fetch zones from Firestore
  const fetchZones = async () => {
    try {
      const zonesRef = collection(db, "zones");
      const zonesQuery = query(zonesRef, orderBy("name", "asc"));
      const zonesSnapshot = await getDocs(zonesQuery);

      const zonesData: Zone[] = [];
      zonesSnapshot.forEach((doc) => {
        zonesData.push({
          id: doc.id,
          ...doc.data(),
        } as Zone);
      });

      setZones(zonesData);
    } catch (error) {
      console.error("Error fetching zones:", error);
      setError("Failed to load zones. Please refresh the page.");
    }
  };

  // Fetch wards from Firestore
  const fetchWards = async () => {
    try {
      const wardsRef = collection(db, "wards");
      const wardsQuery = query(wardsRef, orderBy("name", "asc"));
      const wardsSnapshot = await getDocs(wardsQuery);

      const wardsData: Ward[] = [];
      wardsSnapshot.forEach((doc) => {
        wardsData.push({
          id: doc.id,
          ...doc.data(),
        } as Ward);
      });

      setWards(wardsData);
    } catch (error) {
      console.error("Error fetching wards:", error);
      setError("Failed to load wards. Please refresh the page.");
    }
  };

  // Load zones and wards on component mount
  useEffect(() => {
    const loadData = async () => {
      setLoadingData(true);
      await Promise.all([fetchZones(), fetchWards(), fetchLocalGvt()]);
      setLoadingData(false);
    };

    loadData();
  }, []);

  // Filter wards based on selected zone
  const availableWards = wards.filter(
    (ward) => ward.localGovt === formData.localGovt
  );

  // Filter zones based on selected ward
  const availableZones = zones.filter(
    (zone) => zone.wardId === formData.wardId
  );



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

 

    // Validation
    if (!formData.zoneId) {
      setError("Please select a zone");
      setLoading(false);
      return;
    }

    if (!formData.wardId) {
      setError("Please select a ward");
      setLoading(false);
      return;
    }

    try {
      await signUp(formData.email, formData.password, {
       name: formData.name,
        dob: formData.dob,
        phone: formData.phone,
        address: formData.address,
        qualification: formData.qualification,
        occupation: formData.occupation,
        idType: formData.idType,
        idNumber: formData.idNumber,
        localGovt: formData.localGovt,
        zoneId: formData.zoneId,
        wardId: formData.wardId,
       // picture: picture, 
        role: "member",
      });

      setSuccess(true);
      setTimeout(() => {
        router.push("/login");
      }, 2000);
    } catch (error: any) {
      setError(error.message || "Failed to register");
    } finally {
      setLoading(false);
    }
  };


   const handlePictureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPicture(file);
      setPicturePreview(URL.createObjectURL(file));
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    // Reset ward selection when zone changes
    if (field === "zoneId") {
      setFormData((prev) => ({ ...prev, wardId: "" }));
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
                transition={{ delay: 0.2, type: "spring" }}
                className="mx-auto w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mb-4"
              >
                <Shield className="w-8 h-8 text-white" />
              </motion.div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Registration Successful!
              </h2>
              <p className="text-gray-600 mb-4">
                Your application has been submitted for review. You&apos;ll be
                notified once approved.
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
              transition={{ delay: 0.2, type: "spring" }}
              className="mx-auto w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center"
            >
              <Shield className="w-8 h-8 text-white" />
            </motion.div>
            <div>
              <CardTitle className="text-2xl font-bold text-gray-900">
                Join The Movement
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
                  animate={{ opacity: 1, height: "auto" }}
                >
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                </motion.div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name (Surname first)</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) =>
                        handleInputChange("name", e.target.value)
                      }
                      className="pl-10"
                      placeholder="John Doe"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dob">Date of birth (dd-mm-yyyy)</Label>
                  <div className="relative">
                    <Input
                      id="dob"
                      type="text"
                      value={formData.dob}
                      onChange={(e) => handleInputChange("dob", e.target.value)}
                      className="pl-4"
                      placeholder="01-01-1990"
                      required
                    />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Username (Email Address)</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) =>
                        handleInputChange("email", e.target.value)
                      }
                      className="pl-10"
                      placeholder="john@example.com"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="password"
                      type="password"
                      value={formData.password}
                      onChange={(e) =>
                        handleInputChange("password", e.target.value)
                      }
                      className="pl-10"
                      placeholder="Enter password"
                      required
                    />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone number</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) =>
                        handleInputChange("phone", e.target.value)
                      }
                      className="pl-10"
                      placeholder="+1 (555) 123-4567"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="qualification">Qualification</Label>
                  <div className="relative">
                    <Input
                      id="qualification"
                      value={formData.qualification}
                      onChange={(e) =>
                        handleInputChange("qualification", e.target.value)
                      }
                      className="pl-4"
                      placeholder="B.Sc, HND, etc."
                      required
                    />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="occupation">Occupation</Label>
                  <div className="relative">
                    <Input
                      id="occupation"
                      value={formData.occupation}
                      onChange={(e) =>
                        handleInputChange("occupation", e.target.value)
                      }
                      className="pl-4"
                      placeholder="Engineer, Teacher, etc."
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Contact address</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Textarea
                      id="address"
                      value={formData.address}
                      onChange={(e) =>
                        handleInputChange("address", e.target.value)
                      }
                      className="pl-10"
                      placeholder="123 Main St, City, State, ZIP"
                      required
                    />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="idType">Mode of Identification</Label>
                  <Select
                    value={formData.idType}
                    onValueChange={(value) =>
                      handleInputChange("idType", value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select ID Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="International passport">
                        International passport
                      </SelectItem>
                      <SelectItem value="National ID">National ID</SelectItem>
                      <SelectItem value="Driver license">
                        Driver license
                      </SelectItem>
                      <SelectItem value="NIN">NIN</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="idNumber">ID. Number</Label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="idNumber"
                      value={formData.idNumber}
                      onChange={(e) =>
                        handleInputChange("idNumber", e.target.value)
                      }
                      className="pl-10"
                      placeholder="ID123456789"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="localGovt">Local Government</Label>
                  <Select
                    value={formData.localGovt}
                    onValueChange={(value) =>
                      handleInputChange("localGovt", value)
                    }
                    disabled={loadingData}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          loadingData
                            ? "Loading local governments..."
                            : "Select local government"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {localGovts.map((localGovt) => (
                        <SelectItem key={Math.random()} value={localGovt.name}>
                          {localGovt.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ward">Ward</Label>
                  <Select
                    value={formData.wardId}
                    onValueChange={(value) =>
                      handleInputChange("wardId", value)
                    }
                    disabled={!formData.localGovt || loadingData}
                    
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          loadingData
                            ? "Loading wards..."
                            : !formData.localGovt
                            ? "Select local government first"
                            : "Select Ward"
                        }
                      />
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
                <div className="space-y-2">
                  <Label htmlFor="zone">Zone</Label>
                  <Select
                    value={formData.zoneId}
                    onValueChange={(value) =>
                      handleInputChange("zoneId", value)
                    }
                    disabled={!formData.wardId || loadingData}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          loadingData ? "Loading zones..." : !formData.wardId ? "Select ward first" : "Select Zone" 
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {availableZones.map((zone) => (
                        <SelectItem key={zone.id} value={zone.id}>
                          {zone.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="picture">Upload Picture</Label>
                  <div className="flex items-center gap-4">
                    <input
                      ref={fileInputRef}
                      id="picture"
                      type="file"
                      accept="image/*"
                      onChange={handlePictureChange}
                      className="block w-full text-sm text-gray-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-full file:border-0
                file:text-sm file:font-semibold
                file:bg-blue-50 file:text-blue-700
                hover:file:bg-blue-100"
                    />
                    {picturePreview && (
                      <img
                        src={picturePreview}
                        alt="Preview"
                        className="w-16 h-16 object-cover rounded-full border"
                      />
                    )}
                  </div>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={loading || loadingData}
              >
                {loading
                  ? "Registering..."
                  : loadingData
                  ? "Loading..."
                  : "Register"}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                Already have an account?{" "}
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
