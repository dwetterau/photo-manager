import { DuplicateGroup } from '../hooks/useSortedPhotos';
import { PhotoFile } from '../store/photoStore';

// Check if a path is in Camera Uploads (works with full or shortened paths)
export function isCameraUploadsPath(path: string): boolean {
  return path.includes('/Dropbox/Camera Uploads/') || 
         path.includes('Dropbox/Camera Uploads/');
}

// Check if a path is in a year folder within Camera Uploads
// e.g., /Dropbox/Camera Uploads/2022/photo.jpg
export function isYearFolderPath(path: string): boolean {
  // Match /Camera Uploads/YYYY/ where YYYY is a 4-digit year
  return /\/Camera Uploads\/\d{4}\//.test(path);
}

// Check if a filename is date/time named (like "2023-04-08 10.25.37.arw")
// vs camera-generated names (like "DSC00628.ARW", "IMG_1234.jpg")
export function isDateNamedFile(path: string): boolean {
  // Extract filename from path
  const filename = path.split('/').pop() || '';
  // Match filenames starting with YYYY-MM-DD pattern
  return /^\d{4}-\d{2}-\d{2}/.test(filename);
}

// Check if any duplicate group has ALL its photos selected (which would delete all copies)
// Returns the number of groups that have this problem
export function getFullySelectedGroups(groups: DuplicateGroup[], selectedIds: Set<string>): number {
  let count = 0;
  
  for (const group of groups) {
    const allPhotos = [group.original, ...group.duplicates];
    const allSelected = allPhotos.every(p => selectedIds.has(p.id));
    
    if (allSelected) {
      count++;
    }
  }
  
  return count;
}

// Smart select: returns IDs of photos to select for deletion based on rules
export function getSmartSelections(groups: DuplicateGroup[]): Set<string> {
  const toSelect = new Set<string>();
  
  for (const group of groups) {
    const allPhotos = [group.original, ...group.duplicates];
    
    // Apply rules in order of priority
    const photosToDelete = applySmartRules(allPhotos);
    
    for (const photo of photosToDelete) {
      toSelect.add(photo.id);
    }
  }
  
  return toSelect;
}

// Apply smart selection rules to a group of duplicate photos
// Returns the photos that should be selected for deletion
//
// Rules are applied in priority order. Each rule can narrow down the "keep" set.
// Photos not in the final "keep" set are marked for deletion.
function applySmartRules(photos: PhotoFile[]): PhotoFile[] {
  if (photos.length <= 1) return [];
  
  let candidates = photos;
  const toDelete: PhotoFile[] = [];
  
  // Rule 1: Camera Uploads year folders are highest priority
  // If some photos are in Camera Uploads year folders and others aren't, keep the year folder ones
  const inYearFolder = candidates.filter(p => isYearFolderPath(p.path));
  const notInYearFolder = candidates.filter(p => !isYearFolderPath(p.path));
  
  if (inYearFolder.length > 0 && notInYearFolder.length > 0) {
    // Eliminate non-year-folder photos, continue with year folder ones
    toDelete.push(...notInYearFolder);
    candidates = inYearFolder;
  }
  
  // Rule 2: Prefer date-named files over camera-generated names (DSC, IMG, etc.)
  // Only applies if we still have multiple candidates
  if (candidates.length > 1) {
    const dateNamed = candidates.filter(p => isDateNamedFile(p.path));
    const notDateNamed = candidates.filter(p => !isDateNamedFile(p.path));
    
    if (dateNamed.length > 0 && notDateNamed.length > 0) {
      // Eliminate camera-named photos, continue with date-named ones
      toDelete.push(...notDateNamed);
      candidates = dateNamed;
    }
  }
  
  // Rule 3: Prefer Camera Uploads over non-Camera Uploads
  // Only applies if we still have multiple candidates
  if (candidates.length > 1) {
    const cameraUploads = candidates.filter(p => isCameraUploadsPath(p.path));
    const nonCameraUploads = candidates.filter(p => !isCameraUploadsPath(p.path));
    
    if (cameraUploads.length > 0 && nonCameraUploads.length > 0) {
      // Eliminate non-Camera Uploads photos
      toDelete.push(...nonCameraUploads);
      // candidates = cameraUploads; // Not needed as this is the last rule
    }
  }
  
  return toDelete;
}
