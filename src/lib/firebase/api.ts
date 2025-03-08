import { arrayUnion, deleteField, doc, getDoc, setDoc, Timestamp, updateDoc } from "@firebase/firestore/lite";
import { db } from "./client";


export interface FirebaseLine{
    id:string;
    color:string;
    createdOn: Timestamp;
    thickness:number;
    points: {x:number, y:number}[]
}

export async function fetchLines() {
    const lineDocRef = doc(db, "lineCollection/lineDoc");
    const lineDoc = await getDoc(lineDocRef);
 
    if (lineDoc.exists()) {
        return lineDoc.data()["lines"] as {[id:string] : FirebaseLine};
    }

    return  {} as {[id:string] : FirebaseLine};

}   

export async function uploadLines(lines: FirebaseLine[]) {
    const lineDocRef = doc(db, "lineCollection/lineDoc");


    const update: {[fieldName:string]: any} = {lines: {}};
    
    for(const line of lines){
        update[`lines`][line.id] = line;
    }

    setDoc(lineDocRef, update, {merge:true})
}


export async function deleteLines(lineIds:string[]){
    const lineDocRef = doc(db, "lineCollection/lineDoc");
    const update: {[fieldName:string]: any} = {lines: {}};

    for(const id of lineIds){
        update[`lines`][id] = deleteField();
    }

    setDoc(lineDocRef, update, {merge:true})
}