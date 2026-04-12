import { request } from './api';
import { SecureFolder, FolderNote, FolderFile } from '../types';

export const docService = {
    getFolders: async (includeDeleted = false): Promise<SecureFolder[]> => {
        return request(`/docs${includeDeleted ? '?deleted=true' : ''}`);
    },

    createFolder: async (payload: { name: string; description?: string; crisisId?: string | null }): Promise<SecureFolder> => {
        return request('/docs', {
            method: 'POST',
            body: payload
        });
    },

    getActiveCrises: async (): Promise<{ id: string; title: string; status: string }[]> => {
        return request('/docs/active-crises');
    },

    getFolderDetails: async (folderId: string): Promise<SecureFolder> => {
        return request(`/docs/${folderId}`);
    },

    addNote: async (folderId: string, content: string, lat?: number, lng?: number): Promise<FolderNote> => {
        return request(`/docs/${folderId}/notes`, {
            method: 'POST',
            body: { content, lat, lng }
        });
    },

    uploadFile: async (folderId: string, file: File, lat?: number, lng?: number): Promise<FolderFile> => {
        const formData = new FormData();
        formData.append('file', file);
        if (lat) formData.append('lat', lat.toString());
        if (lng) formData.append('lng', lng.toString());

        return request(`/docs/${folderId}/files`, {
            method: 'POST',
            body: formData
        });
    },

    shareFolder: async (folderId: string, expiresInHours: string): Promise<{
        shareUrl: string;
        expiresAt: string | null
    }> => {
        return request(`/docs/${folderId}/share`, {
            method: 'POST',
            body: { expiresInHours }
        });
    },

    revokeShare: async (folderId: string): Promise<void> => {
        return request(`/docs/${folderId}/share`, {
            method: 'DELETE'
        });
    },

    deleteFile: async (folderId: string, fileId: string) => {
        return request(`/docs/${folderId}/files/${fileId}`, {
            method: 'DELETE'
        });
    },

    restoreFile: async (folderId: string, fileId: string) => {
        return request(`/docs/${folderId}/files/${fileId}/restore`, {
            method: 'POST'
        });
    },

    updateFileDescription: async (folderId: string, fileId: string, description: string) => {
        return request(`/docs/${folderId}/files/${fileId}`, {
            method: 'PATCH',
            body: { description }
        });
    },

    deleteNote: async (folderId: string, noteId: string) => {
        return request(`/docs/${folderId}/notes/${noteId}`, {
            method: 'DELETE'
        });
    },

    restoreNote: async (folderId: string, noteId: string) => {
        return request(`/docs/${folderId}/notes/${noteId}/restore`, {
            method: 'POST'
        });
    },

    deleteFolder: async (folderId: string, permanent = false): Promise<void> => {
        return request(`/docs/${folderId}${permanent ? '?permanent=true' : ''}`, {
            method: 'DELETE'
        });
    },

    restoreFolder: async (folderId: string): Promise<void> => {
        return request(`/docs/${folderId}/restore`, {
            method: 'POST'
        });
    },

    togglePin: async (folderId: string): Promise<SecureFolder> => {
        return request(`/docs/${folderId}/pin`, {
            method: 'POST'
        });
    }
};
