#!/bin/bash
# Netlify build script — generates config.js from environment variables.
# Shared helpers live in helpers.js (committed); this only writes the Firebase block.
cat > config.js << JSEOF
const firebaseConfig = {
    apiKey: "${FIREBASE_API_KEY}",
    authDomain: "${FIREBASE_AUTH_DOMAIN}",
    databaseURL: "${FIREBASE_DATABASE_URL}",
    projectId: "${FIREBASE_PROJECT_ID}",
    storageBucket: "${FIREBASE_STORAGE_BUCKET}",
    messagingSenderId: "${FIREBASE_SENDER_ID}",
    appId: "${FIREBASE_APP_ID}"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
JSEOF
echo "config.js generated from environment variables"
