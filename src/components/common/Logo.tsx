import React from 'react';
import Image from 'next/image';
import Link from 'next/link';

interface LogoProps {
  className?: string;
}

const Logo: React.FC<LogoProps> = ({ className = '' }) => {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <Link href="/" className="flex items-center">
        <div className="bg-pure-white light-mode:bg-white p-2 rounded-lg shadow-sm">
          <Image
            src="/images/totogi-logo.png"
            alt="Totogi"
            width={120}
            height={40}
            priority={true}
            className="h-6 w-auto"
          />
        </div>
      </Link>
      <div className="h-4 w-px bg-totogi-purple/20 light-mode:bg-slate-300" />
      <Link href="/">
        <span className="text-base font-display font-semibold text-totogi-purple hover:opacity-80 transition-opacity">
          BSS Magic
        </span>
      </Link>
    </div>
  );
};

export default Logo; 