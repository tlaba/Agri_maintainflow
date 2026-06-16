// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyD1idj0SOCw-7_REUcHw9fI5qfJTq4OfgY",
  authDomain: "maintainflow-ag.firebaseapp.com",
  projectId: "maintainflow-ag",
  storageBucket: "maintainflow-ag.firebasestorage.app",
  messagingSenderId: "411612647029",
  appId: "1:411612647029:web:c425953e14364dea4eb23c",
  measurementId: "G-4YT29N2Z9L"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
