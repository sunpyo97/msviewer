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

// Initialize Firebase using the global compat namespace
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();

// Setup global helpers for other scripts (maintaining the interface they expect)
window.firebaseDB = db;
window.firebaseRef = function (dbRef, path) { return path ? db.ref(path) : dbRef; };
window.firebaseSet = function (dbRef, val) { return dbRef.set(val); };
window.firebaseGet = function (dbRef) { return dbRef.get(); };
window.firebaseOnValue = function (dbRef, cb) { return dbRef.on('value', cb); };
window.firebaseUpdate = function (dbRef, updates) { return dbRef.update(updates); };
window.firebaseChild = function (dbRef, path) {
    // If the first argument is already a reference, just use .child()
    if (dbRef && typeof dbRef.child === 'function') {
        return dbRef.child(path);
    }
    // If getting child from root
    return db.ref(path);
};
