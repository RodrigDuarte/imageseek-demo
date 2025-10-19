import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaChevronDown } from 'react-icons/fa';

interface DropdownOption {
  value: string | number;
  label: string;
}

interface DropdownProps {
  value: string | number;
  options: DropdownOption[];
  onChange: (value: string | number) => void;
  label?: string;
  className?: string;
}

const Dropdown: React.FC<DropdownProps> = ({ 
  value, 
  options, 
  onChange, 
  label,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(opt => opt.value === value);
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (optionValue: string | number) => {
    onChange(optionValue);
    setIsOpen(false);
  };

  return (
    <div className={`relative inline-flex items-center ${className}`} ref={dropdownRef}>
      {label && (
        <label className="text-xs font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap mr-2">
          {label}
        </label>
      )}
      
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between space-x-2 px-3 py-2.5 text-xs font-medium
                   bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-900/70
                   text-gray-900 dark:text-white rounded-lg transition-all
                   border border-gray-200 dark:border-gray-700
                   focus:ring-2 focus:ring-blue-500 focus:outline-none min-w-[70px]
                   shadow-sm cursor-pointer"
      >
        <span>{selectedOption?.label || 'Select'}</span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          <FaChevronDown className="w-3 h-3 text-gray-500 dark:text-gray-400" />
        </motion.div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute z-50 mt-2 top-full left-0
                     bg-white dark:bg-gray-800 rounded-lg shadow-xl
                     border border-gray-200 dark:border-gray-700
                     overflow-hidden min-w-full"
          >
            <div className="py-1 max-h-60 overflow-y-auto">
              {options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(option.value)}
                  className={`w-full text-left px-3 py-2 text-xs font-medium transition-colors
                            ${option.value === value
                              ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
                              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer'
                            }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Dropdown;
