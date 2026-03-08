import axios from 'axios';
import {SecureFolder, FolderNote, FolderFile} from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

const apiClient = axios.create({
    baseURL: API_URL,
    withCredentials: true, // Crucial for sending your auth cookie
});

export const docService = {
    getFolders: async (): Promise<SecureFolder[]> => {
        const {data} = await apiClient.get('/docs');
        return data;
    },

    createFolder: async (payload: { name: string; description?: string }): Promise<SecureFolder> => {
        const {data} = await apiClient.post('/docs', payload);
        return data;
    },

    getFolderDetails: async (folderId: string): Promise<SecureFolder> => {
        const {data} = await apiClient.get(`/docs/${folderId}`);
        return data;
    },

    addNote: async (folderId: string, content: string, lat?: number, lng?: number): Promise<FolderNote> => {
        const {data} = await apiClient.post(`/docs/${folderId}/notes`, {content, lat, lng});
        return data;
    },

    uploadFile: async (folderId: string, file: File, lat?: number, lng?: number): Promise<FolderFile> => {
        const formData = new FormData();
        formData.append('file', file);
        if (lat) formData.append('lat', lat.toString());
        if (lng) formData.append('lng', lng.toString());

        const {data} = await apiClient.post(`/docs/${folderId}/files`, formData, {
            headers: {'Content-Type': 'multipart/form-data'},
        });
        return data;
    },

    shareFolder: async (folderId: string, expiresInHours: string): Promise<{
        shareUrl: string;
        expiresAt: string | null
    }> => {
        const {data} = await apiClient.post(`/docs/${folderId}/share`, {expiresInHours});
        return data;
    },
    // Add to frontend docService
    deleteFile: async (folderId: string, fileId: string) => {
        return apiClient.delete(`/docs/${folderId}/files/${fileId}`);
    },
    deleteNote: async (folderId: string, noteId: string) => {
        return apiClient.delete(`/docs/${folderId}/notes/${noteId}`);
    },
    deleteFolder: async (folderId: string): Promise<void> => {
        // By default, your backend controller handles the soft-delete logic
        await apiClient.delete(`/docs/${folderId}`);

    }
};
