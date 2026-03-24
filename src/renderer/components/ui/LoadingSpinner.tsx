import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'inline' | 'full-page' | 'overlay';
  className?: string;
  text?: string;
}

const sizeClasses = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
};

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  variant = 'inline',
  className,
  text,
}) => {
  const containerClasses = {
    inline: 'inline-flex items-center gap-2',
    'full-page': 'flex flex-col items-center justify-center min-h-[200px]',
    overlay: 'absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-50',
  };

  const spinnerClass = cn(
    'animate-spin text-primary',
    sizeClasses[size],
    className
  );

  return (
    <div className={containerClasses[variant]}>
      <Loader2 className={spinnerClass} />
      {text && (
        <span className="text-sm text-muted-foreground">{text}</span>
      )}
    </div>
  );
};

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className,
  variant = 'text',
}) => {
  const variantClasses = {
    text: 'h-4 w-full',
    circular: 'w-12 h-12 rounded-full',
    rectangular: 'w-full h-32',
  };

  return (
    <div
      className={cn(
        'animate-pulse bg-muted',
        variantClasses[variant],
        className
      )}
    />
  );
};

export const LoadingOverlay: React.FC<{ text?: string }> = ({ text }) => (
  <LoadingSpinner variant="overlay" text={text} />
);

export const LoadingPage: React.FC<{ text?: string }> = ({ text }) => (
  <LoadingSpinner variant="full-page" text={text} />
);
