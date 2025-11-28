import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import type { User as AppUser } from '../types';
import { auth, firestore } from '../firebase/firebaseClient';

export interface RegisterPayload {
  fullName: string;
  businessName: string;
  contactNumber: string;
  email: string;
  password: string;
}

interface AuthContextValue {
  firebaseUser: FirebaseUser | null;
  user: AppUser | null;
  loading: boolean;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateUserProfile: (updates: Partial<AppUser>) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const buildBusinessId = (uid: string) => `biz_${uid}`;

const mapProfileToUser = (uid: string, data: Record<string, any>): AppUser => {
  const profile = data.profile ?? {};
  const contact = data.contact ?? {};

  return {
    id: uid,
    name: profile.fullName ?? data.fullName ?? '',
    email: contact.email ?? data.email ?? '',
    phone: contact.phone ?? data.phone ?? '',
    businessName: profile.businessName ?? data.businessName ?? '',
    contactNumber: contact.phone ?? data.contactNumber ?? '',
    address: data.address ?? profile.address,
    gstNumber: data.gstNumber ?? data.taxId,
    signature: data.signature,
    paymentQRCode: data.paymentQRCode,
  };
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(
    async (uid: string) => {
      const userRef = doc(firestore, 'users', uid);
      const snapshot = await getDoc(userRef);

      if (snapshot.exists()) {
        setUser(mapProfileToUser(uid, snapshot.data()));
      } else {
        setUser(null);
      }
    },
    [setUser]
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setFirebaseUser(currentUser);
      if (currentUser) {
        try {
          await loadProfile(currentUser.uid);
        } catch (error) {
          console.error('Failed to load user profile', error);
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [loadProfile]);

  const loginWithEmail = useCallback(
    async (email: string, password: string) => {
      await signInWithEmailAndPassword(auth, email, password);
    },
    []
  );

  const registerWithEmail = useCallback(
    async (payload: RegisterPayload) => {
      const credential = await createUserWithEmailAndPassword(
        auth,
        payload.email,
        payload.password
      );

      if (payload.fullName) {
        await updateProfile(credential.user, {
          displayName: payload.fullName,
        });
      }

      const userRef = doc(firestore, 'users', credential.user.uid);
      await setDoc(userRef, {
        profile: {
          fullName: payload.fullName,
          businessName: payload.businessName,
        },
        contact: {
          phone: payload.contactNumber,
          email: payload.email,
        },
        businessId: buildBusinessId(credential.user.uid),
        roles: ['owner'],
        preferences: {
          notifications: ['email', 'whatsapp'],
          approvalThreshold: 0.8,
        },
        automationGuardrails: {
          invoiceConfidence: 0.8,
          classificationConfidence: 0.75,
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Sign out after registration to force login
      await signOut(auth);
    },
    []
  );

  const logout = useCallback(async () => {
    await signOut(auth);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!auth.currentUser) return;
    await loadProfile(auth.currentUser.uid);
  }, [loadProfile]);

  const updateUserProfile = useCallback(
    async (updates: Partial<AppUser>) => {
      if (!auth.currentUser) {
        throw new Error('Not authenticated');
      }

      const uid = auth.currentUser.uid;
      const userRef = doc(firestore, 'users', uid);

      const payload: Record<string, any> = {
        updatedAt: serverTimestamp(),
      };

      if (updates.name || updates.businessName) {
        payload.profile = {
          fullName: updates.name ?? user?.name ?? '',
          businessName: updates.businessName ?? user?.businessName ?? '',
        };
      }

      if (updates.phone || updates.contactNumber || updates.email) {
        payload.contact = {
          phone:
            updates.phone ??
            updates.contactNumber ??
            user?.contactNumber ??
            user?.phone ??
            '',
          email: updates.email ?? user?.email ?? '',
        };
      }

      if (updates.address !== undefined) {
        payload.address = updates.address;
      }
      if (updates.gstNumber !== undefined) {
        payload.gstNumber = updates.gstNumber;
      }
      if (updates.signature !== undefined) {
        payload.signature = updates.signature;
      }
      if (updates.paymentQRCode !== undefined) {
        payload.paymentQRCode = updates.paymentQRCode;
      }

      await updateDoc(userRef, payload);
      await refreshProfile();
    },
    [refreshProfile, user]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      firebaseUser,
      user,
      loading,
      loginWithEmail,
      registerWithEmail,
      logout,
      refreshProfile,
      updateUserProfile,
    }),
    [
      firebaseUser,
      user,
      loading,
      loginWithEmail,
      registerWithEmail,
      logout,
      refreshProfile,
      updateUserProfile,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

