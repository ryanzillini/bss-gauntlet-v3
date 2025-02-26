import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/router';
import MainLayout from '../components/layout/MainLayout';

const DashboardPage = () => {
  const router = useRouter();
  
  // Stats data
  const statsData = [
    { title: 'Configured APIs', value: '14', change: '+3', changeType: 'positive' },
    { title: 'Active Endpoints', value: '86', change: '+12', changeType: 'positive' },
    { title: 'Error Rate', value: '0.42%', change: '-0.15%', changeType: 'positive' },
    { title: 'Response Time', value: '124ms', change: '+2ms', changeType: 'negative' },
  ];
  
  // Recent activity data
  const recentActivity = [
    { action: 'Updated', item: 'Customer API', user: 'Sarah Chen', time: '12 minutes ago' },
    { action: 'Created', item: 'Product Catalog Mapping', user: 'Miguel Rodriguez', time: '2 hours ago' },
    { action: 'Deleted', item: 'Legacy Billing Endpoint', user: 'Alex Johnson', time: '5 hours ago' },
    { action: 'Modified', item: 'Service Inventory Schema', user: 'Priya Sharma', time: 'Yesterday' },
  ];
  
  // Quick actions
  const quickActions = [
    { title: 'Upload API', description: 'Import a new API specification', icon: '/icons/upload.svg', href: '/api-docs' },
    { title: 'Create Mapping', description: 'Build a new endpoint mapping', icon: '/icons/mapping.svg', href: '/mapping' },
    { title: 'Test Endpoint', description: 'Validate your API integration', icon: '/icons/test.svg', href: '/test-api' },
    { title: 'View Analytics', description: 'Monitor API performance', icon: '/icons/analytics.svg', href: '/analytics' },
  ];
  
  // System status
  const systemStatus = [
    { name: 'API Gateway', status: 'operational', uptime: '99.9%' },
    { name: 'Mapping Engine', status: 'operational', uptime: '99.7%' },
    { name: 'AI Assistant', status: 'operational', uptime: '98.5%' },
    { name: 'Authentication', status: 'operational', uptime: '100%' },
  ];

  return (
    <MainLayout>
      <div className="space-y-4">
        {/* Welcome Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-display font-bold text-pure-white light-mode:text-black">
              Welcome to <span className="text-totogi-purple">BSS Magic</span>
            </h1>
            <p className="text-pure-white/70 light-mode:text-black/60 text-sm mt-1">Your AI-powered Business Support System dashboard</p>
          </div>
          <Link href="/api-docs" className="btn-primary text-sm py-2 px-4 inline-flex items-center gap-2 mt-3 md:mt-0">
            <span>Upload New API</span>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
          </Link>
        </div>
        
        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {statsData.map((stat, index) => (
            <div key={index} className="glass-card p-3 md:p-4">
              <h3 className="text-pure-white/70 light-mode:text-black/60 text-xs font-medium mb-1">{stat.title}</h3>
              <div className="flex justify-between items-baseline">
                <span className="text-xl md:text-2xl font-display font-bold text-pure-white light-mode:text-black">{stat.value}</span>
                <div className={`inline-flex items-center gap-1 text-xs ${stat.changeType === 'positive' ? 'text-success' : 'text-error'}`}>
                  {stat.changeType === 'positive' ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="18 15 12 9 6 15"></polyline>
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                  )}
                  <span>{stat.change}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {/* Main Content Area */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {/* Quick Actions */}
          <div className="lg:col-span-2 glass-card p-4">
            <h2 className="text-lg font-display font-semibold mb-3 text-pure-white light-mode:text-black">Quick Actions</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {quickActions.map((action, index) => (
                <Link key={index} href={action.href} className="p-3 border border-totogi-purple/20 rounded-lg hover:border-totogi-purple/40 hover:bg-totogi-purple/10 transition-all flex items-start gap-3 light-mode:bg-white">
                  <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-gradient-to-r from-totogi-purple to-totogi-blue bg-opacity-10">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-pure-white light-mode:text-totogi-purple">
                      <polyline points="8 17 12 21 16 17"></polyline>
                      <line x1="12" y1="12" x2="12" y2="21"></line>
                      <path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29"></path>
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-medium text-sm text-pure-white light-mode:text-black">{action.title}</h3>
                    <p className="text-pure-white/70 light-mode:text-black/60 text-xs mt-1">{action.description}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
          
          {/* System Status */}
          <div className="glass-card p-4">
            <h2 className="text-lg font-display font-semibold mb-3 text-pure-white light-mode:text-black">System Status</h2>
            <div className="space-y-2">
              {systemStatus.map((system, index) => (
                <div key={index} className="flex justify-between items-center py-1">
                  <span className="text-pure-white light-mode:text-black text-sm">{system.name}</span>
                  <div className="flex items-center gap-2">
                    <span className={`inline-block w-2 h-2 rounded-full ${system.status === 'operational' ? 'bg-success' : system.status === 'degraded' ? 'bg-warning' : 'bg-error'}`}></span>
                    <span className="text-pure-white/70 light-mode:text-black/60 text-xs">{system.uptime}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        {/* Recent Activity */}
        <div className="glass-card p-4">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-display font-semibold text-pure-white light-mode:text-black">Recent Activity</h2>
            <Link href="/activity" className="text-totogi-purple hover:text-totogi-blue transition-colors text-xs">
              View All
            </Link>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-totogi-purple/20">
                  <th className="text-left py-2 px-3 text-pure-white/70 light-mode:text-black/60 font-medium text-xs">Action</th>
                  <th className="text-left py-2 px-3 text-pure-white/70 light-mode:text-black/60 font-medium text-xs">Item</th>
                  <th className="text-left py-2 px-3 text-pure-white/70 light-mode:text-black/60 font-medium text-xs">User</th>
                  <th className="text-left py-2 px-3 text-pure-white/70 light-mode:text-black/60 font-medium text-xs">Time</th>
                </tr>
              </thead>
              <tbody>
                {recentActivity.map((activity, index) => (
                  <tr key={index} className="border-b border-totogi-purple/10 hover:bg-totogi-purple/5">
                    <td className="py-2 px-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                        activity.action === 'Updated' ? 'bg-blue-500/20 text-blue-600 light-mode:text-blue-600' :
                        activity.action === 'Created' ? 'bg-green-500/20 text-green-500 light-mode:text-green-600' :
                        activity.action === 'Deleted' ? 'bg-red-500/20 text-red-400 light-mode:text-red-600' :
                        'bg-purple-500/20 text-purple-400 light-mode:text-purple-600'
                      }`}>
                        {activity.action}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-pure-white light-mode:text-black text-sm">{activity.item}</td>
                    <td className="py-2 px-3 text-pure-white/70 light-mode:text-black/60 text-sm">{activity.user}</td>
                    <td className="py-2 px-3 text-pure-white/70 light-mode:text-black/60 text-sm">{activity.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default DashboardPage; 