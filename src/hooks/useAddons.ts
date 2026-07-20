import { useState, useEffect, useCallback } from 'react';

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

    const isAddonInstalled = useCallback((id: string) => {
        return installedAddons.some(a => a.id === id);
    }, [installedAddons]);

    const getAddonScript = useCallback(async (id: string) => {
        try {
            const { invoke } = await import('@tauri-apps/api/core');
            return await invoke<string>('get_addon_script', { id });
        } catch (e) {
            console.warn("Failed to load script for addon", id, e);
            return null;
        }
    }, []);

    const evaluateAddon = useCallback(async (id: string) => {
        const script = await getAddonScript(id);
        if (!script) return null;
        const trimmedScript = script.trim();
        if (
            trimmedScript === "404: Not Found" ||
            trimmedScript.startsWith("404:") ||
            trimmedScript.includes("404 Not Found") ||
            trimmedScript.includes("<!DOCTYPE html>")
        ) {
            console.warn("Addon script is invalid or corrupt (404 Not Found):", id);
            return null;
        }
        try {
            const module = { exports: {} as any };
            const fn = new Function('module', 'exports', script + '\nreturn module.exports;');
            return fn(module, module.exports);
        } catch (e) {
            console.warn("Failed to evaluate addon script", id, e);
            return null;
        }
    }, [getAddonScript]);

    return { installedAddons, isAddonInstalled, loadAddons, isLoading, evaluateAddon };
}
