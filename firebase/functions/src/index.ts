/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

// Start writing functions
// https://firebase.google.com/docs/functions/typescript

// export const helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

import { onSchedule } from "firebase-functions/scheduler";
import { getFirestore, Timestamp } from "firebase-admin/firestore"

interface FirebaseLine {
    id: string;
    color: string;
    createdOn: Timestamp;
    thickness: number;
    points: { x: number, y: number }[]
}

const limit = 400;

exports.cleanupExtraLines = onSchedule("every 10 minutes", async (e) => {

    const db = getFirestore();

    const docRef = db.doc("lineCollection/lineDoc");
    const doc: undefined | { lines: { [id: string]: FirebaseLine } } = (await docRef.get()).data() as { lines: { [id: string]: FirebaseLine } };

    if (doc) {
        const res : {[id:string]: any} = {};
        const lines = Object.values(doc.lines);

        if(lines.length > limit){
            // Too many! purge extra lines
            lines.sort((a, b)=>{
                return b.createdOn.seconds - a.createdOn.seconds
            });
            lines.length = limit;

            for(const line of lines){
                res[line.id] = line;
            }

            // upload and replace
            docRef.set({
                lines: res
            })
        }
    }

})