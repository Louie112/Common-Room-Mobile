import { Stack } from 'expo-router';

export default function ManageLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false}}/>
    </Stack>
  );
}
