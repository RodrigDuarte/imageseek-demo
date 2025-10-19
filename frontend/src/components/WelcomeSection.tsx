import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

interface WelcomeSectionProps {
  onQuerySelect: (query: string) => void;
}

const WelcomeSection: React.FC<WelcomeSectionProps> = ({ onQuerySelect }) => {
  const { t } = useTranslation();

  const exampleQueries = [
    {
      category: t('welcome.categories.sports'),
      queries: [
        t('welcome.queries.cycling'),
        t('welcome.queries.football'),
        t('welcome.queries.swimming')
      ]
    },
    {
      category: t('welcome.categories.president'),
      queries: [
        t('welcome.queries.presidentSwimming'),
        t('welcome.queries.presidentReading'),
        t('welcome.queries.presidentSpeech')
      ]
    },
    {
      category: t('welcome.categories.objects'),
      queries: [
        t('welcome.queries.painting'),
        t('welcome.queries.book'),
        t('welcome.queries.flag')
      ]
    },
    {
      category: t('welcome.categories.others'),
      queries: [
        t('welcome.queries.doctors'),
        t('welcome.queries.peopleWorking'),
        t('welcome.queries.vaccinations')
      ]
    }
  ];
  
  // Animation variants for staggered children
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
    }
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 20, scale: 0.95 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: 0.4,
        ease: "easeOut" as const
      }
    }
  };

  const buttonVariants = {
    hidden: { opacity: 0, x: -10 },
    visible: {
      opacity: 1,
      x: 0,
      transition: {
        duration: 0.3
      }
    }
  };

  return (
    <div className="rounded-lg">
      <motion.div 
        className="mb-2"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
      <h1 className='text-xs font-medium text-gray-600 dark:text-gray-400'>
        {t('welcome.title')}
      </h1>
      </motion.div>
      <motion.div 
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {exampleQueries.map((category) => (
          <motion.div 
            key={category.category} 
            className="space-y-3 p-4 rounded-xl bg-slate-200 dark:bg-gray-700"
            variants={cardVariants}
          >
            <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300">
              {category.category}
            </h4>
            <motion.div 
              className="space-y-2"
              initial="hidden"
              animate="visible"
              transition={{ staggerChildren: 0.05, delayChildren: 0.1 }}
            >
              {category.queries.map((query) => (
                <motion.button
                  key={query}
                  onClick={() => onQuerySelect(query)}
                  className="block w-full text-left px-3 py-2 text-sm rounded-md
                           bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300
                           hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors
                           focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 cursor-pointer"
                  variants={buttonVariants}
                  whileHover={{ scale: 1.02, x: 4 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {query}
                </motion.button>
              ))}
            </motion.div>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
};

export default WelcomeSection;