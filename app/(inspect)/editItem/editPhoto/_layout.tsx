import { Stack } from 'expo-router';

export default function EditPhotoLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false}}/>
    </Stack>
  );
}
