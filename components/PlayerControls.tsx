import React from 'react';
import type { Song } from '../types';
import { ShuffleIcon, LoopIcon, PlayIcon, PauseIcon, NextIcon, PrevIcon, VolumeUpIcon, VolumeMuteIcon } from './Icons';

interface PlayerControlsProps {
    isPlaying: boolean;
    onPlayPause: () => void;
    onNext: () => void;
    onPrev: () => void;
    currentTime: number;
    duration: number;
    onSeek: (time: number) => void;
    volume: number;
    onVolumeChange: (volume: number) => void;
    isMuted: boolean;
    onToggleMute: () => void;
    loop: boolean;
    onToggleLoop: () => void;
    shuffle: boolean;
    onToggleShuffle: () => void;
    currentSong: Song | null;
}

const formatTime = (seconds: number): string => {
    if (isNaN(seconds)) return '00:00';
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export const PlayerControls: React.FC<PlayerControlsProps> = ({
    isPlaying,
    onPlayPause,
    onNext,
    onPrev,
    currentTime,
    duration,
    onSeek,
    volume,
    onVolumeChange,
    isMuted,
    onToggleMute,
    loop,
    onToggleLoop,
    shuffle,
    onToggleShuffle,
    currentSong,
}) => {
    return (
        <div className="p-2 sm:p-4 bg-black bg-opacity-30">
            <div className="flex flex-col sm:flex-row items-center sm:space-x-4">
                <div className="w-full sm:w-1/4 flex items-center space-x-3 min-w-0">
                    {currentSong ? (
                        <>
                            {currentSong.albumArt ? (
                                <img src={currentSong.albumArt} alt={currentSong.album} className="w-12 h-12 sm:w-16 sm:h-16 rounded-md shadow-lg object-cover" />
                            ) : (
                                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-md bg-gray-700 flex items-center justify-center flex-shrink-0">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 sm:h-8 sm:w-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" /></svg>
                                </div>
                            )}
                            <div className="min-w-0">
                                <p className="font-bold player-text truncate">{currentSong.title}</p>
                                <p className="text-sm player-text-secondary truncate">{currentSong.artist}</p>
                            </div>
                        </>
                    ) : (
                         <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-md bg-gray-700 flex items-center justify-center flex-shrink-0">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 sm:h-8 sm:w-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" /></svg>
                         </div>
                    )}
                </div>

                <div className="w-full sm:w-2/4 flex flex-col items-center justify-center space-y-1 mt-2 sm:mt-0">
                    <div className="flex items-center space-x-2 sm:space-x-4">
                        <button onClick={onToggleShuffle} className={`p-2 rounded-full hover:bg-gray-700 transition-colors ${shuffle ? 'text-indigo-400' : 'player-text-secondary'}`} title="Shuffle">
                            <ShuffleIcon />
                        </button>
                        <button onClick={onPrev} className="p-2 rounded-full hover:bg-gray-700 transition-colors player-text-secondary" title="Previous">
                            <PrevIcon />
                        </button>
                        <button
                            onClick={onPlayPause}
                            className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center rounded-full bg-indigo-600 hover:bg-indigo-500 text-white transition-transform transform hover:scale-105"
                            title={isPlaying ? 'Pause' : 'Play'}
                        >
                            {isPlaying ? <PauseIcon /> : <PlayIcon />}
                        </button>
                        <button onClick={onNext} className="p-2 rounded-full hover:bg-gray-700 transition-colors player-text-secondary" title="Next">
                            <NextIcon />
                        </button>
                        <button onClick={onToggleLoop} className={`p-2 rounded-full hover:bg-gray-700 transition-colors ${loop ? 'text-indigo-400' : 'player-text-secondary'}`} title="Loop">
                            <LoopIcon />
                        </button>
                    </div>
                    <div className="w-full flex items-center space-x-2">
                        <span className="text-xs player-text-secondary w-12 text-right">{formatTime(currentTime)}</span>
                        <input
                            type="range"
                            min="0"
                            max={duration || 100}
                            value={currentTime}
                            onChange={(e) => onSeek(parseFloat(e.target.value))}
                            className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer range-sm accent-indigo-500"
                        />
                        <span className="text-xs player-text-secondary w-12">{formatTime(duration)}</span>
                    </div>
                </div>

                <div className="w-full sm:w-1/4 flex items-center justify-center sm:justify-end space-x-2 mt-2 sm:mt-0">
                    <button onClick={onToggleMute} className="p-2 player-text-secondary hover:player-text">
                        {isMuted || volume === 0 ? <VolumeMuteIcon /> : <VolumeUpIcon />}
                    </button>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={isMuted ? 0 : volume}
                        onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                        className="w-24 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer range-sm accent-indigo-500"
                    />
                </div>
            </div>
        </div>
    );
};