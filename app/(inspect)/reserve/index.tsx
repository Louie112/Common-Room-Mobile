import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  useColorScheme,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  getFirestore,
  doc,
  onSnapshot,
} from '@react-native-firebase/firestore';
import getGlobalStyles from '@/app/globalStyles';
import { app } from '../../../configs/firebaseConfig';
import { useIsFocused } from '@react-navigation/native';

export default function Reserve() {
  const colorScheme = useColorScheme();
  const globalStyles = getGlobalStyles(colorScheme);
  const router = useRouter();
  const { itemId, fromHome } = useLocalSearchParams();

  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  // State initially, "Immediate" is selected.
  const [selectedOption, setSelectedOption] = useState("Immediate");
  const isFocused = useIsFocused();

  useEffect(() => {
    if (!isFocused || !itemId) {
      return;
    }
    if (!itemId) return;
    const db = getFirestore(app);
    const itemDocRef = doc(db, 'items', itemId);
    const unsubscribe = onSnapshot(itemDocRef, (docSnapshot) => {
      if (docSnapshot.exists) {
        setItem(docSnapshot.data());
      } else {
        setItem(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [itemId]);

  // When the item is loaded, automatically switch to Scheduled if the item is unavailable.
  useEffect(() => {
    if (item && !item.availability) {
      setSelectedOption("Scheduled");
    }
  }, [item]);

  if (loading) {
    return (
      <ActivityIndicator size="large" color="#4CAF50"/>
    );
  }

  if (!item) {
    return <Text style={styles.errorText}>Item not found</Text>;
  }

  const isItemAvailable = item.availability;

  const handleContinue = () => {
    if (selectedOption === "Immediate") {
      router.push({ pathname: '/(inspect)/reserve/reservingImmediately', params: { itemId, fromHome } });
    } else if (selectedOption === "Scheduled") {
      router.push({ pathname: '/(inspect)/reserve/schedulingReservation', params: { itemId, fromHome } });
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: globalStyles.mainBackgroundColor.color }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={[{ fontWeight: '600' }, { color: globalStyles.mainColor.color }, { fontSize: 15 }]}>
            Cancel
          </Text>
        </TouchableOpacity>
      </View>
      <View style={{ marginLeft: 25, marginRight: 25 }}>
        <Text style={{ fontSize: 35, marginTop: 50, color: globalStyles.BlackOrwhite.color }}>Choose the</Text>
        <Text style={{ fontSize: 35, color: globalStyles.BlackOrwhite.color }}>type of reservation</Text>
        <Text style={{ fontSize: 15, marginTop: 10, color: globalStyles.DarkGreyOrLightGrey.color }}>
          for {item.name}
        </Text>

        <TouchableOpacity
          onPress={() => {
            if (!isItemAvailable) {
              setSelectedOption("Scheduled");
            } else {
              setSelectedOption("Immediate");
            }
          }}
          style={{
            backgroundColor: "transparent",
            padding: 15,
            borderWidth: 2,
            borderColor: selectedOption === "Immediate" ? globalStyles.mainColor.color : globalStyles.LightGreyOrDarkGrey.color,
            borderRadius: 20,
            marginTop: 50,
            opacity: isItemAvailable ? 1 : 0.5,
          }}
        >
          <Text style={{ fontSize: 20, marginBottom: 2, color: globalStyles.BlackOrwhite.color }}>Immediate</Text>
          <Text style={{ fontSize: 15, color: globalStyles.DarkGreyOrLightGrey.color, lineHeight: 20 }}>
            Reserve {item.name} immediately until a specified time or indefinitely
          </Text>
          <Text style={{ fontSize: 15, color: globalStyles.DarkGreyOrLightGrey.color, lineHeight: 20 }}>
            (only if item is currently available)
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setSelectedOption("Scheduled")}
          style={{
            backgroundColor: "transparent",
            padding: 15,
            borderWidth: 2,
            borderColor: selectedOption === "Scheduled" ? globalStyles.mainColor.color : globalStyles.LightGreyOrDarkGrey.color,
            borderRadius: 20,
            marginTop: 20,
          }}
        >
          <Text style={{ fontSize: 20, marginBottom: 2, color: globalStyles.BlackOrwhite.color }}>Scheduled</Text>
          <Text style={{ fontSize: 15, color: globalStyles.DarkGreyOrLightGrey.color, lineHeight: 20 }}>
            Schedule a reservation for {item.name} with a specific time to start and end your reservation
          </Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.footer, {backgroundColor: "transparent", borderTopColor: globalStyles.LightGreyOrDarkGrey.color}]}>
        <TouchableOpacity
          style={[styles.continueButton, {backgroundColor: globalStyles.mainColor.color}]}
          onPress={handleContinue}
        >
          <Text style={{ color: 'white', fontWeight: "600" }}>Continue</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingHorizontal: 30,
    paddingVertical: 20,
    marginTop: 25,
  },
  errorText: { fontSize: 18, color: "red" },
  footer: {
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    borderTopWidth: 1,
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  continueButton: {
    padding: 15,
    borderRadius: 100,
    width: '85%',
    justifyContent: 'center',
    alignItems: 'center',
  },
});