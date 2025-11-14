

import React, { useState } from 'react';
import { RemoveIcon, EditIcon, CheckIcon } from './Icons';
import type { CustomPalette } from '../types';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    isStatusBarVisible: boolean;
    onToggleStatusBar: () => void;
    rememberQueue: boolean;
    onToggleRememberQueue: () => void;
    theme: string;
    onThemeChange: (theme: string) => void;
    customPalettes: CustomPalette[];
    onSaveCustomPalette: (name: string) => void;
    onDeleteCustomPalette: (id: string) => void;
    onUpdateCustomPalette: (id: string, newName: string) => void;
    activeCustomColors: CustomPalette['colors'];
    onCustomColorChange: (colors: CustomPalette['colors']) => void;
}

const ToggleSwitch: React.FC<{ enabled: boolean; onToggle: () => void; id: string }> = ({ enabled, onToggle, id }) => {
    return (
        <button
            id={id}
            onClick={onToggle}
            role="switch"
            aria-checked={enabled}
            className={`${
                enabled ? 'bg-indigo-600' : 'bg-gray-600'
            } relative inline-flex items-center h-6 rounded-full w-11 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 focus:ring-offset-gray-800`}
        >
            <span
                className={`${
                    enabled ? 'translate-x-6' : 'translate-x-1'
                } inline-block w-4 h-4 transform bg-white rounded-full transition-transform`}
            />
        </button>
    );
};

