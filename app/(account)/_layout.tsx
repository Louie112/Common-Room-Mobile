import { Stack } from 'expo-router';

export default function AccountLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false}}/>
      <Stack.Screen name="editName" options={{ headerShown: false}}/>
      <Stack.Screen name="editProfilePic" options={{ headerShown: false}}/>
    </Stack>
  );
}
