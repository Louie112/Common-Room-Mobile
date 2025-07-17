import { Stack } from 'expo-router';

export default function profileInspectLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false}}/>
    </Stack>
  );
}
