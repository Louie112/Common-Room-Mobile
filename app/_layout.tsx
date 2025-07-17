import React, { useEffect } from 'react';
import { Platform, useColorScheme, View } from 'react-native';
import {
  SafeAreaProvider,
  SafeAreaView
} from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { NotificationProvider } from '../assets/NotificationContext';
import * as Notifications from 'expo-notifications';
import * as NavigationBar from 'expo-navigation-bar';
import getGlobalStyles from './globalStyles';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const globalStyles = getGlobalStyles(colorScheme);

  useEffect(() => {
    if (Platform.OS === 'android') {
      NavigationBar.setPositionAsync('relative');
      NavigationBar.setBackgroundColorAsync(
        globalStyles.mainBackgroundColor.color
      );
      NavigationBar.setButtonStyleAsync(
        colorScheme === 'dark' ? 'light' : 'dark'
      );
    }
  }, [globalStyles, colorScheme]);

  return (
    <NotificationProvider>
      <SafeAreaProvider>
        <SafeAreaView
          edges={['bottom']}
          style={{
            flex: 1,
            backgroundColor: globalStyles.mainBackgroundColor.color,
          }}
        >
          <StatusBar
            style={colorScheme === 'dark' ? 'light' : 'dark'}
            translucent
            backgroundColor="transparent"
          />
          <View style={{ flex: 1 }}>
            <Stack>
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="(add)" options={{ headerShown: false }} />
              <Stack.Screen
                name="(inspect)"
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="(friendSearch)"
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="(profileInspect)"
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="(account)"
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="(notifications)"
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="(backup)"
                options={{ headerShown: false }}
              />
            </Stack>
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    </NotificationProvider>
  );
}