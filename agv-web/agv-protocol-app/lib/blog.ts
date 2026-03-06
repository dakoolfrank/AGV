import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  where,
  Timestamp 
} from 'firebase/firestore';
import { db } from './firebase';

export interface BlogPost {
  id?: string;
  title: string;
  content: string;
  excerpt: string;
  featuredImage: string;
  category: 'ANNOUNCEMENTS' | 'TECH' | 'COMMUNITY';
  tags: string[];
  author: string;
  authorEmail: string;
  published: boolean;
  featured: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  publishedAt?: Timestamp;
  views: number;
  slug: string;
}

export interface BlogFilters {
  category?: string;
  search?: string;
  published?: boolean;
  featured?: boolean;
}

// Get all blog posts
export const getBlogPosts = async (filters?: BlogFilters): Promise<BlogPost[]> => {
  try {
    // Start with basic query - get all documents first
    let q = query(collection(db, 'blogs'));
    
    // Only add where clauses if we have specific filters
    // Avoid composite index issues by using simpler queries
    if (filters?.published !== undefined) {
      q = query(q, where('published', '==', filters.published));
    } else if (filters?.category && filters.category !== 'ALL') {
      q = query(q, where('category', '==', filters.category));
    } else if (filters?.featured !== undefined) {
      q = query(q, where('featured', '==', filters.featured));
    }

    const querySnapshot = await getDocs(q);
    let posts = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as BlogPost[];

    // Apply additional filters on client side to avoid composite index issues
    if (filters?.category && filters.category !== 'ALL' && filters.published !== undefined) {
      posts = posts.filter(post => post.category === filters.category);
    }
    
    if (filters?.featured !== undefined && filters.published !== undefined) {
      posts = posts.filter(post => post.featured === filters.featured);
    }

    // Apply search filter on client side
    if (filters?.search) {
      const searchTerm = filters.search.toLowerCase();
      posts = posts.filter(post => 
        post.title.toLowerCase().includes(searchTerm) ||
        post.excerpt.toLowerCase().includes(searchTerm) ||
        post.content.toLowerCase().includes(searchTerm) ||
        post.tags.some(tag => tag.toLowerCase().includes(searchTerm))
      );
    }

    // Sort by createdAt on client side to avoid composite index
    posts.sort((a, b) => {
      const aTime = a.createdAt?.toDate?.() || new Date(a.createdAt);
      const bTime = b.createdAt?.toDate?.() || new Date(b.createdAt);
      return bTime.getTime() - aTime.getTime();
    });

    return posts;
  } catch (error) {
    console.error('Error getting blog posts:', error);
    return [];
  }
};

// Get a single blog post by ID
export const getBlogPost = async (id: string): Promise<BlogPost | null> => {
  try {
    const docRef = doc(db, 'blogs', id);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as BlogPost;
    } else {
      return null;
    }
  } catch (error) {
    console.error('Error getting blog post:', error);
    return null;
  }
};

// Get a blog post by slug
export const getBlogPostBySlug = async (slug: string): Promise<BlogPost | null> => {
  try {
    const q = query(collection(db, 'blogs'), where('slug', '==', slug));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      return { id: doc.id, ...doc.data() } as BlogPost;
    } else {
      return null;
    }
  } catch (error) {
    console.error('Error getting blog post by slug:', error);
    return null;
  }
};

// Create a new blog post
export const createBlogPost = async (post: Omit<BlogPost, 'id' | 'createdAt' | 'updatedAt' | 'views'>): Promise<string | null> => {
  try {
    const now = Timestamp.now();
    const postData = {
      ...post,
      createdAt: now,
      updatedAt: now,
      views: 0
    };
    
    const docRef = await addDoc(collection(db, 'blogs'), postData);
    return docRef.id;
  } catch (error) {
    console.error('Error creating blog post:', error);
    return null;
  }
};

// Update a blog post
export const updateBlogPost = async (id: string, updates: Partial<BlogPost>): Promise<boolean> => {
  try {
    const docRef = doc(db, 'blogs', id);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: Timestamp.now()
    });
    return true;
  } catch (error) {
    console.error('Error updating blog post:', error);
    return false;
  }
};

// Delete a blog post
export const deleteBlogPost = async (id: string): Promise<boolean> => {
  try {
    const docRef = doc(db, 'blogs', id);
    await deleteDoc(docRef);
    return true;
  } catch (error) {
    console.error('Error deleting blog post:', error);
    return false;
  }
};

// Increment view count
export const incrementViewCount = async (id: string): Promise<boolean> => {
  try {
    const docRef = doc(db, 'blogs', id);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const currentViews = docSnap.data().views || 0;
      await updateDoc(docRef, {
        views: currentViews + 1,
        updatedAt: Timestamp.now()
      });
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error incrementing view count:', error);
    return false;
  }
};

// Generate slug from title
export const generateSlug = (title: string): string => {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
};
