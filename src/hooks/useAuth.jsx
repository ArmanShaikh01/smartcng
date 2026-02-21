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

                // Fetch user profile from Firestore
                try {
                    const userDoc = await getDocument(COLLECTIONS.USERS, firebaseUser.uid);
                    if (userDoc.exists()) {
                        const profile = userDoc.data();
                        setUserProfile(profile);
                        setUserRole(profile.role);
                    } else {
                        // New user - needs to complete registration
                        setUserProfile(null);
                        setUserRole(null);
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
