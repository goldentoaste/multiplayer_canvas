import { doc , getDoc} from "@firebase/firestore/lite";
import { db } from "./client";



export async function fetchLines(){
    const lineDocRef = doc(db, "lineCollection/lineDoc");
    const lineDoc = await getDoc(lineDocRef);

    if(lineDoc.exists()){
        console.log(lineDoc.data());
        
    }

}   