export const SettingsModal: React.FC<SettingsModalProps> = ({ 
    isOpen, 
    onClose, 
    isStatusBarVisible, 
    onToggleStatusBar, 
    rememberQueue, 
    onToggleRememberQueue, 
    theme, 
    onThemeChange,
    customPalettes,
    onSaveCustomPalette,
    onDeleteCustomPalette,
    onUpdateCustomPalette,
    activeCustomColors,
    onCustomColorChange,
}) => {
    const [editingPaletteId, setEditingPaletteId] = useState<string | null>(null);
    const [editingPaletteName, setEditingPaletteName] = useState('');
    const [newPaletteName, setNewPaletteName] = useState('');
    
    if (!isOpen) return null;

    const handleStartEditing = (palette: CustomPalette) => {
        setEditingPaletteId(palette.id);
        setEditingPaletteName(palette.name);
    };

    const handleCancelEditing = () => {
        setEditingPaletteId(null);
        setEditingPaletteName('');
    };

    const handleSaveEditing = () => {
        if (editingPaletteId && editingPaletteName.trim()) {
            onUpdateCustomPalette(editingPaletteId, editingPaletteName.trim());
        }
        setEditingPaletteId(null);
        setEditingPaletteName('');
    };

    const handleColorChange = (colorType: keyof CustomPalette['colors'], value: string) => {
        onCustomColorChange({ ...activeCustomColors, [colorType]: value });
    };

    const handleSavePalette = () => {
        if (newPaletteName.trim()) {
            onSaveCustomPalette(newPaletteName.trim());
            setNewPaletteName('');
        }
    };
    
    const isActivePalette = (palette: CustomPalette) => {
        return theme === 'custom' && localStorage.getItem('music_active_palette_id') === palette.id;
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50" onClick={onClose}>
            <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-white">Settings</h2>
                    <button 
                        onClick={onClose} 
                        className="p-1 rounded-full text-gray-400 hover:bg-gray-700 hover:text-white transition-colors"
                        aria-label="Close settings"
                    >
                        <RemoveIcon />
                    </button>
                </div>

                <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-3">
                    <div>
                         <h3 className="text-gray-300 font-medium mb-2 text-sm uppercase tracking-wider">General</h3>
                        <div className="space-y-2 p-3 bg-gray-700/50 rounded-lg">
                             <div className="flex items-center justify-between">
                                <label htmlFor="statusBarToggle" className="text-gray-200">Show Status Bar</label>
                                <ToggleSwitch enabled={isStatusBarVisible} onToggle={onToggleStatusBar} id="statusBarToggle" />
                            </div>
                            <div className="flex items-center justify-between">
                                <label htmlFor="rememberQueueToggle" className="text-gray-200">Remember 'Up Next' Queue</label>
                                <ToggleSwitch enabled={rememberQueue} onToggle={onToggleRememberQueue} id="rememberQueueToggle" />
                            </div>
                        </div>
                    </div>

                    <div>
                        <h3 className="text-gray-300 font-medium mb-2 text-sm uppercase tracking-wider">Appearance</h3>
                        <div className="space-y-2 p-3 bg-gray-700/50 rounded-lg">
                            <button onClick={() => onThemeChange('default')} className={`w-full text-left px-3 py-2 rounded-md transition-colors ${theme === 'default' ? 'bg-indigo-600 text-white font-semibold' : 'hover:bg-gray-600/50'}`}>
                                Default
                            </button>
                            <button onClick={() => onThemeChange('miku')} className={`w-full text-left px-3 py-2 rounded-md transition-colors ${theme === 'miku' ? 'bg-indigo-600 text-white font-semibold' : 'hover:bg-gray-600/50'}`}>
                                Hatsune Miku
                            </button>
                            {customPalettes.map(palette => (
                                <div key={palette.id} className={`group flex items-center justify-between rounded-md transition-colors ${!editingPaletteId ? 'hover:bg-gray-600/50' : ''} ${isActivePalette(palette) && !editingPaletteId ? 'bg-indigo-600/20' : ''}`}>
                                    {editingPaletteId === palette.id ? (
                                        <div className="flex items-center space-x-2 p-2 w-full">
                                            <input
                                                type="text"
                                                value={editingPaletteName}
                                                onChange={(e) => setEditingPaletteName(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') handleSaveEditing();
                                                    if (e.key === 'Escape') handleCancelEditing();
                                                }}
                                                className="flex-grow bg-gray-900 border border-gray-500 rounded px-2 py-1 text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                                autoFocus
                                            />
                                            <button onClick={handleSaveEditing} className="p-2 rounded-full text-green-400 hover:bg-green-600 hover:text-white" title="Save name">
                                                <CheckIcon />
                                            </button>
                                            <button onClick={handleCancelEditing} className="p-2 rounded-full text-gray-400 hover:bg-gray-500 hover:text-white" title="Cancel edit">
                                                <RemoveIcon />
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            <button onClick={() => onThemeChange(palette.id)} className={`w-full text-left px-3 py-2 rounded-l-md transition-colors ${isActivePalette(palette) ? 'text-indigo-300 font-semibold' : ''}`}>
                                                {palette.name}
                                            </button>
                                            <div className="flex items-center pr-1">
                                                <button
                                                    onClick={() => handleStartEditing(palette)}
                                                    className="p-2 rounded-full text-gray-500 hover:bg-indigo-500/50 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                                    title="Rename palette"
                                                >
                                                    <EditIcon />
                                                </button>
                                                <button
                                                    onClick={() => onDeleteCustomPalette(palette.id)}
                                                    className="p-2 rounded-full text-gray-500 hover:bg-red-500/50 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                                    title="Delete palette"
                                                >
                                                    <RemoveIcon />
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div>
                        <h3 className="text-gray-300 font-medium mb-2 text-sm uppercase tracking-wider">Custom Theme Editor</h3>
                        <div className="space-y-4 p-3 bg-gray-700/50 rounded-lg">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="flex flex-col">
                                    <label htmlFor="primaryColor" className="text-sm text-gray-400 mb-1">Primary</label>
                                    <input type="color" id="primaryColor" value={activeCustomColors.primary} onChange={e => handleColorChange('primary', e.target.value)} className="w-full h-10 p-1 bg-gray-600 border border-gray-500 rounded cursor-pointer" />
                                </div>
                                <div className="flex flex-col">
                                    <label htmlFor="accentColor" className="text-sm text-gray-400 mb-1">Accent</label>
                                    <input type="color" id="accentColor" value={activeCustomColors.accent} onChange={e => handleColorChange('accent', e.target.value)} className="w-full h-10 p-1 bg-gray-600 border border-gray-500 rounded cursor-pointer" />
                                </div>
                                <div className="flex flex-col">
                                    <label htmlFor="textColor" className="text-sm text-gray-400 mb-1">Accent Text</label>
                                    <input type="color" id="textColor" value={activeCustomColors.text} onChange={e => handleColorChange('text', e.target.value)} className="w-full h-10 p-1 bg-gray-600 border border-gray-500 rounded cursor-pointer" />
                                </div>
                            </div>
                            <div className="flex items-center space-x-2">
                                <input
                                    type="text"
                                    value={newPaletteName}
                                    onChange={(e) => setNewPaletteName(e.target.value)}
                                    placeholder="Enter new theme name"
                                    className="flex-grow bg-gray-900 border border-gray-500 rounded px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                />
                                <button
                                    onClick={handleSavePalette}
                                    className="bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-4 rounded transition-colors disabled:bg-gray-500"
                                    disabled={!newPaletteName.trim()}
                                >
                                    Save
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-8 flex justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 px-4 rounded-lg transition-colors"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
};