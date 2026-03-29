
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getAuth, onAuthStateChanged, User as FirebaseUser, signOut } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { app, db } from '@/lib/firebase';
import { useToast } from "@/hooks/use-toast";
import { AppUser, UserRole } from '@/lib/types';
import { useRouter } from 'next/navigation';

interface AuthContextType {
  user: FirebaseUser | null;
  appUser: AppUser | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const auth = getAuth(app);
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    let userDocUnsubscribe: () => void = () => {};

    const authUnsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      // Unsubscribe from previous user's document listener
      if (userDocUnsubscribe) {
        userDocUnsubscribe();
      }

      if (firebaseUser) {
        setUser(firebaseUser);
        const userDocRef = doc(db, "users", firebaseUser.uid);
        
        userDocUnsubscribe = onSnapshot(userDocRef, (userDoc) => {
          if (userDoc.exists()) {
            const data = userDoc.data();
            const roles: UserRole[] = data.roles || (data.role ? [data.role] : ['alumno']);
            const userData: AppUser = {
              uid: firebaseUser.uid,
              correo: data.correo || firebaseUser.email || '',
              roles: roles,
              nombre: data.nombre || '',
              apellidos: data.apellidos || '',
              dni: data.dni || '',
              telefono: data.telefono || '',
              escuela: data.escuela || '',
              activo: data.activo === undefined ? true : data.activo,
              creadoEn: data.creadoEn,
            };
            setAppUser(userData);
          } else {
            toast({
              variant: "destructive",
              title: "Acceso Denegado",
              description: "Su cuenta no tiene los permisos necesarios para acceder a esta aplicación.",
            });
            signOut(auth); // This will trigger onAuthStateChanged again with null
          }
          setLoading(false);
        }, (error) => {
            console.error("Error listening to user document:", error);
            toast({
                variant: "destructive",
                title: "Error de Conexión",
                description: "No se pudo obtener la información del usuario en tiempo real.",
            });
            signOut(auth);
            setLoading(false);
        });
      } else {
        setUser(null);
        setAppUser(null);
        setLoading(false);
      }
    });

    return () => {
      authUnsubscribe();
      if (userDocUnsubscribe) {
        userDocUnsubscribe();
      }
    };
  }, [auth, router, toast]);

  const value = { user, appUser, loading };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
