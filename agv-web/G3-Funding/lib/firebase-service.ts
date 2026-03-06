import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  query, 
  orderBy
} from 'firebase/firestore';
import { db } from './firebase';
import { InstitutionalApplication, ContributorApplication, AdminStats } from './types';

// Collections
const INSTITUTIONAL_COLLECTION = 'institutional_applications';
const CONTRIBUTOR_COLLECTION = 'contributor_applications';

// Institutional Application Functions
export const createInstitutionalApplication = async (
  data: Omit<InstitutionalApplication, 'id' | 'createdAt' | 'updatedAt' | 'status'>,
  files?: File[]
) => {
  try {
    const formData = new FormData();
    formData.append('applicationData', JSON.stringify(data));
    
    if (files && files.length > 0) {
      files.forEach(file => {
        formData.append('files', file);
      });
    }

    const response = await fetch('/api/applications/institutional', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to create application');
    }

    const result = await response.json();
    return result.id;
  } catch (error) {
    console.error('Error creating institutional application:', error);
    throw error;
  }
};

export const updateInstitutionalApplication = async (id: string, data: Partial<InstitutionalApplication>) => {
  try {
    const response = await fetch('/api/admin/update-institutional-application', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        appId: id,
        updates: data
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to update application');
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error updating institutional application:', error);
    throw error;
  }
};

export const getInstitutionalApplication = async (id: string) => {
  try {
    const docRef = doc(db, INSTITUTIONAL_COLLECTION, id);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as InstitutionalApplication;
    }
    return null;
  } catch (error) {
    console.error('Error getting institutional application:', error);
    throw error;
  }
};

export const getAllInstitutionalApplications = async () => {
  try {
    const q = query(collection(db, INSTITUTIONAL_COLLECTION), orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as InstitutionalApplication[];
  } catch (error) {
    console.error('Error getting institutional applications:', error);
    throw error;
  }
};

// Contributor Application Functions
export const createContributorApplication = async (
  data: Omit<ContributorApplication, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'tier'>,
  files?: File[]
) => {
  try {
    const formData = new FormData();
    formData.append('applicationData', JSON.stringify(data));
    
    if (files && files.length > 0) {
      files.forEach(file => {
        formData.append('files', file);
      });
    }

    const response = await fetch('/api/applications/contributor', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to create application');
    }

    const result = await response.json();
    return result.id;
  } catch (error) {
    console.error('Error creating contributor application:', error);
    throw error;
  }
};

export const updateContributorApplication = async (id: string, data: Partial<ContributorApplication>) => {
  try {
    const response = await fetch('/api/admin/update-contributor-application', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        appId: id,
        updates: data
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to update application');
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error updating contributor application:', error);
    throw error;
  }
};

export const getContributorApplication = async (id: string) => {
  try {
    const docRef = doc(db, CONTRIBUTOR_COLLECTION, id);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as ContributorApplication;
    }
    return null;
  } catch (error) {
    console.error('Error getting contributor application:', error);
    throw error;
  }
};

export const getAllContributorApplications = async () => {
  try {
    const q = query(collection(db, CONTRIBUTOR_COLLECTION), orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as ContributorApplication[];
  } catch (error) {
    console.error('Error getting contributor applications:', error);
    throw error;
  }
};


// Admin dashboard functions
export const getAdminStats = async (): Promise<AdminStats> => {
  try {
    const [institutionalApps, contributorApps] = await Promise.all([
      getAllInstitutionalApplications(),
      getAllContributorApplications()
    ]);
    
    // Calculate institutional stats
    const institutionalByStatus = institutionalApps.reduce((acc, app) => {
      acc[app.status] = (acc[app.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const institutionalByType = institutionalApps.reduce((acc, app) => {
      app.purposeAndFit.primaryIntent.forEach(intent => {
        acc[intent] = (acc[intent] || 0) + 1;
      });
      return acc;
    }, {} as Record<string, number>);
    
    // Calculate contributor stats
    const contributorByStatus = contributorApps.reduce((acc, app) => {
      acc[app.status] = (acc[app.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const contributorByTier = contributorApps.reduce((acc, app) => {
      acc[app.tier] = (acc[app.tier] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    // Get recent applications (last 10)
    const recentApplications = [
      ...institutionalApps.slice(0, 5),
      ...contributorApps.slice(0, 5)
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 10);
    
    return {
      institutionalApplications: {
        total: institutionalApps.length,
        byStatus: institutionalByStatus,
        byType: institutionalByType
      },
      contributorApplications: {
        total: contributorApps.length,
        byStatus: contributorByStatus,
        byTier: contributorByTier
      },
      recentApplications
    };
  } catch (error) {
    console.error('Error getting admin stats:', error);
    throw error;
  }
};

// Validation helpers
export const validateEthereumAddress = (address: string): boolean => {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
};

export const validateContractAddress = (address: string): boolean => {
  return validateEthereumAddress(address);
};
