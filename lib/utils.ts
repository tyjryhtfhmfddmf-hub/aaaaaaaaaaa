
import type { Song } from '../types';

export const getSongKey = (song: Song) => `${song.title?.toLowerCase()}-${song.artist?.toLowerCase()}`;

export const compareLibraries = (localUser: string, remoteUser: string, localLibrary: Song[], remoteLibrary: Song[]) => {
    const localSongKeys = new Set(localLibrary.map(getSongKey));
    const remoteSongKeys = new Set(remoteLibrary.map(getSongKey));

    const commonSongs = localLibrary.filter(song => remoteSongKeys.has(getSongKey(song)));
    const localOnlySongs = localLibrary.filter(song => !remoteSongKeys.has(getSongKey(song)));
    const remoteOnlySongs = remoteLibrary.filter(song => !localSongKeys.has(getSongKey(song)));

    const localPercentage = localLibrary.length > 0 ? (commonSongs.length / localLibrary.length) * 100 : 0;
    const remotePercentage = remoteLibrary.length > 0 ? (commonSongs.length / remoteLibrary.length) * 100 : 0;

    return {
        localUser,
        remoteUser,
        commonSongs,
        localOnlySongs,
        remoteOnlySongs,
        localPercentage: Math.round(localPercentage),
        remotePercentage: Math.round(remotePercentage),
    };
};
