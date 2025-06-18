// utils/createSuperadmin.ts
import { auth, db } from '@/lib/firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

export const createSuperadminAccount = async (email: string, password: string, name: string) => {
  try {
    // Create the authentication user
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Create the user document in Firestore with superadmin role
    await setDoc(doc(db, 'users', user.uid), {
      uid: user.uid,
      email: email,
      name: name,
      role: 'superadmin',
      permissions: [
        'read:all',
        'write:all',
        'delete:all',
        'manage:users',
        'manage:roles',
        'manage:system'
      ],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      isActive: true
    });

    console.log('Superadmin account created successfully');
    return { success: true, user: user };
  } catch (error) {
    console.error('Error creating superadmin account:', error);
    return { success: false, error: error };
  }
};

// // Alternative: Function to upgrade existing user to superadmin
// export const upgradeTo: any Superadmin = async (userId: string) => {
//   try {
//     await setDoc(doc(db, 'users', userId), {
//       role: 'superadmin',
//       permissions: [
//         'read:all',
//         'write:all',
//         'delete:all',
//         'manage:users',
//         'manage:roles',
//         'manage:system'
//       ],
//       updatedAt: serverTimestamp()
//     }, { merge: true }); // merge: true will update existing fields without overwriting the entire document

//     console.log('User upgraded to superadmin successfully');
//     return { success: true };
//   } catch (error) {
//     console.error('Error upgrading user to superadmin:', error);
//     return { success: false, error: error };
//   }
// };