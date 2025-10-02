import { Sparkles } from "lucide-react";

interface LoadingAnimationProps {
  message?: string;
}

const LoadingAnimation = ({ message = "Weezy is working..." }: LoadingAnimationProps) => {
  return (
    <div className="flex items-center space-x-3 py-6 px-4">
      <div className="relative">
        <Sparkles className="w-5 h-5 text-primary animate-pulse" />
        <div className="absolute inset-0 animate-ping opacity-20">
          <Sparkles className="w-5 h-5 text-primary" />
        </div>
      </div>
      <span className="text-sm text-muted-foreground animate-pulse">{message}</span>
      <div className="flex space-x-1">
        <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
        <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
        <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
      </div>
    </div>
  );
};

export default LoadingAnimation;
