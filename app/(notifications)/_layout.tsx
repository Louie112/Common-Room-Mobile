import { Stack } from 'expo-router';

export default function notificationsLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false}}/>
    </Stack>
  );
}
