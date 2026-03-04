import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getDatabase, ref, set, get, onValue, update, child } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-database.js";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyB23yFfUVEoN-2O94-aRielBxtM0XA_ryc",
    authDomain: "kodaf-d1a6d.firebaseapp.com",
    databaseURL: "https://kodaf-d1a6d-default-rtdb.firebaseio.com",
    projectId: "kodaf-d1a6d",
    storageBucket: "kodaf-d1a6d.firebasestorage.app",
    messagingSenderId: "45448060732",
    appId: "1:45448060732:web:954e6d68633123ae8b8839",
    measurementId: "G-PKL0DC31D5"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Export for other scripts to use
window.firebaseDB = db;
window.firebaseRef = ref;
window.firebaseSet = set;
window.firebaseGet = get;
window.firebaseOnValue = onValue;
window.firebaseUpdate = update;
window.firebaseChild = child;
