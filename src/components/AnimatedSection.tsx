import { ReactNode } from 'react';
import { useScrollAnimation } from '@/hooks/useScrollAnimation';
import { cn } from '@/lib/utils';

type AnimationType = 'fade-up' | 'fade-down' | 'fade-left' | 'fade-right' | 'scale' | 'slide-up';

interface AnimatedSectionProps {
  children: ReactNode;
  animation?: AnimationType;
  delay?: number;
  className?: string;
  threshold?: number;
}

const animationClasses: Record<AnimationType, string> = {
  'fade-up': 'animate-fade-in-up',
  'fade-down': 'animate-fade-in-down',
  'fade-left': 'animate-fade-in-left',
  'fade-right': 'animate-fade-in-right',
  'scale': 'animate-scale-in',
  'slide-up': 'animate-slide-up',
};

export const AnimatedSection = ({
  children,
  animation = 'fade-up',
  delay = 0,
  className,
  threshold = 0.1,
}: AnimatedSectionProps) => {
  const { ref, isVisible } = useScrollAnimation({ threshold });

  return (
    <div
      ref={ref}
      className={cn(
        'opacity-0',
        isVisible && animationClasses[animation],
        className
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
};

interface StaggeredChildrenProps {
  children: ReactNode[];
  animation?: AnimationType;
  baseDelay?: number;
  staggerDelay?: number;
  className?: string;
  childClassName?: string;
  threshold?: number;
}

export const StaggeredChildren = ({
  children,
  animation = 'fade-up',
  baseDelay = 0,
  staggerDelay = 100,
  className,
  childClassName,
  threshold = 0.1,
}: StaggeredChildrenProps) => {
  const { ref, isVisible } = useScrollAnimation({ threshold });

  return (
    <div ref={ref} className={className}>
      {children.map((child, index) => (
        <div
          key={index}
          className={cn(
            'opacity-0',
            isVisible && animationClasses[animation],
            childClassName
          )}
          style={{ animationDelay: `${baseDelay + index * staggerDelay}ms` }}
        >
          {child}
        </div>
      ))}
    </div>
  );
};
