import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ImageDetails } from '../hooks/useImageViewer';
import { FaEye, FaTimes } from 'react-icons/fa';

interface ImageViewerProps {
  isOpen: boolean;
  imageSrc: string;
  title: string;
  imageDetails: ImageDetails | null;
  onClose: () => void;
}

const ImageViewer: React.FC<ImageViewerProps> = ({ 
  isOpen, 
  imageSrc, 
  title, 
  imageDetails, 
  onClose 
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const documents = imageDetails?.documents || [];
  const hasDocuments = documents.length > 0;
  const doc = hasDocuments ? documents[0] : null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          className="fixed inset-0 z-50 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Overlay */}
          <motion.div 
            className="absolute inset-0 bg-black/75 backdrop-blur-sm"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          
          {/* Modal Content */}
          <motion.div 
            className="relative bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-4xl max-h-[90vh] w-full mx-4 overflow-hidden"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {title}
              </h3>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-2xl
                         w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700
                         transition-colors"
                title="Close (Press Esc)"
              >
                <FaTimes className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-4 overflow-y-auto max-h-[calc(90vh-8rem)]">
              {/* Image */}
              <div className="mb-6 rounded-lg overflow-hidden">
                <img
                  src={imageSrc}
                  alt={title}
                  className="w-full h-auto max-h-96 object-contain"
                />
              </div>

              {/* Document Details */}
              {hasDocuments && doc && (
                <motion.div 
                  className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.3 }}
                >
                  <div className="space-y-4">
                    <div>
                     <h4 className="text-base geist font-semibold text-gray-900 dark:text-white mb-2">
                        {doc.title || 'Untitled Document'}
                      </h4>
                      {doc.content && (
                        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                          {doc.content}
                        </p>
                      )}
                    </div>
                    
                    {doc.url && (
                      <div>
                        <button
                          onClick={() => window.open(doc.url, '_blank')}
                          className="text-sm font-medium geist inline-flex items-center px-4 py-2 bg-orange-500 text-white rounded-lg
                                   hover:bg-orange-600 transition-colors focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
                        >
                          <FaEye className="mr-2" />
                          View Document
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
               {/* <motion.div 
                  className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.3 }}
                >
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-base geist font-semibold text-gray-900 dark:text-white mb-2">
                        Untitled Doc
                      </h4>
                        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                          Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
                        </p>
                    </div>
                    
                      <div>
                        <button
                          onClick={() => window.open("#", '_blank')}
                          className="text-sm font-medium geist inline-flex items-center px-4 py-2 bg-orange-500 text-white rounded-lg
                                   hover:bg-orange-600 transition-colors focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
                        >
                          <FaEye className="mr-2" />
                          View Document
                        </button>
                      </div>
                  </div>
                </motion.div> */}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ImageViewer;