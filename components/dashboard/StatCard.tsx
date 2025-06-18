'use client';

import { motion } from 'framer-motion';
import { DivideIcon as LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface StatCardProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon: typeof LucideIcon;
  index?: number;
}

export function StatCard({ title, value, change, changeType = 'neutral', icon: Icon, index = 0 }: StatCardProps) {
  const getChangeColor = () => {
    switch (changeType) {
      case 'positive':
        return 'text-green-600';
      case 'negative':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      whileHover={{ y: -4 }}
      className="group"
    >
      <Card className="transition-all duration-300 hover:shadow-lg border-l-4 border-l-blue-500">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">{title}</p>
              <p className="text-3xl font-bold text-gray-900">{value}</p>
              {change && (
                <p className={`text-sm ${getChangeColor()}`}>
                  {change}
                </p>
              )}
            </div>
            <div className="p-3 bg-blue-50 rounded-full group-hover:bg-blue-100 transition-colors">
              <Icon className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}