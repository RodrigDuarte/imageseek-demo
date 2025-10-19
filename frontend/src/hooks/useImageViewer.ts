import { useState, useCallback } from 'react';
import { apiEndpoints } from '../config/env';

export interface ImageDetails {
  documents?: Array<{
    title?: string;
    content?: string;
    url?: string;
  }>;
}

export const useImageViewer = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [imageSrc, setImageSrc] = useState('');
  const [title, setTitle] = useState('');
  const [imageHash, setImageHash] = useState<string | null>(null);
  const [imageDetails, setImageDetails] = useState<ImageDetails | null>(null);

  const openImageViewer = useCallback(async (src: string, imageTitle: string, hash?: string) => {
    setImageSrc(src);
    setTitle(imageTitle || 'Image');
    setImageHash(hash || null);
    setImageDetails(null);
    setIsOpen(true);

    // Prevent body scroll
    document.body.style.overflow = 'hidden';

    // Fetch image details if hash is available
    if (hash) {
      try {
        const response = await fetch(apiEndpoints.imageDetails(hash));
        if (response.ok) {
          const data = await response.json();
          setImageDetails(data);
        }
      } catch (error) {
        console.error('Failed to fetch image details:', error);
      }
    }
  }, []);

  const closeImageViewer = useCallback(() => {
    setIsOpen(false);
    setImageSrc('');
    setTitle('');
    setImageHash(null);
    setImageDetails(null);

    // Restore body scroll
    document.body.style.overflow = '';
  }, []);

  const extractImageHash = useCallback((imgSrc: string, imgAlt?: string): string | null => {
    const hashMatch = imgSrc.match(/\/image\/([a-f0-9]+)/);
    if (hashMatch) {
      return hashMatch[1];
    }

    if (imgAlt && imgAlt.length > 10) {
      return imgAlt;
    }

    return null;
  }, []);

  return {
    isOpen,
    imageSrc,
    title,
    imageHash,
    imageDetails,
    openImageViewer,
    closeImageViewer,
    extractImageHash,
  };
};