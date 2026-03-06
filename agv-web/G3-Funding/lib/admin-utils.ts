// Admin utility functions

export const formatDate = (date: any): string => {
  if (!date) return 'N/A';
  
  try {
    // Handle Firestore Timestamp
    if (date && typeof date === 'object' && date.toDate) {
      return date.toDate().toLocaleDateString();
    }
    
    // Handle Firestore Timestamp with seconds/nanoseconds
    if (date && typeof date === 'object' && (date.seconds || date._seconds)) {
      const timestamp = date.seconds || date._seconds;
      return new Date(timestamp * 1000).toLocaleDateString();
    }
    
    // Handle Date object
    if (date instanceof Date) {
      return date.toLocaleDateString();
    }
    
    // Handle string or number
    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) {
      return 'Invalid Date';
    }
    
    return parsedDate.toLocaleDateString();
  } catch (error) {
    console.error('Error formatting date:', error, date);
    return 'Invalid Date';
  }
};

export const formatDateTime = (date: any): string => {
  if (!date) return 'N/A';
  
  try {
    // Handle Firestore Timestamp
    if (date && typeof date === 'object' && date.toDate) {
      return date.toDate().toLocaleString();
    }
    
    // Handle Firestore Timestamp with seconds/nanoseconds
    if (date && typeof date === 'object' && (date.seconds || date._seconds)) {
      const timestamp = date.seconds || date._seconds;
      return new Date(timestamp * 1000).toLocaleString();
    }
    
    // Handle Date object
    if (date instanceof Date) {
      return date.toLocaleString();
    }
    
    // Handle string or number
    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) {
      return 'Invalid Date';
    }
    
    return parsedDate.toLocaleString();
  } catch (error) {
    console.error('Error formatting date:', error, date);
    return 'Invalid Date';
  }
};

export const getStatusColor = (status: string): string => {
  switch (status) {
    case 'new': return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'approved': return 'bg-green-100 text-green-800 border-green-200';
    case 'declined': return 'bg-red-100 text-red-800 border-red-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

export const getTierColor = (tier: string): string => {
  switch (tier) {
    case 'airdrop_hunter': return 'bg-gray-100 text-gray-800 border-gray-200';
    case 'contributor': return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'micro_kol': return 'bg-purple-100 text-purple-800 border-purple-200';
    case 'fund_partner': return 'bg-green-100 text-green-800 border-green-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

export const statusOptions = [
  { value: 'new', label: 'New' },
  { value: 'approved', label: 'Approved' },
  { value: 'declined', label: 'Declined' },
];
