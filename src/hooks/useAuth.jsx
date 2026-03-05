// Authentication context and hook
import { createContext, useContext, useState, useEffect, useMemo, useRef } from 'react';
import { onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
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
    const [profileResolved, setProfileResolved] = useState(false);
    const [isBanned, setIsBanned] = useState(false);
    // ref to cleanup real-time ban watcher
    const banWatcherRef = useRef(null);

    // Helper: sign out a banned user
    const handleBannedUser = async () => {
        alert('⛔ Your account has been blocked by the admin. Contact support for help.');
        await firebaseSignOut(auth);
    };

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            // Mark profile as not yet resolved whenever auth state changes
            setProfileResolved(false);

            if (firebaseUser) {
                setUser(firebaseUser);

                try {
                    // 1. Try lookup by UID (fastest path)
                    const userDoc = await getDocument(COLLECTIONS.USERS, firebaseUser.uid);

                    if (userDoc.exists()) {
                        const profile = userDoc.data();

                        // ── BAN CHECK ──
                        if (profile.isBanned === true) {
                            await handleBannedUser();
                            setLoading(false);
                            setProfileResolved(true);
                            return;
                        }

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

                                // Migrate privileged doc to UID-keyed doc
                                const newDocRef = doc(db, COLLECTIONS.USERS, firebaseUser.uid);
                                await setDoc(newDocRef, { ...privilegedProfile, userId: firebaseUser.uid, phoneNumber: firebaseUser.phoneNumber });

                                // Set role BEFORE deleting old doc — delete failure must not abort login
                                setUserProfile({ ...privilegedProfile, userId: firebaseUser.uid });
                                setUserRole(privilegedProfile.role);

                                // Best-effort cleanup of stale phone-keyed doc
                                try {
                                    await deleteDoc(privilegedDoc.ref);
                                } catch (delErr) {
                                    console.warn('[useAuth] Could not delete legacy doc (non-fatal):', delErr.code);
                                }

                                setProfileResolved(true);
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
                            const { doc, onSnapshot: onSnap } = await import('firebase/firestore');
                            const newDocRef = doc(db, COLLECTIONS.USERS, firebaseUser.uid);
                            await setDoc(newDocRef, { ...profile, userId: firebaseUser.uid });

                            // Set role BEFORE deleting — delete failure must never abort login
                            setUserProfile({ ...profile, userId: firebaseUser.uid });
                            setUserRole(profile.role);

                            // Real-time ban watcher
                            if (banWatcherRef.current) banWatcherRef.current();
                            banWatcherRef.current = onSnap(
                                doc(db, COLLECTIONS.USERS, firebaseUser.uid),
                                (snap) => {
                                    if (snap.exists() && snap.data().isBanned === true) {
                                        handleBannedUser();
                                    }
                                }
                            );

                            // Best-effort cleanup: delete old phone-keyed doc
                            try {
                                if (oldDocRef.id !== firebaseUser.uid) {
                                    await deleteDoc(oldDocRef);
                                }
                            } catch (delErr) {
                                console.warn('[useAuth] Could not delete legacy doc (non-fatal):', delErr.code);
                            }
                        } else {
                            // Genuinely new user — needs to complete registration
                            setUserProfile(null);
                            setUserRole(null);
                        }
                    }
                } catch (error) {
                    console.error('Error fetching user profile:', error);
                    setUserProfile(null);
                    setUserRole(null);
                }
            } else {
                setUser(null);
                setUserRole(null);
                setUserProfile(null);
                setIsBanned(false);
                if (banWatcherRef.current) { banWatcherRef.current(); banWatcherRef.current = null; }
            }
            // Always mark profile as resolved and loading as done here
            setProfileResolved(true);
            setLoading(false);
        });

        return unsubscribe;
    }, []);


    const value = useMemo(() => ({
        user,
        userRole,
        userProfile,
        loading,
        profileResolved,
        isBanned,
        setUserProfile,
        setUserRole
    }), [user, userRole, userProfile, loading, profileResolved, isBanned]);

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};
