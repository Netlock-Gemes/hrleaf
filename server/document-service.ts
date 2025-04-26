'use server';

import { Document } from '@/types';

import { fetchDocument } from './document-actions';
import { generateRandomSlug, isDocumentContentEmpty } from './document-utils';
import { connectToMongo, DOCUMENTS_COLLECTION_NAME } from './mongo-config';

/**
 * Create or update a document in MongoDB
 */
export async function createDocument(document: Document): Promise<Document> {
  const db = await connectToMongo();
  const collection = db.collection(DOCUMENTS_COLLECTION_NAME);

  try {
    await collection.updateOne(
      { slug: document.slug, version: document.version || 1 },
      { $set: document },
      { upsert: true },
    );
    return document;
  } catch (error) {
    console.error('Error creating document:', error);
    throw error;
  }
}

/**
 * Update specific fields of a document in MongoDB
 */
export async function updateDocument(
  slug: string,
  updates: Partial<Document>,
  version: number = 1,
): Promise<Document> {
  const db = await connectToMongo();
  const collection = db.collection(DOCUMENTS_COLLECTION_NAME);

  const existingDocument = await getDocumentBySlug(slug);

  if (!existingDocument) {
    throw new Error(`Document with slug ${slug} not found`);
  }

  if (existingDocument.read_only === true) {
    return existingDocument;
  }

  try {
    const result = await collection.findOneAndUpdate(
      { slug, version },
      { $set: updates },
      { returnDocument: 'after' },
    );

    return result?.value as Document;
  } catch (error) {
    console.error('Error updating document fields:', error);
    throw error;
  }
}

/**
 * Get a document by slug
 */
export async function getDocumentBySlug(slug: string): Promise<Document | null> {
  const db = await connectToMongo();
  const collection = db.collection<Document>(DOCUMENTS_COLLECTION_NAME);

  try {
    const document = await collection.findOne({ slug, version: 1 });

    if (!document) return null;

    const { _id, ...docWithoutId } = document as any;
    return docWithoutId as Document;
  } catch (error) {
    console.error('Error fetching document:', error);
    throw error;
  }
}


/**
 * Check if a slug exists
 */
export async function slugExists(slug: string): Promise<boolean> {
  try {
    const document = await getDocumentBySlug(slug);
    return !!document;
  } catch (error) {
    console.error('Error checking slug existence:', error);
    throw error;
  }
}

/**
 * Check if a slug document is empty or doesn't exist
 */
export async function isSlugDocumentEmpty(slug: string): Promise<boolean> {
  try {
    const document = await fetchDocument(slug);
    return !document || await isDocumentContentEmpty(document.content);
  } catch (error) {
    console.error(`Error checking if slug document is empty: ${error}`);
    return true;
  }
}

/**
 * Find an available (unused) slug
 */
export async function findAvailableSlug(
  maxAttempts: number = 20,
): Promise<string> {
  let attempts = 0;
  let lastSlug = '';

  while (attempts < maxAttempts) {
    const slug = await generateRandomSlug();
    lastSlug = slug;

    const isEmpty = await isSlugDocumentEmpty(slug);
    if (isEmpty) {
      return slug;
    }

    attempts++;
  }

  console.warn(`Warning: Could not find empty slug after ${maxAttempts} attempts. Using last generated slug.`);
  return lastSlug;
}
