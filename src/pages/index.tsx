import React, { useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import MainLayout from '../components/layout/MainLayout';
import { useRouter } from 'next/router';

const HomePage = () => {
  const router = useRouter();

  useEffect(() => {
    // Redirect to dashboard page
    router.replace('/dashboard');
  }, [router]);

  const features = [
    {
      title: 'API Documentation',
      description: 'Upload and manage your API documentation',
      icon: '/icons/api-docs.svg',
      href: '/api-docs',
      iconBg: 'from-totogi-purple to-totogi-blue',
    },
    {
      title: 'Mapping Editor',
      description: 'Create and edit TM Forum API mappings',
      icon: '/icons/mapping.svg',
      href: '/mapping',
      iconBg: 'from-totogi-blue to-totogi-purple',
    },
    {
      title: 'AI Assistant',
      description: 'Get AI-powered mapping suggestions',
      icon: '/icons/ai-assistant.svg',
      href: '/ai-assistant',
      iconBg: 'from-totogi-pink to-totogi-purple',
    },
    {
      title: 'Settings',
      description: 'Configure your BSS Magic instance',
      icon: '/icons/settings.svg',
      href: '/settings',
      iconBg: 'from-totogi-purple to-totogi-blue',
    },
  ];

  return null; // No need to render anything as we're redirecting
};

export default HomePage; 