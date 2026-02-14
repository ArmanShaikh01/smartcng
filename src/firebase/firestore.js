// Firestore helper functions
import {
    collection,
    doc,
    getDoc,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    limit,
    onSnapshot,
    serverTimestamp,
    writeBatch
} from 'firebase/firestore';
import { db } from './config';

// Collection references
export const COLLECTIONS = {
    USERS: 'users',
    STATIONS: 'stations',
    BOOKINGS: 'bookings',
    QUEUE_LOGS: 'queue_logs',
    NOTIFICATIONS: 'notifications'
};

/**
 * Create a new document in a collection
 * @param {string} collectionName - Name of the collection
 * @param {object} data - Document data
 * @returns {Promise<DocumentReference>}
 */
export const createDocument = async (collectionName, data) => {
    try {
        const docRef = await addDoc(collection(db, collectionName), {
            ...data,
            createdAt: serverTimestamp()
        });
        return docRef;
    } catch (error) {
        console.error(`Error creating document in ${collectionName}:`, error);
        throw error;
    }
};

/**
 * Get a document by ID
 * @param {string} collectionName - Name of the collection
 * @param {string} docId - Document ID
 * @returns {Promise<DocumentSnapshot>}
 */
export const getDocument = async (collectionName, docId) => {
    try {
        const docRef = doc(db, collectionName, docId);
        const docSnap = await getDoc(docRef);
        return docSnap;
    } catch (error) {
        console.error(`Error getting document from ${collectionName}:`, error);
        throw error;
    }
};

/**
 * Update a document
 * @param {string} collectionName - Name of the collection
 * @param {string} docId - Document ID
 * @param {object} data - Data to update
 * @returns {Promise<void>}
 */
export const updateDocument = async (collectionName, docId, data) => {
    try {
        const docRef = doc(db, collectionName, docId);
        await updateDoc(docRef, {
            ...data,
            updatedAt: serverTimestamp()
        });
    } catch (error) {
        console.error(`Error updating document in ${collectionName}:`, error);
        throw error;
    }
};

/**
 * Delete a document
 * @param {string} collectionName - Name of the collection
 * @param {string} docId - Document ID
 * @returns {Promise<void>}
 */
export const deleteDocument = async (collectionName, docId) => {
    try {
        const docRef = doc(db, collectionName, docId);
        await deleteDoc(docRef);
    } catch (error) {
        console.error(`Error deleting document from ${collectionName}:`, error);
        throw error;
    }
};

/**
 * Query documents with filters
 * @param {string} collectionName - Name of the collection
 * @param {Array} filters - Array of where clauses
 * @param {string} orderByField - Field to order by
 * @param {number} limitCount - Limit number of results
 * @returns {Promise<QuerySnapshot>}
 */
export const queryDocuments = async (collectionName, filters = [], orderByField = null, limitCount = null) => {
    try {
        let q = collection(db, collectionName);

        // Apply filters
        filters.forEach(filter => {
            q = query(q, where(filter.field, filter.operator, filter.value));
        });

        // Apply ordering
        if (orderByField) {
            q = query(q, orderBy(orderByField));
        }

        // Apply limit
        if (limitCount) {
            q = query(q, limit(limitCount));
        }

        const querySnapshot = await getDocs(q);
        return querySnapshot;
    } catch (error) {
        console.error(`Error querying ${collectionName}:`, error);
        throw error;
    }
};

/**
 * Listen to real-time updates on a document
 * @param {string} collectionName - Name of the collection
 * @param {string} docId - Document ID
 * @param {function} callback - Callback function to handle updates
 * @returns {function} Unsubscribe function
 */
export const listenToDocument = (collectionName, docId, callback) => {
    const docRef = doc(db, collectionName, docId);
    return onSnapshot(docRef, callback);
};

/**
 * Listen to real-time updates on a query
 * @param {string} collectionName - Name of the collection
 * @param {Array} filters - Array of where clauses
 * @param {function} callback - Callback function to handle updates
 * @param {string} orderByField - Field to order by
 * @returns {function} Unsubscribe function
 */
export const listenToQuery = (collectionName, filters = [], callback, orderByField = null) => {
    let q = collection(db, collectionName);

    // Apply filters
    filters.forEach(filter => {
        q = query(q, where(filter.field, filter.operator, filter.value));
    });

    // Apply ordering
    if (orderByField) {
        q = query(q, orderBy(orderByField));
    }

    return onSnapshot(q, callback);
};

/**
 * Batch write operations
 * @param {Array} operations - Array of operations {type, collection, docId, data}
 * @returns {Promise<void>}
 */
export const batchWrite = async (operations) => {
    try {
        const batch = writeBatch(db);

        operations.forEach(op => {
            const docRef = op.docId
                ? doc(db, op.collection, op.docId)
                : doc(collection(db, op.collection));

            switch (op.type) {
                case 'set':
                    batch.set(docRef, op.data);
                    break;
                case 'update':
                    batch.update(docRef, op.data);
                    break;
                case 'delete':
                    batch.delete(docRef);
                    break;
                default:
                    console.warn(`Unknown operation type: ${op.type}`);
            }
        });

        await batch.commit();
    } catch (error) {
        console.error('Error in batch write:', error);
        throw error;
    }
};

export { serverTimestamp };
