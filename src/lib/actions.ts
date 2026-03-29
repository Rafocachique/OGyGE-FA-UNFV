
'use server';

import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

interface LogActionParams {
    userId: string;
    action: string;
    details?: string;
}

export async function logKeyAction(params: LogActionParams) {
    try {
        await addDoc(collection(db, "userActions"), {
            userId: params.userId,
            type: 'key_action',
            action: params.action,
            details: params.details || null,
            timestamp: serverTimestamp(),
        });
    } catch (error) {
        console.error("Error logging key action:", error);
        // We don't throw here to avoid breaking the user flow
    }
}
