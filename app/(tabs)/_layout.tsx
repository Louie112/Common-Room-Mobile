import React, { useState, useEffect } from 'react';
import { Tabs } from 'expo-router';
import {
  useColorScheme,
  Text,
  View,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import getGlobalStyles from '../globalStyles';

import {
  getFirestore,
  doc,
  onSnapshot,
} from '@react-native-firebase/firestore';
import { getAuth, onAuthStateChanged } from '@react-native-firebase/auth';
// initialized Firebase app
import { app } from '../../configs/firebaseConfig';

import { useRouter } from 'expo-router';

export default function TabLayout() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const globalStyles = getGlobalStyles(colorScheme);

  const [notificationsCount, setNotificationsCount] = useState(0);
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    const authInstance = getAuth(app);
    let unsubscribeUserListener;
    const unsubscribeAuth = onAuthStateChanged(authInstance, (currentUser) => {
      if (currentUser) {
        setUserId(currentUser.uid);
        unsubscribeUserListener = subscribeToUserData(currentUser.uid);
      } else {
        setUserId(null);
        setNotificationsCount(0);
      }
    });
    return () => {
      unsubscribeAuth();
      if (unsubscribeUserListener) unsubscribeUserListener();
    };
  }, []);

  // Subscribe to user notifications and timestamps
  const subscribeToUserData = (userId) => {
    if (!userId) return;
    try {
      const db = getFirestore(app);
      const userDocRef = doc(db, 'notifications', userId);
      const unsubscribe = onSnapshot(userDocRef, (docSnapshot) => {
        if (docSnapshot && docSnapshot.exists) {
          const userData = docSnapshot.data();
          const notificationsArray = userData.notifications || [];
          setNotificationsCount(notificationsArray.length);
        } else {
          setNotificationsCount(0);
        }
      });
      return unsubscribe;
    } catch (error) {
      console.error('Error fetching user data: ', error);
    }
  };

  const handlePush = () => {
    router.push('/(notifications)');
  };

  return (
    <>
      <Tabs
        screenOptions={({ route }) => ({
          headerStyle: {
            backgroundColor: globalStyles.mainBackgroundColor.color,
            height: 100,
            shadowOpacity: 0,
            elevation: 0,
            borderBottomWidth: 0,
          },
          headerTitleContainerStyle: {
            marginTop: -20,
          },
          headerTintColor: globalStyles.BlackOrwhite.color,
          headerTitleStyle: { fontSize: 25 },
          headerRight: () => (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginRight: 15,
                marginBottom: 15,
              }}
            >
              <TouchableOpacity onPress={handlePush}>
                <View style={{ position: 'relative', marginRight: 10 }}>
                  <Ionicons
                    name="notifications-outline"
                    size={30}
                    color={globalStyles.mainColor.color}
                  />
                  {notificationsCount > 0 && (
                    <View
                      style={{
                        position: 'absolute',
                        right: -2,
                        top: -2,
                        backgroundColor: globalStyles.mainColor.color,
                        borderRadius: 10,
                        width: 20,
                        height: 20,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text
                        style={{ color: 'white', fontSize: 12, fontWeight: 'bold' }}
                      >
                        {notificationsCount}
                      </Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            </View>
          ),
          tabBarStyle: {
            backgroundColor: globalStyles.mainBackgroundColor.color,
            height: 80,
            borderTopWidth: 0,
          },
          tabBarButton: (props) => (
            <TouchableOpacity {...props}>
              <View style={props.style}>{props.children}</View>
            </TouchableOpacity>
          ),
          tabBarIcon: ({ focused }) => {
            let iconName;
            if (route.name === '(home)') {
              iconName = focused ? 'home' : 'home-outline';
            } else if (route.name === '(manage)') {
              iconName = focused ? 'construct' : 'construct-outline';
            } else if (route.name === '(friends)') {
              iconName = focused ? 'people' : 'people-outline';
            } else if (route.name === '(settings)') {
              iconName = focused ? 'settings' : 'settings-outline';
            }
            return (
              <View style={{ marginTop: 10, marginBottom: -10 }}>
                <Ionicons
                  name={iconName}
                  size={25}
                  color={focused ? globalStyles.mainColor.color : globalStyles.DarkGreyOrLightGrey.color}
                />
              </View>
            );
          },
          tabBarLabel: ({ focused }) => (
            <Text
              style={{
                fontSize: focused ? 14 : 13,
                fontWeight: focused ? 'bold' : 'normal',
                color: focused ? globalStyles.mainColor.color : globalStyles.DarkGreyOrLightGrey.color,
                marginTop: focused ? 14 : 15,
              }}
            >
              {route.name === '(home)'
                ? 'Home'
                : route.name === '(manage)'
                ? 'My Stuff'
                : route.name === '(friends)'
                ? 'Friends'
                : 'Settings'}
            </Text>
          ),
        })}
      >
        <Tabs.Screen name="(home)" options={{ title: 'Home', headerShown: true }} />
        <Tabs.Screen name="(manage)" options={{ title: 'My Stuff', headerShown: true }} />
        <Tabs.Screen name="(friends)" options={{ title: 'Friends', headerShown: true }} />
        <Tabs.Screen name="(settings)" options={{ title: 'Settings', headerShown: true }} />
      </Tabs>
    </>
  );
}

