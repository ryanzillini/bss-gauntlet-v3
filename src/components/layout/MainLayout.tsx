import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Logo from '../common/Logo';

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const router = useRouter();
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Initialize theme from localStorage or system preference
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'dark' | 'light' | null;
    
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.classList.toggle('light-mode', savedTheme === 'light');
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      setTheme('light');
      document.documentElement.classList.add('light-mode');
    }
  }, []);

  // Toggle theme function
  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.classList.toggle('light-mode', newTheme === 'light');
  };

  // Navigation items
  const navItems = [
    { name: 'Dashboard', href: '/dashboard' },
    { name: 'APIs', href: '/api-docs' },
    { name: 'Mapping Editor', href: '/mapping' },
    { name: 'Schema Mapping', href: '/schema-mapping' }
  ];

  return (
    <div className="min-h-screen bg-dark-navy light-mode:bg-light-lavender">
      <nav className="fixed top-0 left-0 right-0 z-50 bg-darker-navy/95 light-mode:bg-white border-b border-totogi-purple/20 backdrop-blur">
        <div className="container mx-auto px-4 py-2 flex justify-between items-center">
          <div className="flex items-center gap-10">
            <Logo />
            
            <div className="hidden md:flex items-center space-x-6">
              {navItems.map((item) => {
                const isActive = router.pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`py-2 text-sm transition-colors ${
                      isActive
                        ? 'text-totogi-purple border-b-2 border-totogi-purple'
                        : 'text-pure-white/80 hover:text-pure-white border-b-2 border-transparent light-mode:text-black hover:light-mode:text-totogi-purple'
                    }`}
                  >
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={toggleTheme}
              className="p-2 rounded-full hover:bg-totogi-purple/10 transition-colors"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-totogi-purple">
                  <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path>
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-black">
                  <circle cx="12" cy="12" r="4"></circle>
                  <path d="M12 2v2"></path>
                  <path d="M12 20v2"></path>
                  <path d="m4.93 4.93 1.41 1.41"></path>
                  <path d="m17.66 17.66 1.41 1.41"></path>
                  <path d="M2 12h2"></path>
                  <path d="M20 12h2"></path>
                  <path d="m6.34 17.66-1.41 1.41"></path>
                  <path d="m19.07 4.93-1.41 1.41"></path>
                </svg>
              )}
            </button>
            
            <div className="flex items-center">
              <div className="h-8 w-8 rounded-full bg-gradient-to-r from-totogi-purple to-totogi-blue flex items-center justify-center text-xs font-medium text-white">
                DR
              </div>
            </div>
          </div>
        </div>
      </nav>
      
      <main className="container mx-auto pt-16 p-4">
        <div className="ai-card p-4 light-mode:bg-white light-mode:border-slate-200 light-mode:shadow-sm">
          {children}
        </div>
      </main>
    </div>
  );
};

export default MainLayout; 