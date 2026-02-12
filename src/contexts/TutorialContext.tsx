import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export type TutorialStep = {
    id: string;
    title: string;
    description: string;
    targetId: string; // data-tutorial-id attribute
    page: string; // which page this step is on (use prefix match for dynamic routes)
    action?: 'click' | 'none'; // what action triggers next step
};

const tutorialSteps: TutorialStep[] = [
    {
        id: 'create-space',
        title: 'Create Your First Space',
        description: 'Start by creating a brand space. This is where all your content magic happens.',
        targetId: 'create-space-button',
        page: '/spaces',
        action: 'click'
    },
    {
        id: 'connect-instagram',
        title: 'Connect Instagram',
        description: 'Link your Instagram account to publish content directly and get insights.',
        targetId: 'connect-instagram-button',
        page: '/one-click-post',
        action: 'click'
    },
    {
        id: 'select-idea',
        title: 'Choose a Content Idea',
        description: 'Browse AI-generated content ideas tailored to your brand. Click one to get started.',
        targetId: 'idea-card',
        page: '/one-click-post',
        action: 'click'
    },
    {
        id: 'generate-poster',
        title: 'Generate Your Poster',
        description: 'Watch as AI creates a stunning visual for your selected idea.',
        targetId: 'generate-section',
        page: '/one-click-post',
        action: 'none'
    },
    {
        id: 'publish-post',
        title: 'Publish to Instagram',
        description: 'Ready to go live? Click the publish button to share your creation with the world.',
        targetId: 'publish-button',
        page: '/one-click-post',
        action: 'none'
    },
    {
        id: 'view-gallery',
        title: 'Your Creative Gallery',
        description: 'All your generated content is saved here. Review, download, or republish anytime.',
        targetId: 'gallery-section',
        page: '/gallery',
        action: 'none'
    },
    {
        id: 'view-analytics',
        title: 'Track Your Performance',
        description: 'Monitor engagement, reach, and insights to optimize your content strategy.',
        targetId: 'analytics-section',
        page: '/analytics',
        action: 'none'
    }
];

interface TutorialContextType {
    isActive: boolean;
    currentStep: number;
    currentStepData: TutorialStep | null;
    startTutorial: () => void;
    nextStep: () => void;
    skipTutorial: () => void;
    completeTutorial: () => void;
    totalSteps: number;
}

const TutorialContext = createContext<TutorialContextType | undefined>(undefined);

export const TutorialProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [isActive, setIsActive] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        // Check if user has completed tutorial
        const tutorialCompleted = localStorage.getItem('tutorial_completed');
        if (!tutorialCompleted) {
            // Auto-start tutorial for new users after a short delay
            const timer = setTimeout(() => {
                setIsActive(true);
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, []);

    // Navigate to the correct page when the step changes
    useEffect(() => {
        if (!isActive) return;
        const stepData = tutorialSteps[currentStep];
        if (!stepData) return;

        const currentPath = location.pathname;
        const stepPage = stepData.page;

        // Check if we're already on the right page (prefix match for dynamic routes like /one-click-post/:id)
        if (!currentPath.startsWith(stepPage)) {
            // Extract spaceId from current URL if we're inside a space
            const spaceMatch = currentPath.match(/\/(one-click-post|gallery|analytics|chat)\/(.+)/);
            const spaceId = spaceMatch ? spaceMatch[2] : null;

            if (spaceId && stepPage !== '/spaces') {
                // Navigate to the step's page with the current spaceId
                navigate(`${stepPage}/${spaceId}`);
            } else if (stepPage === '/spaces') {
                navigate('/spaces');
            }
            // If no spaceId and page requires one, don't navigate (user needs to enter a space first)
        }
    }, [isActive, currentStep]);

    const startTutorial = () => {
        setCurrentStep(0);
        setIsActive(true);
    };

    const nextStep = () => {
        if (currentStep < tutorialSteps.length - 1) {
            setCurrentStep(prev => prev + 1);
        } else {
            completeTutorial();
        }
    };

    const skipTutorial = () => {
        setIsActive(false);
        localStorage.setItem('tutorial_completed', 'true');
    };

    const completeTutorial = () => {
        setIsActive(false);
        localStorage.setItem('tutorial_completed', 'true');
    };

    const currentStepData = isActive ? tutorialSteps[currentStep] : null;

    return (
        <TutorialContext.Provider
            value={{
                isActive,
                currentStep,
                currentStepData,
                startTutorial,
                nextStep,
                skipTutorial,
                completeTutorial,
                totalSteps: tutorialSteps.length
            }}
        >
            {children}
        </TutorialContext.Provider>
    );
};

export const useTutorial = () => {
    const context = useContext(TutorialContext);
    if (!context) {
        throw new Error('useTutorial must be used within TutorialProvider');
    }
    return context;
};
