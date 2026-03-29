

"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useIdleTimer } from "@/hooks/use-idle-timer";
import { getAuth, signOut } from "firebase/auth";
import { doc, updateDoc, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { app, db } from "@/lib/firebase";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useRouter } from "next/navigation";

const IDLE_TIMEOUT = 10 * 60 * 1000; // 10 minutes
const HEARTBEAT_INTERVAL = 1 * 60 * 1000; // 1 minute
const PROMPT_TIMEOUT = 60 * 1000; // 60 seconds

export function SessionManager({ children }: { children: React.ReactNode }) {
    const { user, appUser } = useAuth();
    const router = useRouter();
    const [isPrompted, setIsPrompted] = useState(false);
    const [countdown, setCountdown] = useState(PROMPT_TIMEOUT / 1000);

    const handleSignOut = useCallback(() => {
        const auth = getAuth(app);
        signOut(auth).then(() => {
            router.push('/login');
        });
    }, [router]);
    
    const handleIdle = () => {
        setIsPrompted(true);
    };

    const { isIdle } = useIdleTimer({ onIdle: handleIdle, idleTime: IDLE_TIMEOUT });

    const handleStay = () => {
        setIsPrompted(false);
    };

    // Heartbeat effect for active time tracking
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (user && appUser && !isIdle()) {
            interval = setInterval(async () => {
                try {
                    await addDoc(collection(db, "userActions"), {
                        userId: appUser.uid,
                        type: 'active_heartbeat',
                        timestamp: serverTimestamp(),
                    });
                } catch (error) {
                    console.error("Error logging heartbeat:", error);
                }
            }, HEARTBEAT_INTERVAL);
        }
        return () => {
            if (interval) {
                clearInterval(interval);
            }
        };
    }, [user, appUser, isIdle]);

    // Countdown effect for prompt dialog
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isPrompted) {
            setCountdown(PROMPT_TIMEOUT / 1000);
            interval = setInterval(() => {
                setCountdown(prev => {
                    if (prev <= 1) {
                        clearInterval(interval);
                        handleSignOut();
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => {
            if (interval) {
                clearInterval(interval);
            }
        };
    }, [isPrompted, handleSignOut]);

     // Update lastLogin on login
    useEffect(() => {
        if (user) {
            const userRef = doc(db, "users", user.uid);
            updateDoc(userRef, { lastLogin: serverTimestamp() }).catch(console.error);
        }
    }, [user]);

    return (
        <>
            {children}
            <AlertDialog open={isPrompted}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Sigues ahí?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Tu sesión se cerrará automáticamente por inactividad en {countdown} segundos.
                            Haz clic en "Permanecer" para continuar en el sistema.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogAction onClick={handleStay}>Permanecer</AlertDialogAction>
                        <AlertDialogCancel onClick={handleSignOut}>Cerrar Sesión</AlertDialogCancel>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
