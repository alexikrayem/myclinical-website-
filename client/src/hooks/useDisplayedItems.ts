import { useState, useCallback } from 'react';

export const useDisplayedItems = () => {
    const [displayedIds, setDisplayedIds] = useState<Set<string>>(new Set());

    const addIds = useCallback((ids: string[]) => {
        setDisplayedIds(prev => {
            const next = new Set(prev);
            ids.forEach(id => next.add(id));
            return next;
        });
    }, []);

    const filterItems = useCallback(<T extends { id: string }>(items: T[]) => {
        return items.filter(item => !displayedIds.has(item.id));
    }, [displayedIds]);

    return { displayedIds, addIds, filterItems };
};
