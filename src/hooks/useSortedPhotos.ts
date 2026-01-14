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
  const { photos, filterMode, loading } = usePhotoStore();

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

    // Build groups in a single pass
    const groupMap = new Map<string, DuplicateGroup>();

    for (const photo of photos) {
      if (photo.isDuplicate && photo.duplicateOf) {
        let group = groupMap.get(photo.duplicateOf);
        
        if (!group) {
          // O(1) lookup instead of O(n) .find()
          const original = photoById.get(photo.duplicateOf);
          if (original) {
            group = {
              originalId: photo.duplicateOf,
              original,
              duplicates: [],
            };
            groupMap.set(photo.duplicateOf, group);
          }
        }
        
        if (group) {
          group.duplicates.push(photo);
        }
      }
    }

    // Convert to array and sort by original name
    const groups = Array.from(groupMap.values());
    groups.sort((a, b) => a.original.name.localeCompare(b.original.name));
    return groups;
  }, [photos, filterMode, loading]);
}

