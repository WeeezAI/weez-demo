import { useEffect, useState } from 'react';
import { useTutorial } from '@/contexts/TutorialContext';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { X, ArrowRight, Sparkles } from 'lucide-react';

export const TutorialTooltip = () => {
    const { isActive, currentStepData, currentStep, totalSteps, nextStep, skipTutorial } = useTutorial();
    const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});

    useEffect(() => {
        if (!isActive || !currentStepData) return;

        const updateTooltip = () => {
            const targetElement = document.querySelector(`[data-tutorial-id="${currentStepData.targetId}"]`);

            if (targetElement) {
                const rect = targetElement.getBoundingClientRect();
                const tooltipWidth = 360;
                const spacing = 20;

                // Position below the target element
                let top = rect.bottom + spacing;
                let left = rect.left + (rect.width / 2) - (tooltipWidth / 2);

                // Adjust if tooltip goes off screen
                if (left + tooltipWidth > window.innerWidth - 20) {
                    left = window.innerWidth - tooltipWidth - 20;
                }
                if (left < 20) {
                    left = 20;
                }

                // If tooltip would go below viewport, position above
                if (top + 200 > window.innerHeight) {
                    top = rect.top - 200 - spacing;
                }

                setTooltipStyle({
                    position: 'fixed',
                    top: `${top}px`,
                    left: `${left}px`,
                    width: `${tooltipWidth}px`,
                    transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                    zIndex: 10000
                });
            }
        };

        updateTooltip();
        window.addEventListener('resize', updateTooltip);
        window.addEventListener('scroll', updateTooltip);

        return () => {
            window.removeEventListener('resize', updateTooltip);
            window.removeEventListener('scroll', updateTooltip);
        };
    }, [isActive, currentStepData]);

    if (!isActive || !currentStepData) return null;

    return createPortal(
        <div
            style={tooltipStyle}
            className="tutorial-tooltip bg-white rounded-2xl shadow-2xl border-2 border-primary/20 p-6 animate-in fade-in slide-in-from-bottom-4 duration-500"
        >
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-primary" />
                    <span className="text-xs font-black uppercase tracking-widest text-primary/60">
                        Step {currentStep + 1} of {totalSteps}
                    </span>
                </div>
                <button
                    onClick={skipTutorial}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* Content */}
            <div className="space-y-3 mb-6">
                <h3 className="text-xl font-black tracking-tight text-foreground">
                    {currentStepData.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    {currentStepData.description}
                </p>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between gap-3">
                <Button
                    variant="ghost"
                    onClick={skipTutorial}
                    className="text-xs font-bold uppercase tracking-wider"
                >
                    Skip Tutorial
                </Button>
                <Button
                    onClick={nextStep}
                    className="bg-primary text-white hover:bg-accent text-xs font-black uppercase tracking-wider px-6"
                >
                    {currentStep === totalSteps - 1 ? 'Finish' : 'Next'}
                    <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
            </div>
        </div>,
        document.body
    );
};
