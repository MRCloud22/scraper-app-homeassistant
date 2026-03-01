'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface AppSettings {
    signageImageWidth: number; // in pixels
    signageRotationInterval: number; // in seconds
    signageRefreshInterval: number; // in minutes
    emptyStateText: string;
}

const defaultSettings: AppSettings = {
    signageImageWidth: 140,
    signageRotationInterval: 8,
    signageRefreshInterval: 5,
    emptyStateText: 'Aktuell sind keine freien Termine vorhanden.',
};


interface SettingsContextType {
    settings: AppSettings;
    updateSettings: (newSettings: Partial<AppSettings>) => void;
    resetSettings: () => void;
}

const SettingsContext = createContext<SettingsContextType | null>(null);

const STORAGE_KEY = 'beautykuppel-settings';

export function SettingsProvider({ children }: { children: ReactNode }) {
    const [settings, setSettings] = useState<AppSettings>(defaultSettings);
    const [isLoaded, setIsLoaded] = useState(false);

    // Load settings from localStorage on mount
    useEffect(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                setSettings({ ...defaultSettings, ...parsed });
            }
        } catch (error) {
            console.error('Error loading settings:', error);
        }
        setIsLoaded(true);
    }, []);

    // Save settings to localStorage when they change
    useEffect(() => {
        if (isLoaded) {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
            } catch (error) {
                console.error('Error saving settings:', error);
            }
        }
    }, [settings, isLoaded]);

    const updateSettings = (newSettings: Partial<AppSettings>) => {
        setSettings((prev) => ({ ...prev, ...newSettings }));
    };

    const resetSettings = () => {
        setSettings(defaultSettings);
    };

    return (
        <SettingsContext.Provider value={{ settings, updateSettings, resetSettings }}>
            {children}
        </SettingsContext.Provider>
    );
}

export function useSettings() {
    const context = useContext(SettingsContext);
    if (!context) {
        throw new Error('useSettings must be used within a SettingsProvider');
    }
    return context;
}
