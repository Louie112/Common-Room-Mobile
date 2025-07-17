import { Stack } from 'expo-router';

export default function InspectLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false}}/>
      <Stack.Screen name="reserve" options={{ headerShown: false}}/>
      <Stack.Screen name="editItem" options={{ headerShown: false}}/>
      <Stack.Screen name="viewUsers" options={{ headerShown: false}}/>
      <Stack.Screen name="manageUsers" options={{ headerShown: false}}/>
    </Stack>
  );
}
