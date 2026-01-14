import { usePhotoStore, PhotoFile } from '../store/photoStore';
import { convertFileSrc } from '@tauri-apps/api/tauri';
import clsx from 'clsx';

interface PhotoCardProps {
  photo: PhotoFile;
}

export function PhotoCard({ photo }: PhotoCardProps) {
  const { selectedIds, toggleSelection, selectPhoto, photos } = usePhotoStore();
  const isSelected = selectedIds.has(photo.id);

  // Get the original file name if this is a duplicate
  const duplicateOfName = photo.duplicateOf
    ? photos.find((p) => p.id === photo.duplicateOf)?.name ||
      photo.duplicateOf.split('/').pop()
    : null;

  const handleClick = (e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey) {
      toggleSelection(photo.id);
    } else {
      selectPhoto(photo.id);
    }
  };

  // Convert file path to asset URL for Tauri
  const thumbnailSrc = photo.thumbnailPath
    ? convertFileSrc(photo.thumbnailPath)
    : null;

  return (
    <div
      onClick={handleClick}
      className={clsx(
        'group relative cursor-pointer overflow-hidden rounded-lg border-2 bg-surface-800 transition-all',
        isSelected
          ? 'border-accent shadow-lg shadow-accent/20'
          : 'border-transparent hover:border-surface-600'
      )}
    >
      {/* Selection checkbox */}
      <div
        className={clsx(
          'absolute left-2 top-2 z-10 transition-opacity',
          isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        )}
      >
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => toggleSelection(photo.id)}
          onClick={(e) => e.stopPropagation()}
          className="h-5 w-5 rounded border-2 border-white/50 bg-black/30 text-accent backdrop-blur-sm focus:ring-accent"
        />
      </div>

      {/* Badges */}
      <div className="absolute right-2 top-2 z-10 flex flex-col items-end gap-1">
        {photo.isDuplicate && duplicateOfName && (
          <span
            className="max-w-[120px] truncate rounded bg-yellow-500/90 px-1.5 py-0.5 text-xs font-medium text-black shadow"
            title={`Duplicate of: ${duplicateOfName}`}
          >
            ≈ {duplicateOfName}
          </span>
        )}
        {photo.relatedFiles.length > 0 && (
          <span
            className="rounded bg-blue-500/90 px-1.5 py-0.5 text-xs font-medium text-white shadow"
            title={photo.relatedFiles.map((f) => f.name).join(', ')}
          >
            +{photo.relatedFiles.length}
          </span>
        )}
      </div>

      {/* Thumbnail */}
      <div className="aspect-square w-full overflow-hidden bg-surface-900">
        {thumbnailSrc ? (
          <img
            src={thumbnailSrc}
            alt={photo.name}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center text-surface-600">
            <svg
              className="h-12 w-12"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <span className="mt-1 text-xs uppercase">{photo.extension}</span>
          </div>
        )}
      </div>

      {/* Info overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent p-3 pt-8">
        <p className="truncate text-sm font-medium text-white">{photo.name}</p>
        <p className="truncate text-xs text-surface-300">{photo.directory}</p>
      </div>

      {/* Extension badge */}
      <div className="absolute bottom-2 right-2">
        <span className="rounded bg-black/50 px-1.5 py-0.5 font-mono text-xs uppercase text-surface-300 backdrop-blur-sm">
          {photo.extension}
        </span>
      </div>
    </div>
  );
}
