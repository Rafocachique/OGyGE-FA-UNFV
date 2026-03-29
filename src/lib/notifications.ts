import { collection, doc, serverTimestamp, writeBatch, WriteBatch } from "firebase/firestore";
import { db } from "./firebase";
import { Notification } from "./types";

interface CreateNotificationParams {
    userId: string;
    message: string;
    link: string;
    batch?: WriteBatch;
}

export function createNotification(params: CreateNotificationParams) {
    const { userId, message, link, batch } = params;

    if (!userId) {
        console.error("No se puede crear una notificación sin un ID de usuario.");
        return;
    }

    const notificationRef = doc(collection(db, "notifications"));

    const newNotification: Omit<Notification, "id"> = {
        userId,
        message,
        link,
        read: false,
        createdAt: serverTimestamp(),
    };

    if (batch) {
        batch.set(notificationRef, newNotification);
    } else {
        const standaloneBatch = writeBatch(db);
        standaloneBatch.set(notificationRef, newNotification);
        return standaloneBatch.commit();
    }
}
