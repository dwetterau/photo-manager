import { useMemo } from 'react';
import { usePhotoStore, PhotoFile } from '../store/photoStore';

export interface DuplicateGroup {
  originalId: string;
  original: PhotoFile;
  duplicates: PhotoFile[];
}

export function useSortedPhotos(): PhotoFile[] {
  const { photos, sortField, sortOrder, filterMode, loading } = usePhotoStore();

  return useMemo(() => {
    // Don't compute while loading - return empty array to avoid expensive operations
    if (loading || photos.length === 0) {
      return [];
    }

    // Filter based on filterMode
    let filtered: PhotoFile[];
    
    if (filterMode === 'duplicates') {
      // Only show photos that are duplicates or originals of duplicates
      // Use a single pass to collect both
      const duplicateOriginalIds = new Set<string>();
      const duplicates: PhotoFile[] = [];
      
      for (const p of photos) {
        if (p.isDuplicate && p.duplicateOf) {
          duplicateOriginalIds.add(p.duplicateOf);
          duplicates.push(p);
        }
      }
      
      // Second pass: add originals
      const originals: PhotoFile[] = [];
      for (const p of photos) {
        if (duplicateOriginalIds.has(p.id)) {
          originals.push(p);
        }
      }
      
      filtered = [...originals, ...duplicates];
    } else {
      // For "all" mode, just reference the array (don't copy yet)
      filtered = photos;
    }
    
    // Sort in place if we already have a copy, otherwise copy first
    const toSort = filtered === photos ? [...filtered] : filtered;
    toSort.sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'date':
          comparison = a.modifiedAt - b.modifiedAt;
          break;
        case 'size':
          comparison = a.size - b.size;
          break;
        case 'path':
          comparison = a.path.localeCompare(b.path);
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return toSort;
  }, [photos, sortField, sortOrder, filterMode, loading]);
}

// Hook to get photos grouped by duplicate relationship
export function useDuplicateGroups(): DuplicateGroup[] {
  const { photos, filterMode, loading, sortField, sortOrder } = usePhotoStore();

  return useMemo(() => {
    // Don't compute while loading
    if (loading || filterMode !== 'duplicates' || photos.length === 0) {
      return [];
    }

    // First, build a Map of photo id -> photo for O(1) lookups
    const photoById = new Map<string, PhotoFile>();
    for (const photo of photos) {
      photoById.set(photo.id, photo);
    }

    // Build groups: collect all photos that share a content hash
    const groupMap = new Map<string, PhotoFile[]>();

    for (const photo of photos) {
      if (photo.isDuplicate && photo.duplicateOf) {
        // Get the original to find the content hash group
        const original = photoById.get(photo.duplicateOf);
        if (original) {
          const groupKey = photo.duplicateOf;
          let members = groupMap.get(groupKey);
          if (!members) {
            members = [original];
            groupMap.set(groupKey, members);
          }
          members.push(photo);
        }
      }
    }

    // Convert to DuplicateGroup format, sorting by path length so shortest becomes the header
    const groups: DuplicateGroup[] = [];
    for (const members of groupMap.values()) {
      // Sort by path length (shortest first)
      members.sort((a, b) => a.path.length - b.path.length);
      
      const [header, ...rest] = members;
      groups.push({
        originalId: header.id,
        original: header,
        duplicates: rest,
      });
    }

    // Sort groups based on sortField and sortOrder
    groups.sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case 'name':
          comparison = a.original.name.localeCompare(b.original.name);
          break;
        case 'date':
          comparison = a.original.modifiedAt - b.original.modifiedAt;
          break;
        case 'size':
          comparison = a.original.size - b.original.size;
          break;
        case 'path':
          comparison = a.original.path.localeCompare(b.original.path);
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    
    return groups;
  }, [photos, filterMode, loading, sortField, sortOrder]);
}

