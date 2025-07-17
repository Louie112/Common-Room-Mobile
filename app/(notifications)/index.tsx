import React, { useState, useEffect } from 'react';
import {
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  useColorScheme,
} from 'react-native';

import {
  getFirestore,
  doc,
  onSnapshot,
  updateDoc,
} from '@react-native-firebase/firestore';
import { getAuth, onAuthStateChanged } from '@react-native-firebase/auth';
import { app } from '../../configs/firebaseConfig';

import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import getGlobalStyles from '../../app/globalStyles';
import { useIsFocused } from '@react-navigation/native';

export default function Notifications() {
  const colorScheme = useColorScheme();
  const globalStyles = getGlobalStyles(colorScheme);
  const router = useRouter();
  const [notificationsCount, setNotificationsCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [timestamps, setTimestamps] = useState([]);
  const [userId, setUserId] = useState(null);
  const isFocused = useIsFocused();

  useEffect(() => {
    if (!isFocused) {
      return;
    }
    const authInstance = getAuth(app);
    let unsubscribeUserListener;
    const unsubscribeAuth = onAuthStateChanged(authInstance, (currentUser) => {
      if (currentUser) {
        setUserId(currentUser.uid);
        unsubscribeUserListener = subscribeToUserData(currentUser.uid);
      } else {
        setUserId(null);
        setNotificationsCount(0);
        setNotifications([]);
        setTimestamps([]);
      }
    });
    return () => {
      unsubscribeAuth();
      if (unsubscribeUserListener) unsubscribeUserListener();
    };
  }, []);

  const subscribeToUserData = (userId) => {
    if (!userId) return;
    try {
      const db = getFirestore(app);
      const userDocRef = doc(db, 'notifications', userId);
      const unsubscribe = onSnapshot(userDocRef, (docSnapshot) => {
        if (docSnapshot && docSnapshot.exists) {
          const userData = docSnapshot.data();
          const notificationsArray = userData.notifications || [];
          const timestampsArray = userData.timestamps || [];
          setNotifications(notificationsArray);
          setTimestamps(timestampsArray);
          setNotificationsCount(notificationsArray.length);
        } else {
          setNotifications([]);
          setTimestamps([]);
          setNotificationsCount(0);
        }
      });
      return unsubscribe;
    } catch (error) {
      console.error('Error fetching user data: ', error);
    }
  };

  // Remove a notification and its corresponding timestamp
  const removeNotification = async (notificationToRemove) => {
    if (!userId) return;
    try {
      const db = getFirestore(app);
      const userDocRef = doc(db, 'notifications', userId);

      // Find the index of the notification to remove.
      const index = notifications.findIndex((notif) => {
        if (typeof notif === 'object' && typeof notificationToRemove === 'object') {
          return notif.message === notificationToRemove.message;
        }
        return notif === notificationToRemove;
      });

      if (index === -1) return; // Notification not found

      // Create new arrays excluding the removed notification and its timestamp.
      const newNotifications = [...notifications];
      const newTimestamps = [...timestamps];
      newNotifications.splice(index, 1);
      newTimestamps.splice(index, 1);

      // Update the Firestore document with both arrays.
      await updateDoc(userDocRef, {
        notifications: newNotifications,
        timestamps: newTimestamps,
      });
    } catch (error) {
      console.error('Error removing notification: ', error);
    }
  };

  // Clear both notifications and timestamps
  const clearAllNotifications = async () => {
    if (!userId) return;
    try {
      const db = getFirestore(app);
      const userDocRef = doc(db, 'notifications', userId);
      await updateDoc(userDocRef, {
        notifications: [],
        timestamps: [],
      });
    } catch (error) {
      console.error('Error clearing notifications: ', error);
    }
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';

    // Convert the Firestore timestamp to a JavaScript Date object.
    const date = timestamp.toDate();
    const now = new Date();
    const diffMs = now - date; // Difference in milliseconds.
    
    // Calculate differences in minutes, hours, and days.
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffMinutes < 5) {
      return 'just now';
    }
    if (diffMinutes < 60) {
      return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
    }
    if (diffHours < 24) {
      return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    }
    if (diffDays < 7) {
      return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
    }
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  };

  return (
    <View style={{ flex: 1, backgroundColor: globalStyles.mainBackgroundColor.color}}>
      <TouchableOpacity style={styles.backButton} onPress={router.back}>
        <MaterialIcons
          name="arrow-back"
          size={28}
          color={globalStyles.BlackOrwhite.color}
        />
      </TouchableOpacity>
      {notifications.length > 0 && (
        <TouchableOpacity style={{position: 'absolute', top: 55, right: 25, zIndex: 10}} onPress={clearAllNotifications}>
          <Text style={{ color: 'red', fontWeight: 600}}>
            Clear All
          </Text>
        </TouchableOpacity>
      )}
      <Text
        style={{
          fontSize: 25,
          marginTop: 45,
          marginLeft: 60,
          color: globalStyles.BlackOrwhite.color
        }}
      >
        Inbox
      </Text>
      <ScrollView style={{ flex: 1, paddingHorizontal: 20, marginTop: 40, }}>
        {notifications.length === 0 ? (
          <Text style={{ textAlign: 'center', marginTop: 100, color: 'grey'}}>
            No notifications
          </Text>
        ) : (
          // Reverse notifications array without mutating state
          notifications.slice().reverse().map((notification, revIndex) => {
            const originalIndex = notifications.length - 1 - revIndex;
            return (
              <View
                key={originalIndex}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginVertical: 5,
                  padding: 25,
                  borderRadius: 20,
                  backgroundColor: globalStyles.LightGreyOrDarkGrey.color,
                }}
              >
                <View style={{ flex: 1, maxWidth: '80%' }}>
                  <Text style={{color: globalStyles.BlackOrwhite.color}}>
                    {typeof notification === 'object'
                      ? notification.message || JSON.stringify(notification)
                      : notification}
                  </Text>
                  <Text style={{ fontSize: 12, color: globalStyles.DarkGreyOrLightGrey.color, marginTop: 4 }}>
                    {formatTimestamp(timestamps[originalIndex])}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => removeNotification(notification)}
                  style={{position: 'absolute', top: 20, right: 20}}
                >
                  <MaterialIcons name="close" size={25} color={globalStyles.BlackOrwhite.color} />
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  backButton: {
    position: 'absolute',
    top: 50,
    left: 16,
    zIndex: 10,
  },
});
