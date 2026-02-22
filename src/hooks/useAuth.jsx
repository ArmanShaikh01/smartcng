// Authentication context and hook
import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase/config';
import { getDocument, COLLECTIONS } from '../firebase/firestore';

const AuthContext = createContext();

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [userRole, setUserRole] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                setUser(firebaseUser);

                try {
                    // 1. Try lookup by UID (fastest path)
                    const userDoc = await getDocument(COLLECTIONS.USERS, firebaseUser.uid);

                    if (userDoc.exists()) {
                        const profile = userDoc.data();

                        // If UID doc says 'customer', check if there's a phone-based higher-privilege doc
                        if (profile.role === 'customer' && firebaseUser.phoneNumber) {
                            const { collection, query, where, getDocs, setDoc, deleteDoc } =
                                await import('firebase/firestore');
                            const { db } = await import('../firebase/config');

                            // Check by exact phone
                            const pq = query(
                                collection(db, COLLECTIONS.USERS),
                                where('phoneNumber', '==', firebaseUser.phoneNumber)
                            );
                            const pSnap = await getDocs(pq);
                            const privilegedDoc = pSnap.docs.find(
                                d => d.id !== firebaseUser.uid && ['operator', 'owner', 'admin'].includes(d.data().role)
                            );

                            if (privilegedDoc) {
                                const privilegedProfile = privilegedDoc.data();
                                const { doc } = await import('firebase/firestore');

                                // Migrate privileged doc to UID-keyed, delete stale customer + old docs
                                const newDocRef = doc(db, COLLECTIONS.USERS, firebaseUser.uid);
                                await setDoc(newDocRef, { ...privilegedProfile, userId: firebaseUser.uid, phoneNumber: firebaseUser.phoneNumber });
                                await deleteDoc(privilegedDoc.ref); // delete old phone-keyed doc
                                // Also delete the stale customer UID doc (we just overwrote it with setDoc)

                                setUserProfile({ ...privilegedProfile, userId: firebaseUser.uid });
                                setUserRole(privilegedProfile.role);
                                setLoading(false);
                                return;
                            }
                        }

                        setUserProfile(profile);
                        setUserRole(profile.role);
                    } else {
                        // 2. Fallback: lookup by phoneNumber (for admin-created operator/owner)
                        const { collection, query, where, getDocs, setDoc, deleteDoc } =
                            await import('firebase/firestore');
                        const { db } = await import('../firebase/config');

                        const q = query(
                            collection(db, COLLECTIONS.USERS),
                            where('phoneNumber', '==', firebaseUser.phoneNumber)
                        );
                        const snap = await getDocs(q);

                        if (!snap.empty) {
                            const oldDocRef = snap.docs[0].ref;
                            const profile = snap.docs[0].data();

                            // Migrate doc to UID-based ID so fast path works on next login
                            const { doc } = await import('firebase/firestore');
                            const newDocRef = doc(db, COLLECTIONS.USERS, firebaseUser.uid);
                            await setDoc(newDocRef, { ...profile, userId: firebaseUser.uid });

                            // Delete old doc only if it had a different ID
                            if (oldDocRef.id !== firebaseUser.uid) {
                                await deleteDoc(oldDocRef);
                            }

                            setUserProfile({ ...profile, userId: firebaseUser.uid });
                            setUserRole(profile.role);
                        } else {
                            // Genuinely new user — needs to complete registration
                            setUserProfile(null);
                            setUserRole(null);
                        }
                    }
                } catch (error) {
                    console.error('Error fetching user profile:', error);
                }
            } else {
                setUser(null);
                setUserRole(null);
                setUserProfile(null);
            }
            setLoading(false);
        });

        return unsubscribe;
    }, []);


    const value = useMemo(() => ({
        user,
        userRole,
        userProfile,
        loading,
        setUserProfile,
        setUserRole
    }), [user, userRole, userProfile, loading]);

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};
