

"use client";

import { useState, useEffect } from "react";
import { onSnapshot, collection } from "firebase/firestore";
import { getAuth, onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { app, db } from "@/lib/firebase";
import { logKeyAction } from "@/lib/actions";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LoaderCircle, UserPlus, Users } from "lucide-react";
import { User as AppUser, UserRole, ThesisPlan } from "@/lib/types";
import { UserFormDialog } from "@/components/user-form-dialog";
import { UsersTable } from "@/components/users-table";


export default function UserManagementPage() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [allPlans, setAllPlans] = useState<ThesisPlan[]>([]);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const auth = getAuth(app);


  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userDocRef = doc(db, "users", firebaseUser.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
            const data = userDoc.data();
            const roles: UserRole[] = data.roles || (data.role ? [data.role] : ['alumno']);
            setCurrentUser({
                uid: firebaseUser.uid,
                correo: data.correo || firebaseUser.email || '',
                roles: roles,
                nombre: data.nombre || '',
                apellidos: data.apellidos || '',
                activo: data.activo === undefined ? true : data.activo,
                creadoEn: data.creadoEn,
            });
            await updateDoc(userDocRef, { lastLogin: new Date() });
        }
      }
    });
    
    const unsubscribeUsers = onSnapshot(collection(db, "users"), (snapshot) => {
        const usersData = snapshot.docs.map(doc => {
            const data = doc.data();
            const roles: UserRole[] = data.roles || (data.role ? [data.role] : ['alumno']);
            return {
                uid: doc.id,
                ...data,
                roles,
                activo: data.activo === undefined ? true : data.activo,
            } as AppUser;
        });
        setUsers(usersData);
    });

    const unsubscribePlans = onSnapshot(collection(db, "thesisPlans"), (snapshot) => {
      const plansData = snapshot.docs.map(doc => doc.data() as ThesisPlan);
      setAllPlans(plansData);
      setLoading(false); // Stop loading after all data is fetched
    });


    return () => {
      unsubscribeAuth();
      unsubscribeUsers();
      unsubscribePlans();
    }
  }, [auth]);

  const openNewUserDialog = () => {
    setEditingUser(null);
    setIsDialogOpen(true);
  }

  const openEditUserDialog = (user: AppUser) => {
    setEditingUser(user);
    setIsDialogOpen(true);
  }
  
  const allUsers = users;

  return (
    <>
      <Card>
          <CardHeader className="flex flex-row items-center justify-between">
              <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5"/>
                    Gestión de Usuarios
                  </CardTitle>
                  <CardDescription>Cree, edite y gestione todos los usuarios del sistema y sus roles.</CardDescription>
              </div>
              <Button onClick={openNewUserDialog}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Crear Usuario
              </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
                <div className="flex justify-center items-center h-48">
                    <LoaderCircle className="mx-auto h-8 w-8 animate-spin text-primary" />
                </div>
            ) : (
                <UsersTable users={allUsers} onEdit={openEditUserDialog} currentUser={currentUser} allPlans={allPlans} />
            )}
          </CardContent>
      </Card>

      <UserFormDialog
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        editingUser={editingUser}
        currentUser={currentUser}
      />
    </>
  );
}
