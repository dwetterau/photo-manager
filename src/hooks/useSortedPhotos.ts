import { useMemo } from 'react';
import { usePhotoStore, PhotoFile } from '../store/photoStore';

export function useSortedPhotos(): PhotoFile[] {
  const { photos, sortField, sortOrder } = usePhotoStore();

  return useMemo(() => {
    const sorted = [...photos].sort((a, b) => {
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

    return sorted;
  }, [photos, sortField, sortOrder]);
}

