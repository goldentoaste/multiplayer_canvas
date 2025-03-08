// Import the functions you need from the SDKs you need
import {getFirestore} from "@firebase/firestore/lite"
import {initializeApp} from "@firebase/app";

// TODO: Add SDKs for Firebase products that you want to use

// https://firebase.google.com/docs/web/setup#available-libraries


// Your web app's Firebase configuration

// For Firebase JS SDK v7.20.0 and later, measurementId is optional

const firebaseConfig = {

  apiKey: "AIzaSyDcVssBfxdrhKiCMOgkRNkKryGTBwn_my0",

  authDomain: "multiplayer-canvas-a8da3.firebaseapp.com",

  projectId: "multiplayer-canvas-a8da3",

  storageBucket: "multiplayer-canvas-a8da3.firebasestorage.app",

  messagingSenderId: "852651376332",

  appId: "1:852651376332:web:bfcc999c46a42727b0cc69",

  measurementId: "G-8SZ2LQ7QJJ"

};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
