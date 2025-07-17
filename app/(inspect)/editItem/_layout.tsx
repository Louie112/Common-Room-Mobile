import { Stack } from 'expo-router';

export default function EditItemLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false}}/>
      <Stack.Screen name="editName" options={{ headerShown: false}}/>
      <Stack.Screen name="editPhoto" options={{ headerShown: false}}/>
    </Stack>
  );
}
