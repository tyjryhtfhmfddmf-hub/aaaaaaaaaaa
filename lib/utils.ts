import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import type { Song, ComparisonData } from '../types';
 
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const getSongKey = (song: Song): string => {
  return `${song.title.toLowerCase()}_${song.artist.toLowerCase()}`;
};

export const compareLibraries = (
    localUser: string,
    remoteUser: string,
    localLibrary: Song[],
    remoteLibrary: Song[]
): ComparisonData => {
    const localKeys = new Set(localLibrary.map(getSongKey));
    const remoteKeys = new Set(remoteLibrary.map(getSongKey));

    const commonKeys = [...localKeys].filter(key => remoteKeys.has(key));
    const localOnlyKeys = [...localKeys].filter(key => !remoteKeys.has(key));
    const remoteOnlyKeys = [...remoteKeys].filter(key => !localKeys.has(key));

    const getTitleFromKey = (key: string) => {
        const song = localLibrary.find(s => getSongKey(s) === key) || remoteLibrary.find(s => getSongKey(s) === key);
        return song ? `${song.title} by ${song.artist}` : 'Unknown Song';
    };

    return {
        localUser,
        remoteUser,
        commonSongs: commonKeys.map(getTitleFromKey),
        localOnlySongs: localOnlyKeys.map(getTitleFromKey),
        remoteOnlySongs: remoteOnlyKeys.map(getTitleFromKey),
    };
};
