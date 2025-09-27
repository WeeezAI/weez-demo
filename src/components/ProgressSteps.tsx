import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

interface ProgressStepsProps {
  steps: string[];
  duration: number;
  onComplete: () => void;
}

const ProgressSteps = ({ steps, duration, onComplete }: ProgressStepsProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const stepDuration = duration / steps.length;
    
    const interval = setInterval(() => {
      setProgress(prev => {
        const newProgress = prev + (100 / (duration / 100));
        
        if (newProgress >= 100) {
          clearInterval(interval);
          setTimeout(onComplete, 200);
          return 100;
        }
        
        const newStep = Math.floor((newProgress / 100) * steps.length);
        setCurrentStep(newStep);
        
        return newProgress;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [steps, duration, onComplete]);

  return (
    <Card className="p-4 bg-weez-card border-weez-blue/20">
      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          <Loader2 className="w-4 h-4 text-weez-blue animate-spin" />
          <span className="text-sm font-medium text-weez-text">
            {steps[currentStep] || steps[steps.length - 1]}
          </span>
        </div>
        
        <div className="w-full bg-weez-surface rounded-full h-2">
          <div 
            className="bg-gradient-primary h-2 rounded-full transition-all duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>
        
        <div className="flex justify-between text-xs text-muted-foreground">
          {steps.map((step, index) => (
            <span 
              key={index}
              className={`progress-step ${
                index < currentStep ? 'completed' : 
                index === currentStep ? 'active' : ''
              }`}
            >
              Step {index + 1}
            </span>
          ))}
        </div>
      </div>
    </Card>
  );
};

export default ProgressSteps;