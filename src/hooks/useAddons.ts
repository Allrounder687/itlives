import { useState, useEffect } from 'react';

export interface Addon {
    id: string;
    name: string;
    description: string;
    install_url: string;
    addon_type: string;
    version: string;
    author: string;
}

export function useAddons() {
    const [installedAddons, setInstalledAddons] = useState<Addon[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const loadAddons = async () => {
        setIsLoading(true);
        try {
            const { invoke } = await import('@tauri-apps/api/core');
            const addons = await invoke<Addon[]>('list_installed_addons');
            setInstalledAddons(addons);
        } catch (e) {
            console.error("Failed to list installed addons", e);
            setInstalledAddons([]);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadAddons();
        
        const handleReload = () => loadAddons();
        window.addEventListener('reload-addons', handleReload);
        return () => window.removeEventListener('reload-addons', handleReload);
    }, []);

    const isAddonInstalled = (id: string) => {
        return installedAddons.some(a => a.id === id);
    };

    return { installedAddons, isAddonInstalled, loadAddons, isLoading };
}
