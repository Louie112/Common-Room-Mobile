import React, { createContext, useEffect, useState, useContext, ReactNode } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

interface NotificationContextValue {
  fcmPushToken: string;
}

const NotificationContext = createContext<NotificationContextValue>({
  fcmPushToken: '',
});

type NotificationProviderProps = { children: ReactNode };

export const NotificationProvider = ({ children }: NotificationProviderProps) => {
  const [fcmPushToken, setFcmPushToken] = useState('');

  async function registerForPushNotificationsAsync() {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }
    if (!Device.isDevice) {
      alert('Must use a physical device for push notifications');
      return;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      alert('Permission not granted for push notifications!');
      return;
    }
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
    if (!projectId) {
      alert('Project ID not found');
      return;
    }
    try {
      const tokenData = await Notifications.getDevicePushTokenAsync();
      const token = tokenData.data;
      console.log('FCM Push Token:', token);
      setFcmPushToken(token);
    } catch (e) {
      alert(`Error getting push token: ${e}`);
      console.error(e);
    }    
  }

  useEffect(() => {
    registerForPushNotificationsAsync();
  }, []);

  return (
    <NotificationContext.Provider value={{ fcmPushToken }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => useContext(NotificationContext);
