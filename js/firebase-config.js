import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBxb0yvohCVn3XI7B9UC1Jtl2yLzNwa9TE",
  authDomain: "rapat-49334.firebaseapp.com",
  projectId: "rapat-49334",
  storageBucket: "rapat-49334.appspot.com",
  messagingSenderId: "7778456315",
  appId: "1:7778456315:web:6bb87b6e88c5e1c70a565e"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
