import { Stack } from 'expo-router';

export default function reserveLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false}}/>
      <Stack.Screen name="reservingImmediately" options={{ headerShown: false}}/>
      <Stack.Screen name="schedulingReservation" options={{ headerShown: false}}/>
    </Stack>
  );
}
