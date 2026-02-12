import { useEffect, useState } from 'react';
import { useTutorial } from '@/contexts/TutorialContext';
import { createPortal } from 'react-dom';

export const TutorialSpotlight = () => {
    const { isActive, currentStepData } = useTutorial();
    const [spotlightRect, setSpotlightRect] = useState<DOMRect | null>(null);

    useEffect(() => {
        if (!isActive || !currentStepData) return;

        const updateSpotlight = () => {
            const targetElement = document.querySelector(`[data-tutorial-id="${currentStepData.targetId}"]`);

            if (targetElement) {
                const rect = targetElement.getBoundingClientRect();
                setSpotlightRect(rect);
            } else {
                setSpotlightRect(null);
            }
        };

        updateSpotlight();
        // Re-check periodically in case elements load after navigation
        const interval = setInterval(updateSpotlight, 500);
        window.addEventListener('resize', updateSpotlight);
        window.addEventListener('scroll', updateSpotlight);

        return () => {
            clearInterval(interval);
            window.removeEventListener('resize', updateSpotlight);
            window.removeEventListener('scroll', updateSpotlight);
        };
    }, [isActive, currentStepData]);

    if (!isActive || !currentStepData || !spotlightRect) return null;

    const padding = 8;
    const top = spotlightRect.top - padding;
    const left = spotlightRect.left - padding;
    const width = spotlightRect.width + padding * 2;
    const height = spotlightRect.height + padding * 2;
    const radius = 16;

    // Use clip-path to create a true cutout — the dark overlay covers everything EXCEPT the spotlight area
    // This means clicks on the spotlighted element pass through naturally
    const clipPath = `polygon(
        0% 0%, 0% 100%, 
        ${left}px 100%, ${left}px ${top}px, 
        ${left + width}px ${top}px, ${left + width}px ${top + height}px, 
        ${left}px ${top + height}px, ${left}px 100%, 
        100% 100%, 100% 0%
    )`;

    return createPortal(
        <div className="tutorial-overlay">
            {/* Dark overlay with cutout via clip-path — clicks pass through the cutout */}
            <div
                style={{
                    position: 'fixed',
                    inset: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.75)',
                    zIndex: 9998,
                    clipPath,
                    transition: 'clip-path 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
            />

            {/* Spotlight ring — visual only, no pointer blocking */}
            <div
                style={{
                    position: 'fixed',
                    top: `${top}px`,
                    left: `${left}px`,
                    width: `${width}px`,
                    height: `${height}px`,
                    borderRadius: `${radius}px`,
                    border: '2px solid rgb(124, 58, 237)',
                    boxShadow: '0 0 40px 8px rgba(124, 58, 237, 0.5)',
                    pointerEvents: 'none',
                    zIndex: 9999,
                    transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
            />
        </div>,
        document.body
    );
};
