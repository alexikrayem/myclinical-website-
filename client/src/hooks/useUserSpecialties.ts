import { useState, useCallback } from 'react';

const STORAGE_KEY = 'user_specialties';

export const useUserSpecialties = () => {
    const [specialties, setSpecialties] = useState<string[]>(() => {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        } catch {
            return [];
        }
    });

    const save = useCallback((list: string[]) => {
        setSpecialties(list);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    }, []);

    return { specialties, save };
};
