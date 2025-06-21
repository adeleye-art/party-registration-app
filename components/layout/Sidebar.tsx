'use client';

import { motion } from 'framer-motion';
import { 
  Home, 
  Users, 
  MapPin, 
  Building2, 
  UserCheck, 
  Settings,
  Shield,
  FileText,
  Upload
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

interface NavigationItem {
  name: string;
  href: string;
  icon: React.ElementType;
  roles: string[];
}

const navigation: NavigationItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: Home, roles: ['superAdmin', 'zonalAdmin', 'wardAdmin'] },
  { name: 'Users', href: '/dashboard/users', icon: Users, roles: ['superAdmin', 'zonalAdmin', 'wardAdmin'] },
  { name: 'Zones', href: '/dashboard/zones', icon: MapPin, roles: ['superAdmin', 'zonalAdmin', 'wardAdmin'] },
  { name: 'Wards', href: '/dashboard/wards', icon: Building2, roles: ['superAdmin', 'WardAdmin'] },
  { name: 'Pending Approvals', href: '/dashboard/approvals', icon: UserCheck, roles: ['superAdmin', 'zonalAdmin', 'wardAdmin'] },
  { name: 'Bulk Upload', href: '/dashboard/upload', icon: Upload, roles: ['wardAdmin'] },
  { name: 'Reports', href: '/dashboard/reports', icon: FileText, roles: ['superAdmin', 'zonalAdmin'] },
  { name: 'Admin Management', href: '/dashboard/admins', icon: Shield, roles: ['superAdmin', 'zonalAdmin'] },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings, roles: ['superAdmin', 'zonalAdmin', 'wardAdmin'] },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();

  const filteredNavigation = navigation.filter(item => 
    user?.role && item.roles.includes(user.role)
  );

  return (
    <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-white border-r border-gray-200 px-6 pb-4">
      <div className="flex h-16 shrink-0 items-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex items-center space-x-3"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600">
            <Shield className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Logo</h1>
            <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
          </div>
        </motion.div>
      </div>
      
      <nav className="flex flex-1 flex-col">
        <ul role="list" className="flex flex-1 flex-col gap-y-7">
          <li>
            <ul role="list" className="-mx-2 space-y-1">
              {filteredNavigation.map((item, index) => {
                const isActive = pathname === item.href;
                return (
                  <motion.li
                    key={item.name}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <Link
                      href={item.href}
                      className={cn(
                        'group flex gap-x-3 rounded-md p-2 text-sm font-semibold leading-6 transition-all duration-200',
                        isActive
                          ? 'bg-blue-50 text-blue-700'
                          : 'text-gray-700 hover:bg-gray-50 hover:text-blue-700'
                      )}
                    >
                      <item.icon
                        className={cn(
                          'h-6 w-6 shrink-0 transition-colors',
                          isActive ? 'text-blue-700' : 'text-gray-400 group-hover:text-blue-700'
                        )}
                      />
                      {item.name}
                    </Link>
                  </motion.li>
                );
              })}
            </ul>
          </li>
        </ul>
      </nav>
    </div>
  );
}