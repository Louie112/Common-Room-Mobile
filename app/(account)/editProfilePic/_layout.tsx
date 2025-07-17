import { Stack } from 'expo-router';

export default function EditProfilePicLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false}}/>
    </Stack>
  );
}
