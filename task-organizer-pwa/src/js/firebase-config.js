const firebaseConfig = {
    apiKey: "AIzaSyA5bn85sy036cJDAJhZRTU3Z3PdkaZi3lY",
    authDomain: "atmv117.firebaseapp.com",
    projectId: "atmv117",
    storageBucket: "atmv117.firebasestorage.app",
    messagingSenderId: "262893477859",
    appId: "1:262893477859:web:322fac6968389050abcad6",
    measurementId: "G-WTV7S63HR2"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
window.db = db;
window.firebase = firebase;
console.log('Firebase inicializado');